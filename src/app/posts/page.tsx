import { getListingPosts } from '@/lib/content/posts';
import PostList from '@/components/PostList';
import Pagination from '@/components/Pagination';
import { siteConfig } from '../../../site.config';
import { Metadata } from 'next';
import { createListingMetadata } from '@/lib/metadata';
import PageHeader from '@/components/PageHeader';
import { getPostsBasePath } from '@/lib/urls';
import { notFound } from 'next/navigation';
import { firstPage } from '@/lib/pagination';

const DEFAULT_LOCALE = siteConfig.i18n.defaultLocale;

const PAGE_SIZE = siteConfig.pagination.posts;

export async function generateMetadata(): Promise<Metadata> {
  const allPosts = getListingPosts();
  return createListingMetadata({ locale: DEFAULT_LOCALE, titleKey: 'posts', descriptionKey: 'posts_subtitle', count: allPosts.length });
}

export default function AllPostsPage() {
  if (getPostsBasePath() !== 'posts') notFound();
  const allPosts = getListingPosts();
  const { items: posts, page, totalPages } = firstPage(allPosts, PAGE_SIZE);

  return (
    <div className="layout-main">
      <PageHeader
        titleKey="posts"
        subtitleKey="posts_subtitle"
        subtitleParams={{ count: allPosts.length }}
        className="mb-12"
      />

      <PostList posts={posts} locale={DEFAULT_LOCALE} />

      {totalPages > 1 && (
        <div className="mt-12">
          <Pagination currentPage={page} totalPages={totalPages} basePath="/posts" />
        </div>
      )}
    </div>
  );
}
