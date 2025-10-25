// components/cart/CartSummary.tsx
import Price from "@/components/ui/Price";
import { T } from "@/components/i18n/I18nProvider";

export default function CartSummary({
  subtotal,
  total,
}: {
  subtotal: number;
  total: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <span>
          <T k="cart.subtotal" />
        </span>
        <Price amount={subtotal} />
      </div>

      <div className="flex justify-between font-bold">
        <span>
          <T k="cart.total" />
        </span>
        <Price amount={total} />
      </div>

      <button className="mt-2 w-full rounded-lg bg-brand-secondary px-4 py-2 font-semibold text-background transition hover:opacity-90">
        <T k="cart.checkout" />
      </button>
    </div>
  );
}
