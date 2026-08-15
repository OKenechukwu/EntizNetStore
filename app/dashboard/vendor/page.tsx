// app/dashboard/vendor/page.tsx
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";

// Avoid static caching of auth gate
export const revalidate = 0;

export default async function VendorDashboardPage() {
  const gate = await requireRole(["vendor"]);
  if (!gate.ok) redirect(gate.redirectTo);

  return (
    <div className="p-6 space-y-2">
      <h1 className="text-2xl font-bold">Vendor Dashboard</h1>
      <p className="text-sm opacity-70">
        Vendor tools are under development.
      </p>
    </div>
  );
}
