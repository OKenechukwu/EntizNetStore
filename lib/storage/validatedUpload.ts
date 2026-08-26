export const SAFE_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const SAFE_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type ValidatedMime = (typeof SAFE_DOCUMENT_MIME_TYPES)[number];
export type ValidatedImageMime = (typeof SAFE_IMAGE_MIME_TYPES)[number];

export type ValidatedFile = {
  bytes: Uint8Array;
  size: number;
  mimeType: ValidatedMime;
  extension: '.pdf' | '.jpg' | '.png' | '.webp';
};

function normalizeMime(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

export function detectUploadedMime(bytes: Uint8Array): Pick<ValidatedFile, 'mimeType' | 'extension'> | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return { mimeType: 'application/pdf', extension: '.pdf' };
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: '.jpg' };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: '.png' };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: '.webp' };
  }

  return null;
}

export function validateUploadedBytes(
  bytes: Uint8Array,
  options: { maxBytes: number; imagesOnly?: boolean; declaredMime?: string },
): ValidatedFile | null {
  if (!bytes?.byteLength || bytes.byteLength > options.maxBytes) return null;

  const detected = detectUploadedMime(bytes);
  if (!detected) return null;
  if (options.imagesOnly && detected.mimeType === 'application/pdf') return null;

  const declaredMime = normalizeMime(options.declaredMime);
  if (declaredMime && declaredMime !== detected.mimeType) return null;

  return {
    bytes,
    size: bytes.byteLength,
    mimeType: detected.mimeType,
    extension: detected.extension,
  };
}

export async function validateUploadedFile(
  file: File,
  options: { maxBytes: number; imagesOnly?: boolean },
): Promise<ValidatedFile | null> {
  if (!file || file.size <= 0 || file.size > options.maxBytes) return null;

  const bytes = new Uint8Array(await file.arrayBuffer());
  return validateUploadedBytes(bytes, {
    ...options,
    declaredMime: file.type || undefined,
  });
}

export function safeOriginalFileName(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]+/g, '-')
    .trim()
    .slice(0, 180) || 'attachment';
}
