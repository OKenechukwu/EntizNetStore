// app/dashboard/store/new/page.tsx
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import NewProductForm from "./NewProductForm";
import CurrencyPicker from "@/components/CurrencyPicker";

export default async function NewProductPage() {
  const supabase = createServerSupabase();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/sign-in");
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Create New Product</h1>
          <p className="text-gray-600 mt-2">Add a new product to your store</p>
        </div>
        <CurrencyPicker />
      </div>

      <NewProductForm />
    </main>
  );
}
