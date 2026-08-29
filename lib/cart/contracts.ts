export type PurchaseMode = "retail" | "wholesale";

export type WholesaleCartTerms = {
  offerId: string;
  tierMinimumQuantity: number;
  minimumOrderQuantity: number;
  orderMultiple: number;
  unitLabel: string;
  casePackSize: number | null;
  leadTimeDays: number;
  incoterm: string | null;
};

export type CanonicalCartItem = {
  id: string;
  productId: string;
  variantId: string;
  sellerId: string | null;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  image: string | null;
  quantity: number;
  purchaseMode: PurchaseMode;
  wholesaleTerms: WholesaleCartTerms | null;
  unitPriceCents: number;
  lineTotalCents: number;
  requiresShipping: boolean;
  isTaxable: boolean;
  available: boolean;
  availabilityReason: string | null;
  availableQuantity: number | null;
};

export type CanonicalCart = {
  id: string;
  version: number;
  status: string;
  currency: "usd";
  itemCount: number;
  subtotalCents: number;
  hasUnavailableItems: boolean;
  items: CanonicalCartItem[];
};

export type GuestCartImportResult = {
  cart: CanonicalCart | null;
  imported: number;
  rejected: Array<{ productId: string; reason: string }>;
  skipped: boolean;
};
