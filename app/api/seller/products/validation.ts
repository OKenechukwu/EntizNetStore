import { z } from "zod";

const optionalMoney = z.number().min(0).max(1000000).nullable().default(null);
const optionalText = (max: number) => z.string().trim().max(max).default("");

const sellerVariantSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  option1: optionalText(100),
  option2: optionalText(100),
  option3: optionalText(100),
  sku: optionalText(100),
  barcode: optionalText(100),
  price: z.number().positive().max(1000000),
  compareAtPrice: z.number().positive().max(1000000).nullable().default(null),
  costPerItem: optionalMoney,
  trackInventory: z.boolean().default(true),
  inventoryQuantity: z.number().int().min(0).max(100000000),
  inventoryPolicy: z.enum(["deny", "continue"]).default("deny"),
  weightGrams: z.number().int().min(0).max(100000000).nullable().default(null),
  requiresShipping: z.boolean().default(true),
  isActive: z.boolean().default(true),
}).refine(
  (value) => value.compareAtPrice == null || value.compareAtPrice > value.price,
  { message: "Variant compare-at price must be greater than its selling price", path: ["compareAtPrice"] },
);

export const sellerProductSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(10000).default(""),
  shortDescription: optionalText(500),
  productType: z.enum(["physical", "digital"]).default("physical"),
  basePrice: z.number().positive().max(1000000),
  compareAtPrice: z.number().positive().max(1000000).nullable().default(null),
  costPerItem: optionalMoney,
  brandId: z.string().uuid().nullable().default(null),
  categoryIds: z.array(z.string().uuid()).max(10).default([]),
  mediaUrls: z.array(z.string().url()).max(10).default([]),
  variants: z.array(sellerVariantSchema).min(1).max(100),
  trackInventory: z.boolean().default(true),
  continueSelling: z.boolean().default(false),
  requiresShipping: z.boolean().default(true),
  isTaxable: z.boolean().default(true),
  weightGrams: z.number().int().min(0).max(100000000).nullable().default(null),
  material: optionalText(200),
  ageRestriction: z.number().int().min(18).max(99).default(18),
  tags: z.array(z.string().trim().min(1).max(60)).max(25).default([]),
  searchKeywords: z.array(z.string().trim().min(1).max(60)).max(25).default([]),
}).superRefine((value, ctx) => {
  if (value.compareAtPrice != null && value.compareAtPrice <= value.basePrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Compare-at price must be greater than the selling price",
      path: ["compareAtPrice"],
    });
  }
  if (value.productType === "digital" && value.requiresShipping) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Digital products cannot require shipping",
      path: ["requiresShipping"],
    });
  }
});

export type SellerProductInput = z.infer<typeof sellerProductSchema>;
