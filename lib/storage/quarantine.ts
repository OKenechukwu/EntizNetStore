import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { removeStorageObjectBestEffort } from '@/lib/storage/compensation';
import { validateUploadedBytes, type ValidatedMime } from '@/lib/storage/validatedUpload';
import { scanUploadBytes, sha256Hex, type UploadScanResult } from '@/lib/storage/uploadScanner';

export const UPLOAD_QUARANTINE_BUCKET = 'upload-quarantine';
export const UPLOAD_QUARANTINE_MAX_BYTES = 15 * 1024 * 1024;

export type UploadPurpose =
  | 'product_media'
  | 'kyc'
  | 'seller_branding'
  | 'message_attachment';

export type UploadDestinationBucket =
  | 'product-media'
  | 'kyc-documents'
  | 'seller-branding'
  | 'message-attachments';

type UploadScanStatus =
  | 'pending_upload'
  | 'scanning'
  | 'clean'
  | 'registering'
  | 'registered'
  | 'blocked'
  | 'failed';

const PURPOSE_BUCKET: Record<UploadPurpose, UploadDestinationBucket> = {
  product_media: 'product-media',
  kyc: 'kyc-documents',
  seller_branding: 'seller-branding',
  message_attachment: 'message-attachments',
};

const ALLOWED_DECLARED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

type UploadScanJob = {
  id: string;
  actor_id: string;
  purpose: UploadPurpose;
  quarantine_path: string;
  destination_bucket: UploadDestinationBucket;
  destination_path: string;
  declared_mime: string;
  status: UploadScanStatus;
  verified_mime: string | null;
  byte_size: number | null;
  sha256: string | null;
  scanner: string | null;
  scanner_version: string | null;
  scanner_result_code: string | null;
};

export type QuarantineFailureKind =
  | 'not_found'
  | 'invalid_state'
  | 'missing_object'
  | 'invalid_file'
  | 'blocked'
  | 'scanner_unavailable'
  | 'promotion_failed'
  | 'ledger_failed';

export type QuarantineFinalizeResult =
  | {
      ok: true;
      uploadId: string;
      destinationBucket: UploadDestinationBucket;
      destinationPath: string;
      mimeType: ValidatedMime;
      size: number;
      sha256: string;
      scan: UploadScanResult;
    }
  | {
      ok: false;
      kind: QuarantineFailureKind;
      code: string;
    };

type TransitionResult = {
  error: unknown | null;
  transitioned: boolean;
};

function normalizedDeclaredMime(value: string) {
  return value.trim().toLowerCase();
}

export function extensionForUploadMime(value: string) {
  switch (normalizedDeclaredMime(value)) {
    case 'application/pdf':
      return '.pdf';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    default:
      return '';
  }
}

function validOwnedPath(path: string, actorId: string) {
  return (
    path.startsWith(`${actorId}/`) &&
    !path.includes('..') &&
    !path.includes('\\') &&
    !/[\u0000-\u001f\u007f]/.test(path) &&
    path.length <= 500
  );
}

function validateInit(input: {
  actorId: string;
  purpose: UploadPurpose;
  destinationBucket: UploadDestinationBucket;
  destinationPath: string;
  fileSize: number;
  mimeType: string;
  maxBytes: number;
}) {
  const mimeType = normalizedDeclaredMime(input.mimeType);
  if (!ALLOWED_DECLARED_MIME.has(mimeType)) throw new Error('unsupported_upload_mime');
  if (
    !Number.isInteger(input.fileSize) ||
    input.fileSize <= 0 ||
    input.fileSize > input.maxBytes ||
    input.fileSize > UPLOAD_QUARANTINE_MAX_BYTES
  ) {
    throw new Error('invalid_upload_size');
  }
  if (PURPOSE_BUCKET[input.purpose] !== input.destinationBucket) {
    throw new Error('invalid_upload_destination');
  }
  if (!validOwnedPath(input.destinationPath, input.actorId)) {
    throw new Error('invalid_upload_destination_path');
  }
  return mimeType;
}

