export type OperationalHealthCandidate = {
  severity: 'warning' | 'error' | 'critical'
  errorStatus?: string | number
}

export function operationalStatusCode(value: string | number | undefined): number | null {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(numeric) && numeric >= 100 && numeric <= 599 ? numeric : null
}

/**
 * Only infrastructure/server failures should feed aggregate availability.
 * Expected client-caused 4xx outcomes remain redacted runtime diagnostics but
 * are not persisted, otherwise a user could manufacture an incident by
 * deliberately repeating an invalid or incomplete request. Explicit critical
 * events always remain observable.
 */
export function shouldPersistOperationalEvent(record: OperationalHealthCandidate): boolean {
  if (record.severity === 'critical') return true

  const status = operationalStatusCode(record.errorStatus)
  if (status !== null && status < 500) return false

  return true
}
