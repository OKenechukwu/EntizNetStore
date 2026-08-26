import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { abandonQuarantinedUpload } from '@/lib/storage/abandonQuarantine';
import { removeStorageObjectBestEffort } from '@/lib/storage/compensation';

export type DiscardKycUploadResult =
  | { ok: true; discarded: boolean }
  | { ok: false; code: 'not_found' | 'registered' | 'busy' | 'cleanup_failed' };

async function removeUnregisteredDestination(input: {
  uploadId: string;
  actorId: string;
  destinationPath: string;
}) {
  return removeStorageObjectBestEffort(
    getSupabaseAdmin().storage.from('kyc-documents'),
    input.destinationPath,
    {
      bucket: 'kyc-documents',
      operation: 'discard-unregistered-clean-kyc',
      ownerId: input.actorId,
      recordId: input.uploadId,
    },
  );
}

export async function discardUnregisteredKycUpload(input: {
  uploadId: string;
  actorId: string;
}): Promise<DiscardKycUploadResult> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('upload_scan_jobs')
    .select('id, purpose, destination_bucket, destination_path, status, scanner_result_code')
    .eq('id', input.uploadId)
    .eq('actor_id', input.actorId)
    .maybeSingle();

  if (error || !data || data.purpose !== 'kyc' || data.destination_bucket !== 'kyc-documents') {
    return { ok: false, code: 'not_found' };
  }

  if (data.status === 'registered') return { ok: false, code: 'registered' };
  if (data.status === 'registering' || data.status === 'scanning') {
    return { ok: false, code: 'busy' };
  }

  if (data.status !== 'clean') {
    // A previous clean-discard may have claimed the ledger but failed to remove
    // its promoted destination. Retrying that cleanup is safe only while the
    // path remains unregistered.
    if (
      data.status === 'failed' &&
      typeof data.scanner_result_code === 'string' &&
      data.scanner_result_code.startsWith('registration_abandoned')
    ) {
      const { data: registered } = await admin
        .from('kyc_documents')
        .select('id')
        .eq('seller_id', input.actorId)
        .eq('file_path', data.destination_path)
        .limit(1);
      if (registered?.length) return { ok: false, code: 'registered' };

      const removed = await removeUnregisteredDestination({
        uploadId: input.uploadId,
        actorId: input.actorId,
        destinationPath: data.destination_path,
      });
      if (!removed) return { ok: false, code: 'cleanup_failed' };

      await admin
        .from('upload_scan_jobs')
        .update({
          scanner_result_code: 'registration_abandoned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.uploadId)
        .eq('actor_id', input.actorId)
        .eq('status', 'failed');
      return { ok: true, discarded: true };
    }

    const abandoned = await abandonQuarantinedUpload(input);
    if (abandoned.ok) return { ok: true, discarded: true };
    if (abandoned.code === 'not_found') return { ok: false, code: 'not_found' };
    return { ok: false, code: 'busy' };
  }

  // Check for a defensive historical/reference edge first, then atomically
  // claim clean -> failed. KYC registration uses clean -> registering, so only
  // one of registration or discard can win the compare-and-set transition.
  const { data: registeredBeforeClaim } = await admin
    .from('kyc_documents')
    .select('id')
    .eq('seller_id', input.actorId)
    .eq('file_path', data.destination_path)
    .limit(1);
  if (registeredBeforeClaim?.length) return { ok: false, code: 'registered' };

  const { data: claimed, error: claimError } = await admin
    .from('upload_scan_jobs')
    .update({
      status: 'failed',
      scanner_result_code: 'registration_abandoned_cleanup_pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.uploadId)
    .eq('actor_id', input.actorId)
    .eq('status', 'clean')
    .select('id')
    .maybeSingle();

  if (claimError) return { ok: false, code: 'cleanup_failed' };
  if (!claimed) {
    const { data: current } = await admin
      .from('upload_scan_jobs')
      .select('status')
      .eq('id', input.uploadId)
      .eq('actor_id', input.actorId)
      .maybeSingle();
    if (current?.status === 'registered') return { ok: false, code: 'registered' };
    return { ok: false, code: 'busy' };
  }

  const removed = await removeUnregisteredDestination({
    uploadId: input.uploadId,
    actorId: input.actorId,
    destinationPath: data.destination_path,
  });
  if (!removed) return { ok: false, code: 'cleanup_failed' };

  const { error: updateError } = await admin
    .from('upload_scan_jobs')
    .update({
      scanner_result_code: 'registration_abandoned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.uploadId)
    .eq('actor_id', input.actorId)
    .eq('status', 'failed');

  if (updateError) return { ok: false, code: 'cleanup_failed' };
  return { ok: true, discarded: true };
}
