import type { SellerProductInput } from "./validation";

export function sellerProductRpcArgs(productId: string | null, input: SellerProductInput) {
  return {
    p_product_id: productId,
    p_title: input.title,
    p_description: input.description,
    p_short_description: input.shortDescription,
    p_product_type: input.productType,
    p_base_price: input.basePrice,
    p_compare_at_price: input.compareAtPrice,
    p_cost_per_item: input.costPerItem,
    p_brand_id: input.brandId,
    p_category_ids: input.categoryIds,
    p_media_urls: input.mediaUrls,
    p_variants: input.variants,
    p_track_inventory: input.trackInventory,
    p_continue_selling: input.continueSelling,
    p_requires_shipping: input.requiresShipping,
    p_is_taxable: input.isTaxable,
    p_weight_grams: input.weightGrams,
    p_material: input.material,
    p_age_restriction: input.ageRestriction,
    p_tags: input.tags,
    p_search_keywords: input.searchKeywords,
  };
}
