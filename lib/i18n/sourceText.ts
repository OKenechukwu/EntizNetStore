// Dynamic user/catalog text is preserved in its stored language.
// Static application UI is localized through next-intl message dictionaries.
// A future machine-translation provider must be introduced behind authenticated,
// metered server-side controls rather than from browser components.
export function preserveSourceText(text: string): string {
  return text
}
