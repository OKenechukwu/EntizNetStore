// app/_debug-routes/page.tsx
export default function DebugRoutes() {
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
