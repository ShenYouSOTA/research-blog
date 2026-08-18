import { describe, expect, test } from 'bun:test';
import {
  delocalizePath,
  localeFromPathname,
  localizePath,
  nonDefaultLocales,
  splitLocalePath,
  type LocalePathConfig,
} from '../../src/lib/locale-urls';
import {
  RESERVED_ROUTE_SEGMENTS,
  getNonDefaultLocales,
  getReservedRouteSegments,
  localizeUrl,
  splitLocaleFromPath,
  validateSeriesAutoPaths,
} from '../../src/lib/urls';
import { collectSingleSegmentAliases } from '../../src/lib/route-aliases';
import { validateSiteConfig } from '../../src/lib/config-schema';
import { siteConfig } from '../../site.config';

// The pure helpers must be defaultLocale-agnostic: a zh-default site prefixes
// /en/ exactly as an en-default site prefixes /zh/. Both configs are exercised
// throughout (design invariant from the locale-routing plan).
const EN_DEFAULT: LocalePathConfig = { locales: ['en', 'zh'], defaultLocale: 'en' };
const ZH_DEFAULT: LocalePathConfig = { locales: ['zh', 'en'], defaultLocale: 'zh' };
const DISABLED: LocalePathConfig = { locales: [], defaultLocale: 'en' };

describe('locale-urls pure helpers', () => {
  test('nonDefaultLocales excludes the default', () => {
    expect(nonDefaultLocales(EN_DEFAULT)).toEqual(['zh']);
    expect(nonDefaultLocales(ZH_DEFAULT)).toEqual(['en']);
    expect(nonDefaultLocales(DISABLED)).toEqual([]);
  });

  test('localizePath prefixes non-default locales and preserves trailing slash', () => {
    expect(localizePath('/posts/foo/', 'zh', EN_DEFAULT)).toBe('/zh/posts/foo/');
    expect(localizePath('/posts/foo', 'zh', EN_DEFAULT)).toBe('/zh/posts/foo');
    expect(localizePath('/', 'zh', EN_DEFAULT)).toBe('/zh/');
  });

  test('localizePath is the identity for the default locale', () => {
    expect(localizePath('/posts/foo/', 'en', EN_DEFAULT)).toBe('/posts/foo/');
    expect(localizePath('/posts/foo/', 'zh', ZH_DEFAULT)).toBe('/posts/foo/');
  });

  test('zh-default config prefixes /en/', () => {
    expect(localizePath('/posts/foo/', 'en', ZH_DEFAULT)).toBe('/en/posts/foo/');
    expect(splitLocalePath('/en/posts/foo/', ZH_DEFAULT)).toEqual({ locale: 'en', path: '/posts/foo/' });
    expect(splitLocalePath('/posts/foo/', ZH_DEFAULT)).toEqual({ locale: 'zh', path: '/posts/foo/' });
  });

  test('splitLocalePath handles the locale root with and without trailing slash', () => {
    expect(splitLocalePath('/zh', EN_DEFAULT)).toEqual({ locale: 'zh', path: '/' });
    expect(splitLocalePath('/zh/', EN_DEFAULT)).toEqual({ locale: 'zh', path: '/' });
  });

  test('splitLocalePath only matches exact segments, not prefixes', () => {
    expect(splitLocalePath('/zhong/foo/', EN_DEFAULT)).toEqual({ locale: 'en', path: '/zhong/foo/' });
  });

  test('splitLocalePath keeps encoded and raw CJK segments intact', () => {
    expect(splitLocalePath('/zh/posts/%E4%B8%AD%E6%96%87%E6%B5%8B%E8%AF%95/', EN_DEFAULT)).toEqual({
      locale: 'zh',
      path: '/posts/%E4%B8%AD%E6%96%87%E6%B5%8B%E8%AF%95/',
    });
    expect(splitLocalePath('/zh/posts/中文测试文章/', EN_DEFAULT)).toEqual({
      locale: 'zh',
      path: '/posts/中文测试文章/',
    });
  });

  test('delocalize(localize(p)) round-trips for every locale and path shape', () => {
    const paths = ['/', '/about/', '/posts/foo', '/books/dmla/maths/linear/intro/', '/tags/编程/'];
    for (const config of [EN_DEFAULT, ZH_DEFAULT]) {
      for (const locale of config.locales) {
        for (const path of paths) {
          expect(delocalizePath(localizePath(path, locale, config), config)).toBe(path);
        }
      }
    }
  });

  test('localeFromPathname falls back to the default for null pathnames', () => {
    expect(localeFromPathname(null, EN_DEFAULT)).toBe('en');
    expect(localeFromPathname(undefined, ZH_DEFAULT)).toBe('zh');
    expect(localeFromPathname('/zh/about/', EN_DEFAULT)).toBe('zh');
  });
});

