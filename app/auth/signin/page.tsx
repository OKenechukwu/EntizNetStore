import { redirect } from "next/navigation";

// Legacy route — the canonical sign-in page is /auth/sign-in.
export default function Page() {
  redirect("/auth/sign-in");
}
