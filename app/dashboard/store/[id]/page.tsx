// app/dashboard/store/[id]/page.tsx
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

type PageProps = { params: { id: string } };

export default async function StoreItemPage({ params }: PageProps) {
  const { id } = params;

  // Protect the page (requires signed-in user)
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  // OPTIONAL: fetch product details (keeps the build happy even if this returns null)
  const { data: product } = await supabase
    .from("products")
    .select("id, title, description, price, images")
    .eq("id", id)
    .single();

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Product {id}</h1>

      {product ? (
        <div className="mt-4 space-y-2">
          <div className="text-lg font-semibold">{product.title}</div>
          {product.description && (
            <p className="text-gray-600">{product.description}</p>
          )}
          {typeof product.price === "number" && (
            <div className="text-sm text-gray-500">
              Stored price (USD): ${product.price.toFixed(2)}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-gray-600">
          No details loaded yet. {/* TODO: render edit/view form here */}
        </p>
      )}
    </main>
  );
}
