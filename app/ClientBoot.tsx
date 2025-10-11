"use client";

import { useEnsureRoleMetadata } from "@/hooks/useEnsureRoleMetadata";

export default function ClientBoot({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensures user.user_metadata.role is present ASAP after session loads
  useEnsureRoleMetadata();
  return <>{children}</>;
}
