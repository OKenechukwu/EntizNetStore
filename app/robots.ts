// app/robots.ts
export default function robots() {
  return {
    rules: [{ userAgent: "*", disallow: ["/internal/"] }],
  };
}
