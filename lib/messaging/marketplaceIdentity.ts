import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type MarketplaceConversationRole =
  | "shopper"
  | "seller"
  | "business_buyer"
  | "business_supplier";

export type MarketplaceConversationIdentity = {
  id: string;
  role: MarketplaceConversationRole;
  displayName: string;
  kind: "shopper" | "seller" | "business";
  logoUrl: string | null;
  storeSlug: string | null;
  businessKind: string | null;
};

type BuyerIdentityRow = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type SellerIdentityRow = {
  id: string;
  storefront_name: string | null;
  logo_url: string | null;
  store_slug: string | null;
};

type BusinessIdentityRow = {
  id: string;
  display_name: string | null;
  logo_url: string | null;
  business_kind: string | null;
};

function safeName(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 160) : null;
}

export async function resolveMarketplaceConversationIdentities(
  participants: Array<{ id: string; role: MarketplaceConversationRole }>,
) {
  const unique = new Map<string, { id: string; role: MarketplaceConversationRole }>(
    participants.map((participant) => [participant.id, participant] as const),
  );
  const ids = [...unique.keys()];
  const result = new Map<string, MarketplaceConversationIdentity>();
  if (!ids.length) return result;

  const admin = getSupabaseAdmin();
  const roles = [...unique.values()];
  const buyerIds = roles.filter((entry) => entry.role === "shopper").map((entry) => entry.id);
  const sellerIds = roles.filter((entry) => entry.role === "seller").map((entry) => entry.id);
  const businessIds = roles
    .filter((entry) => entry.role === "business_buyer" || entry.role === "business_supplier")
    .map((entry) => entry.id);

  const [buyers, sellers, businesses] = await Promise.all([
    buyerIds.length
      ? admin
          .from("profiles_buyer")
          .select("id, display_name, first_name, last_name")
          .in("id", buyerIds)
      : Promise.resolve({ data: [] as BuyerIdentityRow[], error: null }),
    sellerIds.length
      ? admin
          .from("profiles_seller")
          .select("id, storefront_name, logo_url, store_slug")
          .in("id", sellerIds)
      : Promise.resolve({ data: [] as SellerIdentityRow[], error: null }),
    businessIds.length
      ? admin
          .from("profiles_business")
          .select("id, display_name, logo_url, business_kind")
          .in("id", businessIds)
      : Promise.resolve({ data: [] as BusinessIdentityRow[], error: null }),
  ]);

  if (buyers.error || sellers.error || businesses.error) {
    throw new Error("Unable to resolve marketplace conversation identity");
  }

  const buyerRows = (buyers.data ?? []) as BuyerIdentityRow[];
  const sellerRows = (sellers.data ?? []) as SellerIdentityRow[];
  const businessRows = (businesses.data ?? []) as BusinessIdentityRow[];
  const buyerMap = new Map<string, BuyerIdentityRow>(
    buyerRows.map((row) => [row.id, row] as const),
  );
  const sellerMap = new Map<string, SellerIdentityRow>(
    sellerRows.map((row) => [row.id, row] as const),
  );
  const businessMap = new Map<string, BusinessIdentityRow>(
    businessRows.map((row) => [row.id, row] as const),
  );

  for (const participant of roles) {
    if (participant.role === "shopper") {
      const row = buyerMap.get(participant.id);
      const fullName = safeName(`${row?.first_name ?? ""} ${row?.last_name ?? ""}`);
      result.set(participant.id, {
        id: participant.id,
        role: participant.role,
        displayName: safeName(row?.display_name) ?? fullName ?? "Marketplace shopper",
        kind: "shopper",
        logoUrl: null,
        storeSlug: null,
        businessKind: null,
      });
      continue;
    }

    if (participant.role === "seller") {
      const row = sellerMap.get(participant.id);
      result.set(participant.id, {
        id: participant.id,
        role: participant.role,
        displayName: safeName(row?.storefront_name) ?? "Marketplace seller",
        kind: "seller",
        logoUrl: typeof row?.logo_url === "string" ? row.logo_url : null,
        storeSlug: typeof row?.store_slug === "string" ? row.store_slug : null,
        businessKind: null,
      });
      continue;
    }

    const row = businessMap.get(participant.id);
    result.set(participant.id, {
      id: participant.id,
      role: participant.role,
      displayName: safeName(row?.display_name) ?? "Marketplace business",
      kind: "business",
      logoUrl: typeof row?.logo_url === "string" ? row.logo_url : null,
      storeSlug: null,
      businessKind: typeof row?.business_kind === "string" ? row.business_kind : null,
    });
  }

  return result;
}
