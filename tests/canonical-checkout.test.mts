import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("signed-in cart converges on the canonical server cart", async () => {
  const [cartPage, cartClient] = await Promise.all([
    source("app/cart/page.tsx"),
    source("lib/cart/client.ts"),
  ]);

  assert.match(cartPage, /loadCanonicalCartWithGuestImport\(\)/);
  assert.match(cartPage, /if \(user\?\.isBuyer\) return canonicalCart\?\.items \|\| \[\]/);
  assert.match(cartPage, /setCanonicalCart\(await setCanonicalCartItem/);
  assert.match(cartPage, /setCanonicalCart\(await removeCanonicalCartItem/);
  assert.match(cartPage, /setCanonicalCart\(await clearCanonicalCart\(\)\)/);

  assert.match(cartClient, /fetch\("\/api\/cart\/import"/);
  assert.match(
    cartClient,
    /items: guest\.map\(\(item\) => \(\{\s*productId: item\.id,\s*variantId: item\.variantId \|\| null,\s*quantity: item\.qty,/s,
  );
  assert.match(cartClient, /clearGuestCart\(\);/);
  assert.doesNotMatch(
    cartClient,
    /items: guest\.map[\s\S]{0,250}(price|subtotal|total|amount)/i,
    "guest import must not send browser prices or totals",
  );
});

test("checkout accepts only shipping-capable addresses", async () => {
  const checkout = await source("app/checkout/CheckoutClient.tsx");

  assert.match(
    checkout,
    /const shippingAddresses = rows\.filter\([\s\S]*address\.type === "shipping" \|\| address\.type === "both"[\s\S]*\);/,
  );
  assert.match(checkout, /setAddresses\(shippingAddresses\);/);
  assert.match(
    checkout,
    /shippingAddresses\.find\(\(address\) => address\.is_default\)\?\.id \|\| shippingAddresses\[0\]\?\.id \|\| null/,
  );
  assert.doesNotMatch(checkout, /setAddresses\(rows\);/);
  assert.match(checkout, /fetch\("\/api\/cart\/quote"/);
  assert.match(checkout, /body: JSON\.stringify\(\{ addressId: selectedAddressId \}\)/);
});

test("payment is bound to one quote-scoped canonical checkout session", async () => {
  const payment = await source("components/payments/CartPayment.tsx");

  assert.match(payment, /const scope = `\$\{cartId\}:\$\{quoteId\}`;/);
  assert.match(payment, /const activeAttempt = attempt\?\.scope === scope \? attempt : null;/);
  assert.match(payment, /let workingAttempt = activeAttempt \|\| createAttempt\(scope\);/);
  assert.match(payment, /let sessionId = workingAttempt\.checkoutSessionId;/);
  assert.match(payment, /fetch\("\/api\/checkout\/session"/);
  assert.match(
    payment,
    /body: JSON\.stringify\(\{\s*cartId,\s*quoteId,\s*idempotencyKey: workingAttempt\.idempotencyKey,\s*\}\)/s,
  );
  assert.match(payment, /workingAttempt = \{ \.\.\.workingAttempt, checkoutSessionId: sessionId \};/);
  assert.match(payment, /fetch\("\/api\/payments\/create-intent"/);
  assert.match(
    payment,
    /body: JSON\.stringify\(\{ checkoutSessionId: sessionId \}\)/,
  );
  assert.doesNotMatch(
    payment,
    /JSON\.stringify\(\{\s*(items|amount|price|shippingAddress|address)/,
    "payment initiation must never trust browser-supplied commerce values",
  );
  assert.match(payment, /Retries keep the\s*same UUID and checkout session/);
});

test("checkout authentication return target is same-site only", async () => {
  const authCard = await source("components/auth/AuthCard.tsx");

  assert.match(authCard, /function safeInternalNext\(value: string \| null\)/);
  assert.match(authCard, /!value\.startsWith\('\/'\)/);
  assert.match(authCard, /value\.startsWith\('\/\/'\)/);
  assert.match(authCard, /value\.includes\('\\\\'\)/);
  assert.match(authCard, /if \(target\.origin !== base\.origin\) return null;/);
  assert.match(authCard, /const requestedNext = safeInternalNext\(params\.get\('next'\)\);/);
  assert.match(authCard, /router\.push\(requestedNext\);/);
});
