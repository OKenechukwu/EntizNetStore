// app/_debug-routes/page.tsx
import { notFound } from "next/navigation";

export default function DebugRoutes() {
  // Debug surface: never available in production deployments.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <main style={{ padding: 24, lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        Routes OK
      </h1>
      <ul style={{ paddingLeft: 18 }}>
        <li>
          <a href="/">/</a>
        </li>
        <li>
          <a href="/auth">/auth</a>
        </li>
        <li>
          <a href="/signin">/signin → /auth</a>
        </li>
      </ul>
      <p style={{ marginTop: 16, opacity: 0.7 }}>
        If any of these links 404, middleware or file paths are blocking.
      </p>
    </main>
  );
}
