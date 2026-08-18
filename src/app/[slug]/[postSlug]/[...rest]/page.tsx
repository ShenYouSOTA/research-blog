import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { siteConfig } from '../../../../../site.config';
import { resolveImageUrl } from '@/lib/json-ld';
import { getPostUrl, getPostsBasePath, isNonDefaultLocale, localizeUrl, withTrailingSlash } from '@/lib/urls';
import { buildArticleMetadata } from '@/lib/metadata';
import { getTranslator, resolveLocaleValue } from '@/lib/i18n';
import RenderPostPage from '@/components/RenderPostPage';
import PostsListingBody from '@/components/page-bodies/PostsListingBody';
import SeriesPrefixListingBody from '@/components/page-bodies/SeriesPrefixListingBody';
import SeriesLandingBody from '@/components/page-bodies/SeriesLandingBody';
import NotesIndexBody from '@/components/page-bodies/NotesIndexBody';
import BookLandingBody from '@/components/page-bodies/BookLandingBody';
import BookChapterBody from '@/components/page-bodies/BookChapterBody';
import { localeDeepParams, resolveLocalizedPath, type LocalizedResolution } from '@/lib/locale-routes';
import { safeDecodeParam } from '@/lib/route-params';
import { getSeriesData, getSeriesPosts } from '@/lib/content/series';

/**
 * Deep locale-prefixed paths (three or more segments): /zh/posts/<slug>,
 * /zh/series/<s>[/page/<n>], /zh/books/<b>/<...chapter>, /zh/notes/<slug>,
 * and listing pagination. The unprefixed tree serves these shapes through its
 * literal section routes; under a locale prefix they all funnel through this
 * catch-all because a sibling [locale] segment cannot coexist with [slug].
 * A dynamic [postSlug] sibling and this [...rest] catch-all CAN coexist —
 * Next tracks dynamic and catch-all slots separately at each tree level.
 */

export async function generateStaticParams() {
  const params = localeDeepParams();
  // Placeholder keeps Next.js happy with output: export when no locale trees exist.
  // dynamicParams = false ensures any unrecognised path returns 404.
  return params.length > 0 ? params : [{ slug: '_', postSlug: '_', rest: ['_'] }];
}

export const dynamicParams = false;

type DeepParams = Promise<{ slug: string; postSlug: string; rest: string[] }>;

function resolveFromParams(slug: string, postSlug: string, rest: string[]): { locale: string; resolution: LocalizedResolution } | null {
  const locale = safeDecodeParam(slug);
  if (!isNonDefaultLocale(locale)) return null;
  return { locale, resolution: resolveLocalizedPath(locale, [postSlug, ...rest]) };
}

export async function generateMetadata({ params }: { params: DeepParams }): Promise<Metadata> {
  const { slug, postSlug, rest } = await params;
  const resolved = resolveFromParams(slug, postSlug, rest);
  if (!resolved) return { title: 'Page Not Found' };
  const { locale, resolution } = resolved;
  const { t, tWith } = getTranslator(locale);
  const siteTitle = resolveLocaleValue(siteConfig.title, locale);
  const siteUrl = siteConfig.baseUrl.replace(/\/+$/, '');

  switch (resolution?.kind) {
    case 'post':
      return buildArticleMetadata({
        locale,
        title: resolution.post.title,
        description: resolution.post.excerpt,
        publishedTime: resolution.post.date,
        authors: resolution.post.authors,
        canonicalUrl: withTrailingSlash(`${siteUrl}${getPostUrl(resolution.post)}`),
        ogImage: resolveImageUrl(resolution.post.coverImage, siteConfig.ogImage, siteUrl),
        twitterCard: 'summary_large_image',
      });
    case 'seriesPage':
    case 'seriesPrefixListing': {
      const seriesData = getSeriesData(resolution.seriesSlug, locale);
      if (!seriesData) return { title: 'Page Not Found' };
      const totalPages = Math.ceil(
        getSeriesPosts(resolution.seriesSlug, locale).length / siteConfig.pagination.series
      );
      const pageSuffix = resolution.page > 1
        ? ` - ${tWith('page_of_total', { page: resolution.page, total: totalPages })}`
        : '';
      return {
        title: `${seriesData.title}${pageSuffix} - ${t('series')} | ${siteTitle}`,
        description: seriesData.excerpt,
      };
    }
    case 'postsListing':
      return { title: `${t('posts')} | ${siteTitle}`, description: t('posts_description') };
    case 'notesListing':
      return { title: `${t('notes')} | ${siteTitle}` };
    case 'book':
      return {
        title: `${resolution.book.title} | ${siteTitle}`,
        description: resolution.book.excerpt,
      };
    case 'chapter':
      return {
        title: `${resolution.chapter.title} - ${resolution.book.title} | ${siteTitle}`,
        description: resolution.chapter.excerpt,
      };
    default:
      return { title: 'Page Not Found' };
  }
}

export default async function LocaleDeepPage({ params }: { params: DeepParams }) {
  const { slug, postSlug, rest } = await params;
  const resolved = resolveFromParams(slug, postSlug, rest);
  if (!resolved) notFound();
  const { locale, resolution } = resolved;

  switch (resolution?.kind) {
    case 'post':
      return <RenderPostPage post={resolution.post} locale={locale} />;
    case 'seriesPage':
      return <SeriesLandingBody locale={locale} seriesSlug={resolution.seriesSlug} page={resolution.page} />;
    case 'seriesPrefixListing':
      return (
        <SeriesPrefixListingBody
          locale={locale}
          seriesSlug={resolution.seriesSlug}
          prefix={resolution.prefix}
          page={resolution.page}
        />
      );
    case 'postsListing':
      return (
        <PostsListingBody
          locale={locale}
          page={resolution.page}
          paginationBasePath={localizeUrl(`/${getPostsBasePath()}`, locale)}
        />
      );
    case 'notesListing':
      return <NotesIndexBody locale={locale} page={resolution.page} />;
    case 'book':
      return <BookLandingBody locale={locale} bookSlug={resolution.book.slug} />;
    case 'chapter':
      return <BookChapterBody locale={locale} bookSlug={resolution.book.slug} chapterId={resolution.chapter.slug} />;
    default:
      notFound();
  }
}
