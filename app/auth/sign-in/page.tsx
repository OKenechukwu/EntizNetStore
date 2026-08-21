// app/auth/sign-in/page.tsx
import AuthCard from "@/components/auth/AuthCard";

export default function SignInOnlyPage() {
  return (
    <div className="mx-auto flex min-h-[80vh] items-center justify-center px-4">
      <div className="mx-auto w-full max-w-md rounded-xl border border-black/10 bg-white/95 text-black shadow-2xl backdrop-blur p-6">
        <AuthCard variant="signin" />
      </div>
    </div>
  );
}
