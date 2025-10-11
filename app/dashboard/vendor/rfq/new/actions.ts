"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export async function createRFQ(formData: FormData) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error("Not authenticated");

  const bsmId = String(formData.get("bsm_id") || "");
  const title = String(formData.get("title") || "");
  const details = String(formData.get("details") || "");
  const quantity = Number(formData.get("quantity") || 0);
  const targetPrice = formData.get("target_price")
    ? Number(formData.get("target_price"))
    : null;
  const currency = String(formData.get("currency") || "USD");
  const deliveryTerms = String(formData.get("delivery_terms") || "");
  const deliveryDeadline = String(formData.get("delivery_deadline") || "");
  const productId = String(formData.get("product_id") || "") || null;

  if (!bsmId || !title || !quantity) throw new Error("Missing required fields");

  const { error } = await supabase.from("rfq").insert({
    vendor_id: user.id,
    bsm_id: bsmId,
    product_id: productId || null,
    title,
    details: details || null,
    quantity,
    target_price: targetPrice,
    currency,
    delivery_terms: deliveryTerms || null,
    delivery_deadline: deliveryDeadline || null,
    attachments: [], // upgrade later
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/vendor/rfq");
  return { ok: true };
}
