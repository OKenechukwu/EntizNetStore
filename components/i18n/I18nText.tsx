'use client';

import type { ElementType } from 'react';

type TagName = ElementType;

/**
 * Render dynamic marketplace content in its stored source language.
 *
 * UI chrome continues to use the repository-backed next-intl dictionaries.
 * Dynamic product/message translation is intentionally not performed from the
 * browser: the previous implementation called an unauthenticated paid DeepL
 * proxy and cached results in localStorage. A future translation feature must
 * use an authenticated, rate-limited server contract before it is re-enabled.
 */
export default function I18nText({
  text,
  as: Tag = 'span',
  className,
}: {
  text: string;
  as?: TagName;
  className?: string;
}) {
  return <Tag className={className}>{text}</Tag>;
}
