import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await requireRole(["vendor"]);
  if (!gate.ok) redirect(gate.redirectTo);
  return <>{children}</>;
}
