import { redirect } from 'next/navigation'

// The production seller editor lives under /dashboard/store/new and writes
// through the atomic server-side seller product API/RPC. Keep this historical
// route only as a compatibility redirect so no seller can fall back to the old
// direct-browser multi-table write flow.
export default function LegacyNewProductPage() {
  redirect('/dashboard/store/new')
}
