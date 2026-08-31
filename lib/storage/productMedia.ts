export const PRODUCT_MEDIA_BUCKET = 'product-media'
export const PRODUCT_MEDIA_MAX_FILE_SIZE = 10 * 1024 * 1024
export const PRODUCT_MEDIA_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const

export type ProductMediaMime = (typeof PRODUCT_MEDIA_MIME_TYPES)[number]

const PRODUCT_MEDIA_OBJECT_ID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function isOwnedProductMediaPath(value: string, sellerId: string) {
  if (!value || !sellerId) return false
  return new RegExp(
    `^${escapeRegex(sellerId)}/${PRODUCT_MEDIA_OBJECT_ID}\\.(jpg|png|webp)$`,
  ).test(value)
}

export function productMediaPathFromPublicUrl(
  value: string,
  supabaseUrl: string,
  sellerId?: string,
): string | null {
  try {
    const url = new URL(value)
    const project = new URL(supabaseUrl)
    if (url.origin !== project.origin) return null
    if (url.username || url.password || url.search || url.hash) return null

    const marker = `/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/`
    if (!url.pathname.startsWith(marker)) return null

    const encodedPath = url.pathname.slice(marker.length)
    if (!encodedPath || encodedPath.includes('%')) return null

    const path = decodeURIComponent(encodedPath)
    if (!path || path.includes('..') || path.includes('\\')) return null
    if (sellerId && !isOwnedProductMediaPath(path, sellerId)) return null
    return path
  } catch {
    return null
  }
}
