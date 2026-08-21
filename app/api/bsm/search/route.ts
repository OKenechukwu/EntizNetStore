import { NextResponse } from "next/server";
import { createServerSupabase as supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  const supabase = await supabaseServer();
  let query = supabase.from("bsm_directory").select("*").limit(50);

  if (q) query = query.ilike("company_name", `%${q}%`);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data });
}
