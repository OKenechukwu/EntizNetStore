export type Messages = Record<string, any>;

export type I18nContextValue = {
  lang: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
};
