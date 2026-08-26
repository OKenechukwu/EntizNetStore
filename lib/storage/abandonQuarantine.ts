import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { removeStorageObjectBestEffort } from '@/lib/storage/compensation';
import { UPLOAD_QUARANTINE_BUCKET } from '@/lib/storage/quarantine';

export type AbandonQuarantineResult =
  | { ok: true; abandoned: boolean }
  | { ok: false; code: 'not_found' | 'already_finalized' | 'ledger_update_failed' };

export async function abandonQuarantinedUpload(input: {
  uploadId: string;
  actorId: string;
}): Promise<AbandonQuarantineResult> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('upload_scan_jobs')
    .select('id, quarantine_path, status')
    .eq('id', input.uploadId)
    .eq('actor_id', input.actorId)
    .maybeSingle();

  if (error || !data) return { ok: false, code: 'not_found' };
  if (data.status === 'clean') return { ok: false, code: 'already_finalized' };

  // A client can intentionally abandon only an upload that has not entered the
  // scanner. Blocked/failed rows may also retain a quarantine object after a
  // provider/storage cleanup failure, so retrying deletion is safe and useful.
  if (data.status === 'scanning') return { ok: false, code: 'already_finalized' };

  await removeStorageObjectBestEffort(
    admin.storage.from(UPLOAD_QUARANTINE_BUCKET),
    data.quarantine_path,
    {
      bucket: UPLOAD_QUARANTINE_BUCKET,
      operation: 'abandon-quarantine-upload',
      ownerId: input.actorId,
      recordId: input.uploadId,
    },
  );

  if (data.status === 'pending_upload') {
    const { error: updateError } = await admin
      .from('upload_scan_jobs')
      .update({
        status: 'failed',
        scanner: 'client',
        scanner_result_code: 'upload_abandoned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.uploadId)
      .eq('actor_id', input.actorId)
      .eq('status', 'pending_upload');

    if (updateError) return { ok: false, code: 'ledger_update_failed' };
  }

  return { ok: true, abandoned: true };
}
