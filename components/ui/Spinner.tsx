// ---------- components/ui/Spinner.tsx ----------
"use client";

export default function Spinner() {
  return (
    <div
      className="flex items-center justify-center p-6"
      role="status"
      aria-label="loading"
    >
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="ml-3 text-sm opacity-70">Loading…</span>
    </div>
  );
}
