// lib/auth/routeByRole.ts

export type UserRole =
  | "EntiZer"
  | "EntizNate"
  | "CreatorNet"
  | "EntizStore"
  | "buyer"
  | "seller"
  | "client"
  | "admin";

const SAFE_DEFAULT_ROUTE = "/store";

/**
 * Maps a user's role (case-insensitive, tolerant of legacy values)
 * to the correct dashboard path. Falls back to SAFE_DEFAULT_ROUTE.
 */
export function routeByRole(role?: string | null): string {
  if (!role || typeof role !== "string") return SAFE_DEFAULT_ROUTE;

  const r = role.trim().toLowerCase();

  switch (r) {
    // EntizNet roles
    case "entizer":
      return "/dashboard/provider";
    case "entiznate":
      return "/dashboard/client";
    case "creatornet":
      return "/dashboard/creator";
    case "entizstore":
      return "/dashboard/seller";

    // Legacy/alternate aliases
    case "buyer":
      return "/dashboard/buyer"; // keep legacy path for backwards-compat
    case "client":
      return "/dashboard/client";
    case "seller":
      return "/dashboard/seller";

    // Admin
    case "admin":
      return "/admin";

    // Safe fallback when role is unknown or not set yet
    default:
      return SAFE_DEFAULT_ROUTE;
  }
}
