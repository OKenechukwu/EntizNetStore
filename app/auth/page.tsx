// app/auth/page.tsx
import dynamic from "next/dynamic";

const AuthCard = dynamic(() => import("@/components/auth/AuthCard"), {
  ssr: false,
});

export default function AuthPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] items-center justify-center px-4">
      <AuthCard variant="combined" />
    </div>
  );
}
