// app/dashboard/bsm/layout.tsx
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";

const allowed = new Set(["brand", "supplier", "manufacturer"]);

// Avoid static caching of auth gate
export const revalidate = 0;

export default async function BSMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await requireRole(allowed);
  if (!gate.ok) redirect(gate.redirectTo);
  return <>{children}</>;
}
