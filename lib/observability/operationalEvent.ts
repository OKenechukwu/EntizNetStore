import { createHash } from 'node:crypto'

export type OperationalSeverity = 'warning' | 'error' | 'critical'

export type OperationalErrorContext = {
  component: string
  operation: string
  severity?: OperationalSeverity
  bucket?: string
  route?: string
  actorId?: string
  recordId?: string
}

export type OperationalEventRecord = {
  event: string
  component: string
  operation: string
  severity: OperationalSeverity
  bucket?: string
  route?: string
  actorFingerprint?: string
  recordFingerprint?: string
  errorName?: string | number
  errorMessage?: string | number
  errorCode?: string | number
  errorStatus?: string | number
}

type OperationalLogger = (
  message: string,
  details: Record<string, string | number | boolean | null | undefined>,
) => void

const QUERY_SECRET = /([?&](?:token|access_token|refresh_token|apikey|api_key|key|signature|sig)=)[^&#\s]+/gi
const BEARER_TOKEN = /(bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
const SUPABASE_KEY = /\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/gi

function redactText(value: string) {
  return value
    .slice(0, 500)
    .replace(QUERY_SECRET, '$1[REDACTED]')
    .replace(BEARER_TOKEN, '$1[REDACTED]')
    .replace(JWT, '[REDACTED_JWT]')
    .replace(SUPABASE_KEY, '[REDACTED_KEY]')
}

function safePrimitive(value: unknown): string | number | undefined {
  if (typeof value === 'string') return redactText(value)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return undefined
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: redactText(error.name || 'Error'),
      errorMessage: redactText(error.message || 'operational error'),
    }
  }

  if (typeof error === 'string') {
    return { errorMessage: redactText(error) }
  }

  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>
    return {
      errorName: safePrimitive(candidate.name),
      errorMessage: safePrimitive(candidate.message) ?? 'provider returned an operational error',
      errorCode: safePrimitive(candidate.code),
      errorStatus: safePrimitive(candidate.status) ?? safePrimitive(candidate.statusCode),
    }
  }

  return { errorMessage: 'unknown operational error' }
}

function fingerprint(value: string | undefined) {
  if (!value) return undefined
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

const defaultLogger: OperationalLogger = (message, details) => {
  console.error(message, details)
}

export function logOperationalError(
  event: string,
  error: unknown,
  context: OperationalErrorContext,
  logger: OperationalLogger = defaultLogger,
): OperationalEventRecord {
  const record: OperationalEventRecord = {
    event,
    component: context.component,
    operation: context.operation,
    severity: context.severity ?? 'error',
    bucket: context.bucket,
    route: context.route,
    actorFingerprint: fingerprint(context.actorId),
    recordFingerprint: fingerprint(context.recordId),
    ...errorDetails(error),
  }

  logger('EntizNetStore operational error', record)
  return record
}
