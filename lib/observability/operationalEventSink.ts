import { logOperationalError, type OperationalErrorContext, type OperationalEventRecord } from '@/lib/observability/operationalEvent'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

function bounded(value: string | number | undefined, maxLength: number) {
  if (typeof value === 'number') return String(value).slice(0, maxLength)
  if (typeof value === 'string') return value.slice(0, maxLength)
  return null
}

function boundedStatus(value: string | number | undefined) {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(numeric) && numeric >= 100 && numeric <= 599 ? numeric : null
}

export async function persistOperationalEventBestEffort(record: OperationalEventRecord): Promise<boolean> {
  try {
    const { error } = await getSupabaseAdmin().rpc('record_operational_event', {
      p_event: record.event,
      p_component: record.component,
      p_operation: record.operation,
      p_severity: record.severity,
      p_bucket: bounded(record.bucket, 100),
      p_route: bounded(record.route, 240),
      p_actor_fingerprint: bounded(record.actorFingerprint, 16),
      p_record_fingerprint: bounded(record.recordFingerprint, 16),
      p_error_code: bounded(record.errorCode, 120),
      p_error_status: boundedStatus(record.errorStatus),
    })

    if (error) {
      logOperationalError('observability.operational_event_persist_failed', error, {
        component: 'observability',
        operation: 'persist-operational-event',
        severity: 'warning',
      })
      return false
    }

    return true
  } catch (error) {
    logOperationalError('observability.operational_event_persist_threw', error, {
      component: 'observability',
      operation: 'persist-operational-event',
      severity: 'warning',
    })
    return false
  }
}

export async function reportOperationalError(
  event: string,
  error: unknown,
  context: OperationalErrorContext,
): Promise<OperationalEventRecord> {
  const record = logOperationalError(event, error, context)
  await persistOperationalEventBestEffort(record)
  return record
}
