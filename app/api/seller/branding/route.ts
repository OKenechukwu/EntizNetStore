import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { reportOperationalError } from '@/lib/observability/operationalEventSink';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { removeStorageObjectBestEffort } from '@/lib/storage/compensation';
import {
  extensionForUploadMime,
  quarantineAndFinalizeServerFile,
} from '@/lib/storage/quarantine';

const BUCKET = 'seller-branding';
const MAX_BYTES = 5 * 1024 * 1024;
const SLOTS = ['logo', 'banner'] as const;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
type Slot = (typeof SLOTS)[number];

function storagePathFromPublicUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(url.pathname.slice(index + marker.length));
    return path && !path.includes('..') && !path.includes('\\') ? path : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: sellers } = await supabase
    .from('profiles_seller')
    .select('id, logo_url, banner_url')
    .eq('id', user.id)
    .limit(1);
  const seller = sellers?.[0] ?? null;
  if (!seller) {
    return NextResponse.json({ error: 'Seller capability required' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const slot = form.get('slot');
  if (!(file instanceof File) || typeof slot !== 'string' || !SLOTS.includes(slot as Slot)) {
    return NextResponse.json({ error: 'A branding image and valid slot are required' }, { status: 400 });
  }
  if (
    file.size <= 0 ||
    file.size > MAX_BYTES ||
    !IMAGE_MIME_TYPES.has(file.type.toLowerCase())
  ) {
    return NextResponse.json(
      { error: 'Branding images must be JPEG, PNG, or WebP files up to 5MB' },
      { status: 400 },
    );
  }

  const selectedSlot = slot as Slot;
  const filePath = `${user.id}/${selectedSlot}/${randomUUID()}${extensionForUploadMime(file.type)}`;
  const finalized = await quarantineAndFinalizeServerFile({
    actorId: user.id,
    purpose: 'seller_branding',
    destinationBucket: BUCKET,
    destinationPath: filePath,
    file,
    maxBytes: MAX_BYTES,
    imagesOnly: true,
  });

  if (!finalized.ok) {
    const status = finalized.kind === 'scanner_unavailable'
      ? 503
      : finalized.kind === 'blocked' || finalized.kind === 'invalid_file'
        ? 400
        : 500;
    if (status >= 500) {
      await reportOperationalError('storage.seller_branding.scan_or_promotion_failed', finalized.code, {
        component: 'storage',
        operation: 'scan-and-promote-branding-image',
        bucket: 'upload-quarantine',
        route: '/api/seller/branding',
        actorId: user.id,
      });
    }
    return NextResponse.json(
      {
        error: finalized.kind === 'scanner_unavailable'
          ? 'Upload safety scanner is unavailable. The branding image was not published.'
          : finalized.kind === 'blocked'
            ? 'The branding image did not pass the safety scan.'
            : finalized.kind === 'invalid_file'
              ? 'The branding image content does not match an allowed image format.'
              : 'Unable to publish branding image safely',
      },
      { status },
    );
  }

  const admin = getSupabaseAdmin();
  const storage = admin.storage.from(BUCKET);
  const publicUrl = storage.getPublicUrl(finalized.destinationPath).data.publicUrl;
  const column = selectedSlot === 'logo' ? 'logo_url' : 'banner_url';
  const previousUrl = selectedSlot === 'logo' ? seller.logo_url : seller.banner_url;
  const { error: updateError } = await admin
    .from('profiles_seller')
    .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (updateError) {
    await removeStorageObjectBestEffort(
      storage,
      finalized.destinationPath,
      { bucket: BUCKET, operation: 'rollback-branding-update', ownerId: user.id },
    );
    await reportOperationalError('storage.seller_branding.profile_update_failed', updateError, {
      component: 'storage',
      operation: 'save-branding-reference',
      bucket: BUCKET,
      route: '/api/seller/branding',
      actorId: user.id,
    });
    return NextResponse.json({ error: 'Unable to save branding image' }, { status: 500 });
  }

  const oldPath = storagePathFromPublicUrl(previousUrl);
  if (oldPath?.startsWith(`${user.id}/`)) {
    await removeStorageObjectBestEffort(
      storage,
      oldPath,
      { bucket: BUCKET, operation: 'replace-previous-branding', ownerId: user.id },
    );
  }

  return NextResponse.json({ slot: selectedSlot, url: publicUrl });
}