async function createJob(input: {
  actorId: string;
  purpose: UploadPurpose;
  destinationBucket: UploadDestinationBucket;
  destinationPath: string;
  fileSize: number;
  mimeType: string;
  maxBytes: number;
}) {
  const mimeType = validateInit(input);
  const uploadId = randomUUID();
  const quarantinePath = `${input.actorId}/${input.purpose}/${uploadId}${extensionForUploadMime(mimeType)}`;
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('upload_scan_jobs').insert({
    id: uploadId,
    actor_id: input.actorId,
    purpose: input.purpose,
    quarantine_path: quarantinePath,
    destination_bucket: input.destinationBucket,
    destination_path: input.destinationPath,
    declared_mime: mimeType,
    status: 'pending_upload',
  });
  if (error) throw new Error('upload_scan_job_create_failed');
  return { uploadId, quarantinePath, mimeType };
}

async function transitionJob(
  uploadId: string,
  actorId: string,
  expectedStatus: UploadScanStatus,
  patch: Record<string, unknown>,
): Promise<TransitionResult> {
  const { data, error } = await getSupabaseAdmin()
    .from('upload_scan_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', uploadId)
    .eq('actor_id', actorId)
    .eq('status', expectedStatus)
    .select('id')
    .maybeSingle();

  return {
    error: error ?? null,
    transitioned: Boolean(data?.id),
  };
}

async function removeQuarantine(path: string, actorId: string, uploadId: string, operation: string) {
  return removeStorageObjectBestEffort(
    getSupabaseAdmin().storage.from(UPLOAD_QUARANTINE_BUCKET),
    path,
    {
      bucket: UPLOAD_QUARANTINE_BUCKET,
      operation,
      ownerId: actorId,
      recordId: uploadId,
    },
  );
}

function transitionFailure(result: TransitionResult, status: UploadScanStatus): QuarantineFinalizeResult | null {
  if (result.error) {
    return { ok: false, kind: 'ledger_failed', code: 'scan_ledger_update_failed' };
  }
  if (!result.transitioned) {
    return { ok: false, kind: 'invalid_state', code: `upload_scan_job_not_${status}` };
  }
  return null;
}

export async function initializeSignedQuarantineUpload(input: {
  actorId: string;
  purpose: UploadPurpose;
  destinationBucket: UploadDestinationBucket;
  destinationPath: string;
  fileSize: number;
  mimeType: string;
  maxBytes: number;
}) {
  const job = await createJob(input);
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from(UPLOAD_QUARANTINE_BUCKET)
    .createSignedUploadUrl(job.quarantinePath);

  if (error || !data?.signedUrl) {
    await transitionJob(job.uploadId, input.actorId, 'pending_upload', {
      status: 'failed',
      scanner: 'configuration',
      scanner_result_code: 'signed_upload_init_failed',
    });
    throw new Error('signed_quarantine_upload_init_failed');
  }

  return {
    uploadId: job.uploadId,
    uploadURL: data.signedUrl,
    token: data.token,
    method: 'PUT' as const,
  };
}

