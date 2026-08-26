import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh the request's Supabase auth session and return the response carrying
 * any rotated cookies. This function deliberately does not perform route-level
 * authorization; public/protected access remains enforced by the existing
 * trusted route/page boundaries.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );

          // The pinned @supabase/ssr release predates the newer setAll(...,
          // headers) callback. Preserve the same cache-safety invariant
          // explicitly whenever auth cookies are rotated.
          response.headers.set("Cache-Control", "private, no-store, max-age=0");
          response.headers.set("Pragma", "no-cache");
          response.headers.set("Expires", "0");
        },
      },
    },
  );

  // Validate/refresh the token immediately after creating the SSR client. The
  // proxy never trusts getSession() for authorization decisions.
  await supabase.auth.getClaims();

  return response;
}
