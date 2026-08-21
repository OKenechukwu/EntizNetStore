import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // @ts-ignore - Next's cookies API
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          // @ts-ignore
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    },
  );
}

// Alias for compatibility
export const createClient = createServerSupabase;
