// ---------- components/product/PromoBadges.tsx ----------
"use client";


export default function PromoBadges({
discountLabel,
voucherLabel,
}: { discountLabel?: string; voucherLabel?: string }) {
if (!discountLabel && !voucherLabel) return null;
return (
<div className="mb-3 flex flex-wrap gap-2">
{discountLabel && (
<span className="rounded-md bg-red-600/10 px-2 py-1 text-xs font-semibold text-red-700">{discountLabel}</span>
)}
{voucherLabel && (
<span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700">{voucherLabel}</span>
)}
</div>
);
}