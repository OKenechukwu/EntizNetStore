import Price from "@/components/ui/Price";
import { T } from "@/components/i18n/I18nProvider";
// ...
<h1 className="text-2xl font-extrabold">{product.name}</h1>
<div className="mt-1 text-xl">
  <Price amount={Number(product.price ?? product.priceLabel)} />
</div>
<button className="btn-primary mt-4">
  <T k="cart.checkout" />
</button>