export async function finalizeQuarantinedUpload(input: {
  uploadId: string;
  actorId: string;
  maxBytes: number;
  imagesOnly?: boolean;
}): Promise<QuarantineFinalizeResult> {
  const admin = getSupabaseAdmin();
  const { data, error: jobError } = await admin
    .from('upload_scan_jobs')
    .select(
      'id, actor_id, purpose, quarantine_path, destination_bucket, destination_path, declared_mime, status, verified_mime, byte_size, sha256, scanner, scanner_version, scanner_result_code',
    )
    .eq('id', input.uploadId)
    .eq('actor_id', input.actorId)
    .maybeSingle();
  const job = data as UploadScanJob | null;

  if (jobError || !job) {
    return { ok: false, kind: 'not_found', code: 'upload_scan_job_not_found' };
  }

  if (job.status === 'clean' && job.verified_mime && job.byte_size && job.sha256) {
    return {
      ok: true,
      uploadId: job.id,
      destinationBucket: job.destination_bucket,
      destinationPath: job.destination_path,
      mimeType: job.verified_mime as ValidatedMime,
      size: job.byte_size,
      sha256: job.sha256,
      scan: {
        verdict: 'clean',
        scanner: job.scanner || 'unknown',
        version: job.scanner_version || undefined,
        code: job.scanner_result_code || 'clean',
      },
    };
  }

  if (job.status !== 'pending_upload') {
    return { ok: false, kind: 'invalid_state', code: `upload_scan_job_${job.status}` };
  }

  const quarantine = admin.storage.from(UPLOAD_QUARANTINE_BUCKET);
  const { data: blob, error: downloadError } = await quarantine.download(job.quarantine_path);
  if (downloadError || !blob) {
    const transition = await transitionJob(job.id, input.actorId, 'pending_upload', {
      status: 'failed',
      scanner: 'storage',
      scanner_result_code: 'quarantine_object_missing',
    });
    const failed = transitionFailure(transition, 'pending_upload');
    if (failed) return failed;
    return { ok: false, kind: 'missing_object', code: 'quarantine_object_missing' };
  }

  if (blob.size <= 0 || blob.size > input.maxBytes || blob.size > UPLOAD_QUARANTINE_MAX_BYTES) {
    const transition = await transitionJob(job.id, input.actorId, 'pending_upload', {
      status: 'blocked',
      scanner: 'byte-validator',
      scanner_result_code: 'invalid_file_size',
    });
    const failed = transitionFailure(transition, 'pending_upload');
    if (failed) return failed;
    await removeQuarantine(job.quarantine_path, input.actorId, job.id, 'reject-invalid-quarantine-size');
    return { ok: false, kind: 'invalid_file', code: 'invalid_file_size' };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const validated = validateUploadedBytes(bytes, {
    maxBytes: input.maxBytes,
    imagesOnly: input.imagesOnly,
    declaredMime: job.declared_mime,
  });
  if (!validated) {
    const transition = await transitionJob(job.id, input.actorId, 'pending_upload', {
      status: 'blocked',
      scanner: 'byte-validator',
      scanner_result_code: 'magic_bytes_or_mime_mismatch',
    });
    const failed = transitionFailure(transition, 'pending_upload');
    if (failed) return failed;
    await removeQuarantine(job.quarantine_path, input.actorId, job.id, 'reject-invalid-quarantine-bytes');
    return { ok: false, kind: 'invalid_file', code: 'magic_bytes_or_mime_mismatch' };
  }

  const sha256 = sha256Hex(validated.bytes);
  const scanningTransition = await transitionJob(job.id, input.actorId, 'pending_upload', {
    status: 'scanning',
    verified_mime: validated.mimeType,
    byte_size: validated.size,
    sha256,
  });
  const scanningFailure = transitionFailure(scanningTransition, 'pending_upload');
  if (scanningFailure) return scanningFailure;

  const scan = await scanUploadBytes(validated.bytes, {
    mimeType: validated.mimeType,
    sha256,
  });
  if (scan.verdict !== 'clean') {
    const blocked = scan.verdict === 'blocked';
    const terminalTransition = await transitionJob(job.id, input.actorId, 'scanning', {
      status: blocked ? 'blocked' : 'failed',
      scanner: scan.scanner,
      scanner_version: scan.version || null,
      scanner_result_code: scan.code,
      scanned_at: new Date().toISOString(),
    });
    const terminalFailure = transitionFailure(terminalTransition, 'scanning');
    if (terminalFailure) return terminalFailure;
    await removeQuarantine(
      job.quarantine_path,
      input.actorId,
      job.id,
      blocked ? 'remove-blocked-quarantine-object' : 'remove-unscanned-quarantine-object',
    );
    return {
      ok: false,
      kind: blocked ? 'blocked' : 'scanner_unavailable',
      code: scan.code,
    };
  }

  const destination = admin.storage.from(job.destination_bucket);
  const { error: promoteError } = await destination.upload(job.destination_path, validated.bytes, {
    contentType: validated.mimeType,
    upsert: false,
    cacheControl: job.destination_bucket === 'product-media' || job.destination_bucket === 'seller-branding'
      ? '3600'
      : 'private, max-age=0',
  });
  if (promoteError) {
    const failureTransition = await transitionJob(job.id, input.actorId, 'scanning', {
      status: 'failed',
      scanner: scan.scanner,
      scanner_version: scan.version || null,
      scanner_result_code: 'destination_promotion_failed',
      scanned_at: new Date().toISOString(),
    });
    const failed = transitionFailure(failureTransition, 'scanning');
    if (failed) return failed;
    await removeQuarantine(job.quarantine_path, input.actorId, job.id, 'rollback-failed-promotion');
    return { ok: false, kind: 'promotion_failed', code: 'destination_promotion_failed' };
  }

  const now = new Date().toISOString();
  const cleanTransition = await transitionJob(job.id, input.actorId, 'scanning', {
    status: 'clean',
    scanner: scan.scanner,
    scanner_version: scan.version || null,
    scanner_result_code: scan.code,
    scanned_at: now,
    promoted_at: now,
  });
  if (cleanTransition.error || !cleanTransition.transitioned) {
    await removeStorageObjectBestEffort(destination, job.destination_path, {
      bucket: job.destination_bucket,
      operation: 'rollback-unrecorded-clean-promotion',
      ownerId: input.actorId,
      recordId: job.id,
    });
    await removeQuarantine(job.quarantine_path, input.actorId, job.id, 'rollback-unrecorded-clean-quarantine');
    return { ok: false, kind: 'ledger_failed', code: 'clean_ledger_update_failed' };
  }

  await removeQuarantine(job.quarantine_path, input.actorId, job.id, 'remove-clean-quarantine-object');

  return {
    ok: true,
    uploadId: job.id,
    destinationBucket: job.destination_bucket,
    destinationPath: job.destination_path,
    mimeType: validated.mimeType,
    size: validated.size,
    sha256,
    scan,
  };
}

export async function quarantineAndFinalizeServerFile(input: {
  actorId: string;
  purpose: UploadPurpose;
  destinationBucket: UploadDestinationBucket;
  destinationPath: string;
  file: File;
  maxBytes: number;
  imagesOnly?: boolean;
}) {
  const job = await createJob({
    actorId: input.actorId,
    purpose: input.purpose,
    destinationBucket: input.destinationBucket,
    destinationPath: input.destinationPath,
    fileSize: input.file.size,
    mimeType: input.file.type,
    maxBytes: input.maxBytes,
  });

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const { error: quarantineError } = await getSupabaseAdmin()
    .storage
    .from(UPLOAD_QUARANTINE_BUCKET)
    .upload(job.quarantinePath, bytes, {
      contentType: job.mimeType,
      upsert: false,
      cacheControl: 'private, max-age=0',
    });

  if (quarantineError) {
    await transitionJob(job.uploadId, input.actorId, 'pending_upload', {
      status: 'failed',
      scanner: 'storage',
      scanner_result_code: 'quarantine_upload_failed',
    });
    return {
      ok: false as const,
      kind: 'promotion_failed' as const,
      code: 'quarantine_upload_failed',
    };
  }

  return finalizeQuarantinedUpload({
    uploadId: job.uploadId,
    actorId: input.actorId,
    maxBytes: input.maxBytes,
    imagesOnly: input.imagesOnly,
  });
}