describe('urls.ts config-bound locale helpers', () => {
  // site.config.ts in this repo: { enabled: true, defaultLocale: 'en', locales: ['en', 'zh'] }
  test('getNonDefaultLocales reflects site.config', () => {
    expect(getNonDefaultLocales()).toEqual(['zh']);
  });

  test('localizeUrl / splitLocaleFromPath bind site.config', () => {
    expect(localizeUrl('/posts/foo/', 'zh')).toBe('/zh/posts/foo/');
    expect(localizeUrl('/posts/foo/', 'en')).toBe('/posts/foo/');
    expect(splitLocaleFromPath('/zh/about/')).toEqual({ locale: 'zh', path: '/about/' });
  });

  test('getReservedRouteSegments = static set ∪ all configured locales (default included)', () => {
    const reserved = getReservedRouteSegments();
    for (const segment of RESERVED_ROUTE_SEGMENTS) {
      expect(reserved.has(segment)).toBe(true);
    }
    expect(reserved.has('en')).toBe(true);
    expect(reserved.has('zh')).toBe(true);
  });
});

describe('locale-code collision throws (strict build)', () => {
  test('series auto-path slug equal to a locale code throws', () => {
    expect(() => validateSeriesAutoPaths(['zh'])).toThrow(/locale prefix "\/zh"/);
    expect(() => validateSeriesAutoPaths(['en'])).toThrow(/locale prefix "\/en"/);
    expect(() => validateSeriesAutoPaths(['my-series'])).not.toThrow();
  });

  test('single-segment redirectFrom alias equal to a locale code throws', () => {
    const posts = [{ slug: 'moved-post', series: undefined, redirectFrom: ['/zh'] }];
    expect(() => collectSingleSegmentAliases(posts, new Set(getReservedRouteSegments()))).toThrow(
      /conflicts with an existing top-level route/
    );
  });

  test('config: posts.basePath equal to a locale code is rejected', () => {
    const bad = { ...siteConfig, posts: { ...siteConfig.posts, basePath: 'zh' } };
    expect(() => validateSiteConfig(bad)).toThrow(/posts\.basePath.*locale/);
  });

  test('config: series.customPaths value equal to a locale code is rejected', () => {
    const bad = {
      ...siteConfig,
      series: { ...siteConfig.series, customPaths: { ...siteConfig.series.customPaths, foo: 'zh' } },
    };
    expect(() => validateSiteConfig(bad)).toThrow(/customPaths.*locale/);
  });

  test('config: defaultLocale must be listed in locales', () => {
    const bad = { ...siteConfig, i18n: { ...siteConfig.i18n, defaultLocale: 'fr' } };
    expect(() => validateSiteConfig(bad)).toThrow(/defaultLocale "fr" must be listed/);
  });

  test('config: locale collisions are not enforced when i18n is disabled', () => {
    const disabled = {
      ...siteConfig,
      i18n: { ...siteConfig.i18n, enabled: false },
      posts: { ...siteConfig.posts, basePath: 'zh' },
    };
    expect(() => validateSiteConfig(disabled)).not.toThrow();
  });
});
