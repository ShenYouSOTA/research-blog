import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { siteConfig } from '../../../site.config';
import { byDateDesc } from '../sort';
import { getHeadings } from '../text-metrics';
import type { PostData, Heading } from './types';
import {
  pagesDirectory,
  contentRoot,
  domainDir,
  getActiveContentLocales,
  assertKnownLocale,
  readUtf8File,
  parseSlugAndDate,
} from './io';
import { createKeyedMemo } from './cache';
import { resolveSeriesIndexInfo, getSeriesContentEntries } from './series-metadata';
import { parseMarkdownFile, parseRstPostEntries, type RstPostEntry } from './parse';

/**
 * Post and page discovery. Each locale tree is a parallel content set: posts
 * live in <tree>/posts/ (flat files or folders) and inside series folders
 * under <tree>/series/; pages are top-level files in the tree root. The
 * default locale's tree is the content/ root itself.
 */

const DEFAULT_LOCALE = siteConfig.i18n.defaultLocale;

const allPostsUnfilteredMemo = createKeyedMemo<string, PostData[]>();
const allPostsMemo = createKeyedMemo<string, PostData[]>();

/**
 * Every post parsed from the content tree, including drafts, future-dated
 * posts, and static pages — the pre-publication-filter view. Content-layer
 * internal: it lets validation distinguish "slug doesn't exist at all" (a
 * build error) from "slug exists but is unpublished here" (a silent skip).
 * Routes and components must keep using getAllPosts().
 */
export function getAllPostsIncludingUnpublished(locale: string = DEFAULT_LOCALE): PostData[] {
  assertKnownLocale(locale);
  return allPostsUnfilteredMemo.get(locale, () => {
    // Chokepoint for the locale-tree validations: every build walks posts, so
    // an invalid content/<locale>/ layout throws before anything renders.
    if (!getActiveContentLocales().includes(locale)) return []; // configured but no tree on disk — sparse, not an error

    const allPostsData: PostData[] = [];
    const pendingRstPosts: RstPostEntry[] = [];

    // Helper to process a directory
    const processDirectory = (dir: string, isSeriesDir: boolean = false) => {
      if (!fs.existsSync(dir)) return;

      const items = fs.readdirSync(dir, { withFileTypes: true });

      items.forEach((item) => {
        let fullPath = '';
        let slug = '';
        let dateFromFileName = undefined;

        const rawName = item.name.replace(/\.mdx?$/, '');
        ({ slug, dateFromFileName } = parseSlugAndDate(rawName));

        // Handle Series Directory logic
        if (isSeriesDir) {
          if (item.isDirectory()) {
            const seriesSlug = item.name;
            const indexInfo = resolveSeriesIndexInfo(seriesSlug, locale);
            if (!indexInfo) return;

            getSeriesContentEntries(seriesSlug, locale).forEach(entry => {
              if (indexInfo.format === 'rst') {
                pendingRstPosts.push({
                  fullPath: entry.fullPath,
                  slug: entry.slug,
                  dateFromFileName: entry.dateFromFileName,
                  seriesSlug,
                  locale,
                });
              } else {
                allPostsData.push(parseMarkdownFile(entry.fullPath, entry.slug, entry.dateFromFileName, seriesSlug, locale));
              }
            });
            return;
          }
        }

        // Standard Posts logic (outside series)
        if (item.isFile()) {
          if (!item.name.endsWith('.mdx') && !item.name.endsWith('.md')) return;
          fullPath = path.join(dir, item.name);
          allPostsData.push(parseMarkdownFile(fullPath, slug, dateFromFileName, undefined, locale));
        } else if (item.isDirectory()) {
          const indexPathMdx = path.join(dir, item.name, 'index.mdx');
          const indexPathMd = path.join(dir, item.name, 'index.md');
          if (fs.existsSync(indexPathMdx)) fullPath = indexPathMdx;
          else if (fs.existsSync(indexPathMd)) fullPath = indexPathMd;
          else return;

          allPostsData.push(parseMarkdownFile(fullPath, slug, dateFromFileName, undefined, locale));
        }
      });
    };

    processDirectory(domainDir('posts', locale));
    processDirectory(domainDir('series', locale), true);

    allPostsData.push(...parseRstPostEntries(pendingRstPosts));

    return allPostsData;
  });
}

export function getAllPosts(locale: string = DEFAULT_LOCALE): PostData[] {
  return allPostsMemo.get(locale, () => {
    return getAllPostsIncludingUnpublished(locale)
      .filter(post => {
        if (post.category === 'Page') return false;

        if (process.env.NODE_ENV === 'production' && post.draft) {
          return false;
        }

        if (!siteConfig.posts?.showFuturePosts) {
          const postDate = new Date(post.date);
          const now = new Date();
          if (postDate > now) return false;
        }
        return true;
      })
      .sort(byDateDesc);
  });
}

/**
 * Returns posts for the main listing pages, honouring posts.excludeFromListing.
 * Use this instead of getAllPosts() on any listing/pagination page.
 * Individual post routes and series pages still use getAllPosts() directly.
 */
export function getListingPosts(locale: string = DEFAULT_LOCALE): PostData[] {
  const excluded = new Set(siteConfig.posts?.excludeFromListing ?? []);
  if (excluded.size === 0) return getAllPosts(locale);
  return getAllPosts(locale).filter(p => !p.series || !excluded.has(p.series));
}

export function getPostBySlug(slug: string, locale: string = DEFAULT_LOCALE): PostData | null {
  return getAllPosts(locale).find(post => post.slug === slug) ?? null;
}

export function getPostsByTag(tag: string, locale: string = DEFAULT_LOCALE): PostData[] {
  const allPosts = getAllPosts(locale);
  return allPosts.filter((post) =>
    post.tags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
  );
}

