import { z } from "zod";

export const sellerProductSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(10000).default(""),
  basePrice: z.number().positive().max(1000000),
  compareAtPrice: z.number().positive().max(1000000).nullable().default(null),
  status: z.enum(["draft", "active"]).default("draft"),
  categoryIds: z.array(z.string().uuid()).max(10).default([]),
  mediaUrls: z.array(z.string().url()).max(10).default([]),
  variants: z.array(z.object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200),
    sku: z.string().trim().max(100).optional().default(""),
    price: z.number().positive().max(1000000),
    inventoryQuantity: z.number().int().min(0).max(100000000),
  })).min(1).max(100),
}).refine(
  (value) => value.compareAtPrice == null || value.compareAtPrice > value.basePrice,
  { message: "Compare-at price must be greater than the selling price", path: ["compareAtPrice"] },
);

export type SellerProductInput = z.infer<typeof sellerProductSchema>;
