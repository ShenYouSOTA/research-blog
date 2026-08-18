/**
 * Pure locale-path helpers shared by the server URL builders (src/lib/urls.ts)
 * and client components (LanguageProvider, LanguageSwitch, Navbar).
 *
 * Every function takes the locale configuration as an argument instead of
 * reading site.config, so the logic stays defaultLocale-agnostic (a zh-default
 * site prefixes /en/ exactly as an en-default site prefixes /zh/) and is
 * directly unit-testable with any locale set. No fs, no Next.js imports —
 * safe in any bundle.
 */

export interface LocalePathConfig {
  /** Locale codes that participate in URL routing; empty when i18n is disabled. */
  locales: string[];
  defaultLocale: string;
}

/** Locale codes that appear as URL prefixes: every configured locale except the default. */
export function nonDefaultLocales(config: LocalePathConfig): string[] {
  return config.locales.filter((locale) => locale !== config.defaultLocale);
}

/**
 * Prefix a site-absolute path with a locale segment:
 * `localizePath('/posts/foo/', 'zh')` → `/zh/posts/foo/`. The default locale
 * owns the unprefixed tree, so it returns the path unchanged. Trailing-slash
 * presence is preserved (`'/'` → `/zh/`).
 */
export function localizePath(path: string, locale: string, config: LocalePathConfig): string {
  if (locale === config.defaultLocale) return path;
  return path === '/' ? `/${locale}/` : `/${locale}${path}`;
}

/**
 * Split a pathname into its locale and unprefixed form:
 * `/zh/posts/foo/` → `{ locale: 'zh', path: '/posts/foo/' }`;
 * `/posts/foo/` → `{ locale: defaultLocale, path: '/posts/foo/' }`.
 * Trailing-slash presence is preserved; `/zh` and `/zh/` both yield path `/`.
 * Only exact segment matches count — `/zhong/foo` is not a `zh` path.
 */
export function splitLocalePath(path: string, config: LocalePathConfig): { locale: string; path: string } {
  const first = path.split('/').find(Boolean);
  if (first && nonDefaultLocales(config).includes(first)) {
    const rest = path.slice(first.length + 1);
    return { locale: first, path: rest === '' ? '/' : rest };
  }
  return { locale: config.defaultLocale, path };
}

/** The unprefixed form of a pathname: `/zh/posts/foo/` → `/posts/foo/`. */
export function delocalizePath(path: string, config: LocalePathConfig): string {
  return splitLocalePath(path, config).path;
}

/**
 * Locale of a pathname. Null/undefined pathnames (renders outside a Next
 * router, e.g. unit tests) fall back to the default locale.
 */
export function localeFromPathname(pathname: string | null | undefined, config: LocalePathConfig): string {
  if (!pathname) return config.defaultLocale;
  return splitLocalePath(pathname, config).locale;
}
