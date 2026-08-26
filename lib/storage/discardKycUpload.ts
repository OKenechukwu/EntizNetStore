import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { abandonQuarantinedUpload } from '@/lib/storage/abandonQuarantine';
import { removeStorageObjectBestEffort } from '@/lib/storage/compensation';

export type DiscardKycUploadResult =
  | { ok: true; discarded: boolean }
  | { ok: false; code: 'not_found' | 'registered' | 'busy' | 'cleanup_failed' };

export async function discardUnregisteredKycUpload(input: {
  uploadId: string;
  actorId: string;
}): Promise<DiscardKycUploadResult> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('upload_scan_jobs')
    .select('id, purpose, destination_bucket, destination_path, status')
    .eq('id', input.uploadId)
    .eq('actor_id', input.actorId)
    .maybeSingle();

  if (error || !data || data.purpose !== 'kyc' || data.destination_bucket !== 'kyc-documents') {
    return { ok: false, code: 'not_found' };
  }

  if (data.status !== 'clean') {
    const abandoned = await abandonQuarantinedUpload(input);
    if (abandoned.ok) return { ok: true, discarded: true };
    if (abandoned.code === 'not_found') return { ok: false, code: 'not_found' };
    return { ok: false, code: 'busy' };
  }

  // A clean promoted KYC object can be discarded only before registration. Once
  // kyc_documents references the path it is review evidence and this endpoint
  // must not delete it.
  const { data: registered } = await admin
    .from('kyc_documents')
    .select('id')
    .eq('seller_id', input.actorId)
    .eq('file_path', data.destination_path)
    .limit(1);
  if (registered?.length) return { ok: false, code: 'registered' };

  const removed = await removeStorageObjectBestEffort(
    admin.storage.from('kyc-documents'),
    data.destination_path,
    {
      bucket: 'kyc-documents',
      operation: 'discard-unregistered-clean-kyc',
      ownerId: input.actorId,
      recordId: input.uploadId,
    },
  );
  if (!removed) return { ok: false, code: 'cleanup_failed' };

  const { error: updateError } = await admin
    .from('upload_scan_jobs')
    .update({
      status: 'failed',
      scanner_result_code: 'registration_abandoned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.uploadId)
    .eq('actor_id', input.actorId)
    .eq('status', 'clean');

  if (updateError) return { ok: false, code: 'cleanup_failed' };
  return { ok: true, discarded: true };
}
