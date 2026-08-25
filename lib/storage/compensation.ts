import { logOperationalError } from '@/lib/observability/operationalEvent'

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

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message.slice(0, 500),
    }
  }

  if (typeof error === 'string') {
    return { errorMessage: error.slice(0, 500) }
  }

  return { errorMessage: 'storage provider returned an unknown error' }
}

const defaultLogger: StorageCleanupLogger = (message, details) => {
  const event = message === 'Storage compensation threw'
    ? 'storage.compensation.threw'
    : 'storage.compensation.failed'

  logOperationalError(
    event,
    {
      name: typeof details.errorName === 'string' ? details.errorName : undefined,
      message: typeof details.errorMessage === 'string'
        ? details.errorMessage
        : 'storage compensation failed',
    },
    {
      component: 'storage',
      operation: typeof details.operation === 'string' ? details.operation : 'compensate-object',
      bucket: typeof details.bucket === 'string' ? details.bucket : undefined,
      actorId: typeof details.ownerId === 'string' ? details.ownerId : undefined,
      recordId: typeof details.recordId === 'string'
        ? details.recordId
        : typeof details.filePath === 'string'
          ? details.filePath
          : undefined,
    },
  )
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
