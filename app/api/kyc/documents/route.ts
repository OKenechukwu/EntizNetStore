import { NextRequest, NextResponse } from 'next/server';
import { logOperationalError } from '@/lib/observability/operationalEvent';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sanitizeInput } from '@/lib/security';
import { removeStorageObjectBestEffort } from '@/lib/storage/compensation';

const KYC_BUCKET = 'kyc-documents';
const VALID_DOCUMENT_TYPES = [
  'identity',
  'business_license',
  'tax_document',
  'address_proof',
  'bank_statement',
] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type DocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

type InspectedFile = {
  size: number;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
};

function pathFromSignedUploadUrl(value: string): string | null {
  try {
    const marker = `/object/upload/sign/${KYC_BUCKET}/`;
    const pathname = new URL(value).pathname;
    const index = pathname.indexOf(marker);
    if (index < 0) return null;
    return decodeURIComponent(pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

function inspectSignature(bytes: Uint8Array, size: number): InspectedFile | null {
  if (size <= 0 || size > MAX_FILE_SIZE) return null;

  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return { size, mimeType: 'application/pdf' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { size, mimeType: 'image/jpeg' };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { size, mimeType: 'image/png' };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { size, mimeType: 'image/webp' };
  }
  return null;
}

async function deleteRejectedUpload(filePath: string, ownerId: string, operation: string) {
  await removeStorageObjectBestEffort(
    getSupabaseAdmin().storage.from(KYC_BUCKET),
    filePath,
    { bucket: KYC_BUCKET, operation, ownerId },
  );
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

    const { data: sellerProfile } = await supabase
      .from('profiles_seller')
      .select('id, verification_status')
      .eq('id', user.id)
      .maybeSingle();

    if (!sellerProfile) {
      return NextResponse.json({ error: 'Seller capability required' }, { status: 403 });
    }

    const body = (await request.json()) as {
      documentType?: string;
      filePath?: string;
      uploadURL?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    };

    const documentType = sanitizeInput(body.documentType ?? '') as DocumentType;
    const fileName = sanitizeInput(body.fileName ?? '');
    const filePath = body.filePath || (body.uploadURL ? pathFromSignedUploadUrl(body.uploadURL) : null);

    if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    if (!fileName || !filePath) {
      return NextResponse.json(
        { error: 'Document type, file path, and file name are required' },
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
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'This KYC upload is already registered', documentId: existing.id },
        { status: 409 },
      );
    }

    // The browser's filename, Content-Type and claimed size are not trusted.
    // Download the private object and identify supported formats by magic bytes.
    const { data: blob, error: downloadError } = await admin.storage
      .from(KYC_BUCKET)
      .download(filePath);

    if (downloadError || !blob) {
      logOperationalError(
        'storage.kyc.object_verification_failed',
        downloadError ?? 'uploaded KYC object was not returned',
        {
          component: 'storage',
          operation: 'download-kyc-object-for-verification',
          bucket: KYC_BUCKET,
          route: '/api/kyc/documents',
          actorId: user.id,
        },
      );
      return NextResponse.json(
        { error: 'Uploaded KYC object was not found; upload must complete before registration' },
        { status: 409 },
      );
    }

    if (blob.size <= 0 || blob.size > MAX_FILE_SIZE) {
      await deleteRejectedUpload(filePath, user.id, 'reject-oversized-kyc');
      return NextResponse.json({ error: 'Uploaded file exceeds the 10MB limit' }, { status: 400 });
    }

    const signature = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const inspected = inspectSignature(signature, blob.size);
    if (!inspected) {
      await deleteRejectedUpload(filePath, user.id, 'reject-invalid-kyc-signature');
      return NextResponse.json(
        { error: 'Unsupported KYC document. Upload a real PDF, JPEG, PNG, or WebP file.' },
        { status: 400 },
      );
    }

    const { data: document, error: insertError } = await admin
      .from('kyc_documents')
      .insert({
        seller_id: user.id,
        document_type: documentType,
        file_path: filePath,
        file_name: fileName,
        file_size: inspected.size,
        mime_type: inspected.mimeType,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      await deleteRejectedUpload(filePath, user.id, 'rollback-kyc-registration');
      logOperationalError('storage.kyc.registration_failed', insertError, {
        component: 'storage',
        operation: 'register-kyc-document',
        bucket: KYC_BUCKET,
        route: '/api/kyc/documents',
        actorId: user.id,
      });
      return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 });
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
        logOperationalError('kyc.verification_request_update_failed', updateError, {
          component: 'kyc',
          operation: 'update-verification-request',
          route: '/api/kyc/documents',
          actorId: user.id,
          recordId: verificationRequest.id,
        });
      } else {
        if (!['verified', 'suspended'].includes(sellerProfile.verification_status)) {
          // Resubmission after rejection becomes actionable again. A verified or
          // suspended seller is never silently downgraded by an extra upload.
          const { error: sellerStatusError } = await admin
            .from('profiles_seller')
            .update({
              verification_status: capabilityStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
          if (sellerStatusError) {
            logOperationalError('kyc.seller_lifecycle_update_failed', sellerStatusError, {
              component: 'kyc',
              operation: 'update-seller-verification-lifecycle',
              route: '/api/kyc/documents',
              actorId: user.id,
            });
          }
        }

        // Business/BSM uses the same KYC evidence but keeps a distinct business
        // projection. Keep its lifecycle synchronized so BSM never remains
        // permanently "pending" after the shared seller verification advances.
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
            logOperationalError('kyc.business_lifecycle_update_failed', businessStatusError, {
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
    logOperationalError('kyc.document_registration_route_failed', error, {
      component: 'kyc',
      operation: 'register-kyc-document',
      route: '/api/kyc/documents',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
