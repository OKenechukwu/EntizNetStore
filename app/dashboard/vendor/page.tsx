// app/dashboard/vendor/layout.tsx
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";

// Avoid static caching of auth gate
export const revalidate = 0;

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await requireRole(["vendor"]);
  if (!gate.ok) redirect(gate.redirectTo);
  return <>{children}</>;
}
