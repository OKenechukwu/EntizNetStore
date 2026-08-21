import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  PRODUCT_MEDIA_BUCKET,
  PRODUCT_MEDIA_MAX_FILE_SIZE,
  productMediaPathFromPublicUrl,
} from '@/lib/storage/productMedia'

function isSupportedImage(bytes: Uint8Array) {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const png =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  const webp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  return jpeg || png || webp
}

export async function verifyOwnedProductMediaUrls(userId: string, urls: string[]) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return { ok: false as const, error: 'Supabase URL is not configured' }
  }

  const admin = getSupabaseAdmin()
  const paths: string[] = []

  for (const url of urls) {
    const filePath = productMediaPathFromPublicUrl(url, supabaseUrl, userId)
    if (!filePath) {
      return {
        ok: false as const,
        error: 'Every product image must be uploaded through EntizNetStore secure media storage',
      }
    }

    const { data: blob, error } = await admin.storage.from(PRODUCT_MEDIA_BUCKET).download(filePath)
    if (error || !blob) {
      return { ok: false as const, error: 'One or more product images were not found in secure storage' }
    }

    if (blob.size <= 0 || blob.size > PRODUCT_MEDIA_MAX_FILE_SIZE) {
      return { ok: false as const, error: 'Product images must be no larger than 10MB' }
    }

    const signature = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
    if (!isSupportedImage(signature)) {
      return { ok: false as const, error: 'Product media must contain a real JPEG, PNG, or WebP image' }
    }

    paths.push(filePath)
  }

  return { ok: true as const, paths }
}

export async function deleteProductMediaPaths(paths: string[]) {
  if (paths.length === 0) return
  const { error } = await getSupabaseAdmin().storage.from(PRODUCT_MEDIA_BUCKET).remove(paths)
  if (error) console.error('Unable to clean up product media objects:', error)
}
