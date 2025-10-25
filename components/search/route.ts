import { NextResponse } from 'next/server';

/**
 * Replace this with your Supabase or DB query.
 * Must return: { items: { id, slug, title, description?, image }[] }
 */
const MOCK: { id: string; slug: string; title: string; description?: string; image: string }[] = [
  {
    id: 'p1',
    slug: 'premium-vibe',
    title: 'Premium Vibe',
    description: 'Silky smooth premium vibrator with multiple modes.',
    image: '/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg',
  },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').toLowerCase();
  const items = !q
    ? []
    : MOCK.filter(
        (p) =>
          p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q),
      ).slice(0, 12);

  return NextResponse.json({ items });
}
