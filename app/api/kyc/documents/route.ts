import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { reportOperationalError } from '@/lib/observability/operationalEventSink';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sanitizeInput } from '@/lib/security';
import { removeStorageObjectBestEffort } from '@/lib/storage/compensation';
import { sha256Hex } from '@/lib/storage/uploadScanner';
import { validateUploadedBytes } from '@/lib/storage/validatedUpload';

const KYC_BUCKET = 'kyc-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const VALID_DOCUMENT_TYPES = [
  'identity',
  'business_license',
  'tax_document',
  'address_proof',
  'bank_statement',
] as const;

type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

type CleanKycScanJob = {
  id: string;
  status: string;
  destination_path: string;
  verified_mime: string | null;
  byte_size: number | null;
  sha256: string | null;
};

async function deleteRejectedUpload(filePath: string, ownerId: string, operation: string) {
  return removeStorageObjectBestEffort(
    getSupabaseAdmin().storage.from(KYC_BUCKET),
    filePath,
    { bucket: KYC_BUCKET, operation, ownerId },
  );
}

async function failCleanScanJob(uploadId: string, ownerId: string, code: string) {
  return getSupabaseAdmin()
    .from('upload_scan_jobs')
    .update({
      status: 'failed',
      scanner_result_code: code,
      updated_at: new Date().toISOString(),
    })
    .eq('id', uploadId)
    .eq('actor_id', ownerId)
    .eq('status', 'clean');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: sellerProfiles } = await supabase
      .from('profiles_seller')
      .select('id, verification_status')
      .eq('id', user.id)
      .limit(1);
    const sellerProfile = sellerProfiles?.[0] ?? null;

    if (!sellerProfile) {
      return NextResponse.json({ error: 'Seller capability required' }, { status: 403 });
    }

    const body = (await request.json()) as {
      documentType?: string;
      filePath?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    };

    const documentType = sanitizeInput(body.documentType ?? '') as DocumentType;
    const fileName = sanitizeInput(body.fileName ?? '');
    const filePath = typeof body.filePath === 'string' ? body.filePath : null;

    if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    if (!fileName || !filePath) {
      return NextResponse.json(
        { error: 'Document type, verified file path, and file name are required' },
        { status: 400 },
      );
    }

    const requiredPrefix = `${user.id}/${documentType}/`;
    if (!filePath.startsWith(requiredPrefix) || filePath.includes('..') || filePath.includes('\\')) {
      return NextResponse.json({ error: 'Invalid KYC storage path' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: existing } = await admin
      .from('kyc_documents')
      .select('id')
      .eq('seller_id', user.id)
      .eq('file_path', filePath)
      .limit(1);

    if (existing?.length) {
      return NextResponse.json(
        { error: 'This KYC upload is already registered', documentId: existing[0].id },
        { status: 409 },
      );
    }

    const { data: scanJobData, error: scanJobError } = await admin
      .from('upload_scan_jobs')
      .select('id, status, destination_path, verified_mime, byte_size, sha256')
      .eq('actor_id', user.id)
      .eq('purpose', 'kyc')
      .eq('destination_bucket', KYC_BUCKET)
      .eq('destination_path', filePath)
      .maybeSingle();
    const scanJob = scanJobData as CleanKycScanJob | null;

    if (scanJobError || !scanJob) {
      return NextResponse.json(
        { error: 'KYC registration requires a verified clean upload scan' },
        { status: 409 },
      );
    }
    if (scanJob.status !== 'clean') {
      return NextResponse.json(
        { error: 'KYC upload is not available for registration', uploadStatus: scanJob.status },
        { status: 409 },
      );
    }
    if (!scanJob.verified_mime || !scanJob.byte_size || !scanJob.sha256) {
      await failCleanScanJob(scanJob.id, user.id, 'clean_scan_evidence_missing');
      await deleteRejectedUpload(filePath, user.id, 'reject-kyc-missing-scan-evidence');
      return NextResponse.json({ error: 'KYC scan evidence is incomplete' }, { status: 409 });
    }

    const { data: blob, error: downloadError } = await admin.storage
      .from(KYC_BUCKET)
      .download(filePath);

    if (downloadError || !blob) {
      await failCleanScanJob(scanJob.id, user.id, 'promoted_kyc_object_missing');
      await reportOperationalError(
        'storage.kyc.object_verification_failed',
        downloadError ?? 'promoted KYC object was not returned',
        {
          component: 'storage',
          operation: 'download-promoted-kyc-for-registration',
          bucket: KYC_BUCKET,
          route: '/api/kyc/documents',
          actorId: user.id,
          recordId: scanJob.id,
        },
      );
      return NextResponse.json(
        { error: 'Verified KYC object was not found' },
        { status: 409 },
      );
    }

    if (blob.size <= 0 || blob.size > MAX_FILE_SIZE) {
      await failCleanScanJob(scanJob.id, user.id, 'post_scan_size_mismatch');
      await deleteRejectedUpload(filePath, user.id, 'reject-post-scan-kyc-size');
      return NextResponse.json({ error: 'Verified KYC object failed integrity verification' }, { status: 409 });
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const validated = validateUploadedBytes(bytes, {
      maxBytes: MAX_FILE_SIZE,
      declaredMime: scanJob.verified_mime,
    });
    const digest = sha256Hex(bytes);
    if (
      !validated ||
      validated.size !== scanJob.byte_size ||
      validated.mimeType !== scanJob.verified_mime ||
      digest !== scanJob.sha256
    ) {
      await failCleanScanJob(scanJob.id, user.id, 'post_scan_integrity_mismatch');
      await deleteRejectedUpload(filePath, user.id, 'reject-post-scan-kyc-integrity');
      await reportOperationalError('storage.kyc.post_scan_integrity_mismatch', 'promoted KYC bytes changed after scan', {
        component: 'storage',
        operation: 'verify-promoted-kyc-integrity',
        bucket: KYC_BUCKET,
        route: '/api/kyc/documents',
        actorId: user.id,
        recordId: scanJob.id,
      });
      return NextResponse.json({ error: 'Verified KYC object failed integrity verification' }, { status: 409 });
    }

    // Registration and cleanup race on the same clean state. Claiming
    // clean -> registering before creating the document guarantees that only
    // one path can win; discard uses clean -> failed.
    const { data: claimed, error: claimError } = await admin
      .from('upload_scan_jobs')
      .update({ status: 'registering', updated_at: new Date().toISOString() })
      .eq('id', scanJob.id)
      .eq('actor_id', user.id)
      .eq('status', 'clean')
      .select('id')
      .maybeSingle();

    if (claimError) {
      await reportOperationalError('storage.kyc.registration_claim_failed', claimError, {
        component: 'storage',
        operation: 'claim-clean-kyc-registration',
        bucket: KYC_BUCKET,
        route: '/api/kyc/documents',
        actorId: user.id,
        recordId: scanJob.id,
      });
      return NextResponse.json({ error: 'Unable to claim KYC upload for registration' }, { status: 500 });
    }
    if (!claimed) {
      return NextResponse.json({ error: 'KYC upload is already being registered or discarded' }, { status: 409 });
    }

    const documentId = randomUUID();
    const { data: document, error: insertError } = await admin
      .from('kyc_documents')
      .insert({
        id: documentId,
        seller_id: user.id,
        document_type: documentType,
        file_path: filePath,
        file_name: fileName,
        file_size: validated.size,
        mime_type: validated.mimeType,
        verification_status: 'pending',
        upload_scan_job_id: scanJob.id,
      })
      .select()
      .single();

    if (insertError) {
      await admin
        .from('upload_scan_jobs')
        .update({
          status: 'failed',
          scanner_result_code: 'kyc_registration_insert_failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', scanJob.id)
        .eq('actor_id', user.id)
        .eq('status', 'registering');
      await deleteRejectedUpload(filePath, user.id, 'rollback-kyc-registration');
      await reportOperationalError('storage.kyc.registration_failed', insertError, {
        component: 'storage',
        operation: 'register-kyc-document',
        bucket: KYC_BUCKET,
        route: '/api/kyc/documents',
        actorId: user.id,
        recordId: scanJob.id,
      });
      return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 });
    }

    const registeredAt = new Date().toISOString();
    const { data: registeredJob, error: registrationFinalizeError } = await admin
      .from('upload_scan_jobs')
      .update({
        status: 'registered',
        registered_at: registeredAt,
        registered_record_id: documentId,
        updated_at: registeredAt,
      })
      .eq('id', scanJob.id)
      .eq('actor_id', user.id)
      .eq('status', 'registering')
      .select('id')
      .maybeSingle();

    if (registrationFinalizeError || !registeredJob) {
      await admin.from('kyc_documents').delete().eq('id', documentId).eq('seller_id', user.id);
      await admin
        .from('upload_scan_jobs')
        .update({
          status: 'failed',
          scanner_result_code: 'kyc_registration_finalize_failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', scanJob.id)
        .eq('actor_id', user.id)
        .eq('status', 'registering');
      await deleteRejectedUpload(filePath, user.id, 'rollback-unrecorded-kyc-registration');
      await reportOperationalError(
        'storage.kyc.registration_ledger_finalize_failed',
        registrationFinalizeError ?? 'registration state did not transition',
        {
          component: 'storage',
          operation: 'finalize-kyc-registration-ledger',
          bucket: KYC_BUCKET,
          route: '/api/kyc/documents',
          actorId: user.id,
          recordId: scanJob.id,
        },
      );
      return NextResponse.json({ error: 'Failed to finalize document registration' }, { status: 500 });
    }

    const { data: verificationRequest } = await admin
      .from('kyc_verification_requests')
      .select('id, required_documents, submitted_documents')
      .eq('seller_id', user.id)
      .maybeSingle();

    if (verificationRequest) {
      const submitted = Array.from(
        new Set([...(verificationRequest.submitted_documents ?? []), documentType]),
      );
      const required = verificationRequest.required_documents ?? [];
      const isComplete = required.every((item: string) => submitted.includes(item));
      const requestStatus = isComplete ? 'under_review' : 'incomplete';
      const capabilityStatus = isComplete ? 'under_review' : 'pending';

      const { error: updateError } = await admin
        .from('kyc_verification_requests')
        .update({ submitted_documents: submitted, verification_status: requestStatus })
        .eq('id', verificationRequest.id);

      if (updateError) {
        await reportOperationalError('kyc.verification_request_update_failed', updateError, {
          component: 'kyc',
          operation: 'update-verification-request',
          route: '/api/kyc/documents',
          actorId: user.id,
          recordId: verificationRequest.id,
        });
      } else {
        if (!['verified', 'suspended'].includes(sellerProfile.verification_status)) {
          const { error: sellerStatusError } = await admin
            .from('profiles_seller')
            .update({
              verification_status: capabilityStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          if (sellerStatusError) {
            await reportOperationalError('kyc.seller_lifecycle_update_failed', sellerStatusError, {
              component: 'kyc',
              operation: 'update-seller-verification-lifecycle',
              route: '/api/kyc/documents',
              actorId: user.id,
            });
          }
        }

        const { data: businessProfile } = await admin
          .from('profiles_business')
          .select('verification_status')
          .eq('id', user.id)
          .maybeSingle();
        if (
          businessProfile &&
          !['verified', 'suspended'].includes(businessProfile.verification_status)
        ) {
          const { error: businessStatusError } = await admin
            .from('profiles_business')
            .update({
              verification_status: capabilityStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          if (businessStatusError) {
            await reportOperationalError('kyc.business_lifecycle_update_failed', businessStatusError, {
              component: 'kyc',
              operation: 'update-business-verification-lifecycle',
              route: '/api/kyc/documents',
              actorId: user.id,
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error) {
    await reportOperationalError('kyc.document_registration_route_failed', error, {
      component: 'kyc',
      operation: 'register-kyc-document',
      route: '/api/kyc/documents',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
