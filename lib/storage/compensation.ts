import { createHash } from 'node:crypto'

export type StorageRemovalResult = { error: unknown | null }

export type StorageObjectRemover = {
  remove(paths: string[]): Promise<StorageRemovalResult>
}

export type StorageCleanupContext = {
  bucket: string
  operation: string
  ownerId?: string
  recordId?: string
}

export type StorageCleanupLogger = (
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

function fingerprint(value: string | undefined) {
  if (!value) return undefined
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: redactText(error.name),
      errorMessage: redactText(error.message),
    }
  }

  if (typeof error === 'string') {
    return { errorMessage: redactText(error) }
  }

  return { errorMessage: 'storage provider returned an unknown error' }
}

const defaultLogger: StorageCleanupLogger = (message, details) => {
  console.error('EntizNetStore operational error', {
    event: message === 'Storage compensation threw'
      ? 'storage.compensation.threw'
      : 'storage.compensation.failed',
    component: 'storage',
    operation: typeof details.operation === 'string' ? details.operation : 'compensate-object',
    bucket: typeof details.bucket === 'string' ? details.bucket : undefined,
    actorFingerprint: fingerprint(typeof details.ownerId === 'string' ? details.ownerId : undefined),
    recordFingerprint: fingerprint(
      typeof details.recordId === 'string'
        ? details.recordId
        : typeof details.filePath === 'string'
          ? details.filePath
          : undefined,
    ),
    errorName: typeof details.errorName === 'string' ? redactText(details.errorName) : undefined,
    errorMessage: typeof details.errorMessage === 'string'
      ? redactText(details.errorMessage)
      : 'storage compensation failed',
  })
}

export async function removeStorageObjectBestEffort(
  remover: StorageObjectRemover,
  filePath: string,
  context: StorageCleanupContext,
  logError: StorageCleanupLogger = defaultLogger,
): Promise<boolean> {
  try {
    const { error } = await remover.remove([filePath])
    if (error) {
      logError('Storage compensation failed', {
        ...context,
        filePath,
        ...errorDetails(error),
      })
      return false
    }
    return true
  } catch (error) {
    logError('Storage compensation threw', {
      ...context,
      filePath,
      ...errorDetails(error),
    })
    return false
  }
}
