// app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar goes here */}
      <aside className="hidden lg:block border-r border-white/10 p-4">/* nav */</aside>
      <main className="p-4">{children}</main>
    </div>
  );
}
