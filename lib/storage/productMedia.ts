export const PRODUCT_MEDIA_BUCKET = 'product-media'
export const PRODUCT_MEDIA_MAX_FILE_SIZE = 10 * 1024 * 1024
export const PRODUCT_MEDIA_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const

export type ProductMediaMime = (typeof PRODUCT_MEDIA_MIME_TYPES)[number]

export function productMediaPathFromPublicUrl(
  value: string,
  supabaseUrl: string,
  sellerId?: string,
): string | null {
  try {
    const url = new URL(value)
    const project = new URL(supabaseUrl)
    if (url.origin !== project.origin) return null

    const marker = `/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/`
    if (!url.pathname.startsWith(marker)) return null

    const path = decodeURIComponent(url.pathname.slice(marker.length))
    if (!path || path.includes('..') || path.includes('\\')) return null
    if (sellerId && !path.startsWith(`${sellerId}/`)) return null
    return path
  } catch {
    return null
  }
}
