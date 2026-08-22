import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { validateUploadedFile } from '@/lib/storage/validatedUpload';

const BUCKET = 'seller-branding';
const MAX_BYTES = 5 * 1024 * 1024;
const SLOTS = ['logo', 'banner'] as const;
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

  const { data: seller } = await supabase
    .from('profiles_seller')
    .select('id, logo_url, banner_url')
    .eq('id', user.id)
    .maybeSingle();
  if (!seller) {
    return NextResponse.json({ error: 'Seller capability required' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const slot = form.get('slot');
  if (!(file instanceof File) || typeof slot !== 'string' || !SLOTS.includes(slot as Slot)) {
    return NextResponse.json({ error: 'A branding image and valid slot are required' }, { status: 400 });
  }

  const validated = await validateUploadedFile(file, { maxBytes: MAX_BYTES, imagesOnly: true });
  if (!validated) {
    return NextResponse.json(
      { error: 'Branding images must be a real JPEG, PNG, or WebP file up to 5MB' },
      { status: 400 },
    );
  }

  const selectedSlot = slot as Slot;
  const filePath = `${user.id}/${selectedSlot}/${randomUUID()}${validated.extension}`;
  const admin = getSupabaseAdmin();
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(filePath, validated.bytes, {
    contentType: validated.mimeType,
    upsert: false,
    cacheControl: '3600',
  });

  if (uploadError) {
    console.error('Seller branding upload failed:', uploadError);
    return NextResponse.json({ error: 'Unable to upload branding image' }, { status: 500 });
  }

  const publicUrl = admin.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;
  const column = selectedSlot === 'logo' ? 'logo_url' : 'banner_url';
  const previousUrl = selectedSlot === 'logo' ? seller.logo_url : seller.banner_url;
  const { error: updateError } = await admin
    .from('profiles_seller')
    .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (updateError) {
    await admin.storage.from(BUCKET).remove([filePath]);
    console.error('Seller branding profile update failed:', updateError);
    return NextResponse.json({ error: 'Unable to save branding image' }, { status: 500 });
  }

  const oldPath = storagePathFromPublicUrl(previousUrl);
  if (oldPath?.startsWith(`${user.id}/`)) {
    await admin.storage.from(BUCKET).remove([oldPath]);
  }

  return NextResponse.json({ slot: selectedSlot, url: publicUrl });
}
