import Price from "@/components/ui/Price";
import { T } from "@/components/i18n/I18nProvider";
// ...
<div className="flex justify-between">
  <span><T k="cart.subtotal" /></span>
  <Price amount={subtotal} />
</div>
<div className="flex justify-between font-bold">
  <span><T k="cart.total" /></span>
  <Price amount={total} />
</div>
