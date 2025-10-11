"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function upsertVendorProfile(input: {
  storefront_name: string;
  bio?: string;
  country?: string;
  min_order_budget?: number;
  interests?: string[]; // optional
}) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error("Not authenticated");

  const { error } = await supabase.from("vendor_profile").upsert(
    {
      id: user.id,
      storefront_name: input.storefront_name,
      bio: input.bio ?? null,
      country: input.country ?? null,
      min_order_budget: input.min_order_budget ?? null,
      interests: input.interests ?? [],
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(error.message);
  revalidatePath("/vendor/profile");
}