const featuredPostsMemo = createKeyedMemo<string, PostData[]>();

export function getFeaturedPosts(locale: string = DEFAULT_LOCALE): PostData[] {
  return featuredPostsMemo.get(locale, () => getAllPosts(locale).filter(post => post.featured));
}

// ─── twin lookups across locale trees ────────────────────────────────────────

/**
 * Locales (including the post's own) whose tree contains a doc with the same
 * treePath — the hreflang/LanguageSwitch data. A zh-original post with no
 * default-tree twin yields just ['zh'].
 */
export function getPostContentLocales(post: Pick<PostData, 'treePath' | 'locale'>): string[] {
  return getActiveContentLocales().filter(
    locale => locale === post.locale || getAllPosts(locale).some(p => p.treePath === post.treePath)
  );
}

/** The same post in another locale tree (matched by treePath), or null. */
export function getTwinPost(post: Pick<PostData, 'treePath'>, locale: string): PostData | null {
  return getAllPosts(locale).find(p => p.treePath === post.treePath) ?? null;
}

export function getPageContentLocales(page: Pick<PostData, 'treePath' | 'locale'>): string[] {
  return getActiveContentLocales().filter(
    locale => locale === page.locale || getAllPages(locale).some(p => p.treePath === page.treePath)
  );
}

export function getTwinPage(page: Pick<PostData, 'treePath'>, locale: string): PostData | null {
  return getAllPages(locale).find(p => p.treePath === page.treePath) ?? null;
}

/**
 * Load the content and frontmatter of a locale variant file, e.g. about.zh.mdx.
 * Contract: returns null only when no variant file exists (locale variants are
 * optional). A variant that exists but cannot be read or parsed throws — a
 * malformed translation must fail the build, not silently drop the locale
 * (strict-build invariant).
 */
function loadLocaleContent(slug: string, locale: string): { content: string; title?: string; excerpt?: string; headings?: Heading[] } | null {
  for (const ext of ['.mdx', '.md']) {
    // The `${slug}.${locale}${ext}` template is a build-time content lookup,
    // not a module to trace. Without these turbopackIgnore annotations
    // Turbopack expands it to a `<dynamic>.<dynamic>.<ext>` glob and traces the
    // whole project (also surfaces as the next.config.ts NFT warning). See CLAUDE.md.
    const filePath = path.join(/* turbopackIgnore: true */ pagesDirectory, `${slug}.${locale}${ext}`);
    if (fs.existsSync(/* turbopackIgnore: true */ filePath)) {
      const { data, content } = matter(readUtf8File(filePath));
      const body = content.replace(/^\s*#\s+[^\n]+/, '').trim();
      return {
        content: body,
        title: typeof data.title === 'string' ? data.title : undefined,
        excerpt: typeof data.excerpt === 'string' ? data.excerpt : undefined,
        headings: getHeadings(body),
      };
    }
  }
  return null;
}

/**
 * Collect contentLocales for all non-default locales that have a variant file.
 */
function attachContentLocales(page: PostData, slug: string): PostData {
  const defaultLocale = siteConfig.i18n.defaultLocale;
  const otherLocales = siteConfig.i18n.locales.filter(l => l !== defaultLocale);
  const contentLocales: NonNullable<PostData['contentLocales']> = {};
  for (const locale of otherLocales) {
    const localeData = loadLocaleContent(slug, locale);
    if (localeData !== null) contentLocales[locale] = localeData;
  }
  return Object.keys(contentLocales).length > 0 ? { ...page, contentLocales } : page;
}

/**
 * Contract: returns null only when the page file does not exist (static pages
 * are optional — an absent about.md is fine). Any error past the existence
 * check — malformed frontmatter, unreadable file — propagates and fails the
 * build (strict-build invariant); a broken page must not silently 404.
 */
export function getPageBySlug(slug: string, locale: string = DEFAULT_LOCALE): PostData | null {
  assertKnownLocale(locale);
  const treeRoot = contentRoot(locale);
  let fullPath = path.join(/* turbopackIgnore: true */ treeRoot, `${slug}.mdx`);
  if (!fs.existsSync(/* turbopackIgnore: true */ fullPath)) {
    fullPath = path.join(/* turbopackIgnore: true */ treeRoot, `${slug}.md`);
  }
  if (!fs.existsSync(/* turbopackIgnore: true */ fullPath)) return null;
  const page = parseMarkdownFile(fullPath, slug, undefined, undefined, locale);
  return locale === DEFAULT_LOCALE ? attachContentLocales(page, slug) : page;
}

const allPagesMemo = createKeyedMemo<string, PostData[]>();

export function getAllPages(locale: string = DEFAULT_LOCALE): PostData[] {
  assertKnownLocale(locale);
  return allPagesMemo.get(locale, () => {
    if (!getActiveContentLocales().includes(locale)) return [];
    const treeRoot = contentRoot(locale);
    const items = fs.readdirSync(treeRoot, { withFileTypes: true });
    return items
      .filter(item => {
        if (!item.isFile()) return false;
        if (!item.name.endsWith('.mdx') && !item.name.endsWith('.md')) return false;
        // Exclude locale variant files (e.g. about.zh.mdx, about.en.mdx) — they are not standalone routes
        const base = item.name.replace(/\.mdx?$/, '');
        const parts = base.split('.');
        if (parts.length > 1 && siteConfig.i18n.locales.includes(parts[parts.length - 1])) {
          return false;
        }
        return true;
      })
      .map(item => {
        const slug = item.name.replace(/\.mdx?$/, '');
        const fullPath = path.join(treeRoot, item.name);
        const page = parseMarkdownFile(fullPath, slug, undefined, undefined, locale);
        return locale === DEFAULT_LOCALE ? attachContentLocales(page, slug) : page;
      });
  });
}
