"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

type CompanyType = "brand" | "supplier" | "manufacturer";

export async function upsertBSMProfile(input: {
  company_name: string;
  company_type: CompanyType;
  country?: string;
  website?: string;
  logo_url?: string;
  banner_url?: string;
  categories?: string[];
}) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error("Not authenticated");

  const { error } = await supabase.from("bsm_profile").upsert(
    {
      id: user.id,
      company_name: input.company_name,
      company_type: input.company_type,
      country: input.country ?? null,
      website: input.website ?? null,
      logo_url: input.logo_url ?? null,
      banner_url: input.banner_url ?? null,
      categories: input.categories ?? [],
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(error.message);
  revalidatePath("/bsm/profile");
}
