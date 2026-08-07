// Integration check: live-data click-throughs against the Neon-backed app.
// Usage: node scripts/verify-live-db.mjs [baseUrl]
const base = process.argv[2] || "http://localhost:5000";
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failures++;
};
const getJson = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

// 1) Search returns live products with slugs and seller ids
const searchRes = await fetch(`${base}/api/search/products`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ marketplace_brand: "" }),
});
const search = (await getJson(searchRes)) ?? {};
const products = Array.isArray(search.products) ? search.products : [];
ok(searchRes.ok && products.length > 0, "search returns live products");

const first = products[0];
ok(Boolean(first?.slug), "search result has a product slug");

// 2) Search click-through: product detail page renders the product
if (first?.slug) {
  const detailRes = await fetch(`${base}/products/${first.slug}`);
  const detailHtml = detailRes.ok ? await detailRes.text() : "";
  ok(detailRes.ok, `product detail /products/${first.slug} returns 200`);
  ok(
    detailHtml.includes(first.title ?? first.name ?? ""),
    "product detail page shows product title"
  );
} else {
  ok(false, "cannot test product detail without a slug");
}

// 3) /store marketplace page renders (live listing source is the same search API)
const storeRes = await fetch(`${base}/store`);
ok(storeRes.ok, "/store marketplace page returns 200");

// 4) Storefront lookup by seller UUID discovered from live data
const sellerId = products.find((p) => p.seller_id)?.seller_id;
ok(Boolean(sellerId), "search results include a seller id");
if (sellerId) {
  const sfIdRes = await fetch(`${base}/api/storefront/${sellerId}`);
  const sfId = (await getJson(sfIdRes)) ?? {};
  ok(
    sfIdRes.ok && Array.isArray(sfId.products) && sfId.products.length > 0,
    "storefront by seller UUID returns products"
  );
  const sfProduct = sfId.products?.[0];
  ok(Boolean(sfProduct?.slug), "storefront product rows include slug for /products links");

  // 5) Storefront lookup by derived store slug
  const derivedSlug = (sfId.seller?.storefront_name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (derivedSlug) {
    const sfSlugRes = await fetch(
      `${base}/api/storefront/${encodeURIComponent(derivedSlug)}`
    );
    const sfSlug = (await getJson(sfSlugRes)) ?? {};
    ok(
      sfSlugRes.ok && sfSlug.seller?.id === sfId.seller?.id,
      `storefront resolves derived slug "${derivedSlug}"`
    );
  }

  // 6) Storefront product click-through
  if (sfProduct?.slug) {
    const sfDetailRes = await fetch(`${base}/products/${sfProduct.slug}`);
    ok(sfDetailRes.ok, `storefront click-through /products/${sfProduct.slug} returns 200`);
  }
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
