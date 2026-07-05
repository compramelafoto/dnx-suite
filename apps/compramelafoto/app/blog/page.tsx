import { buildBlogHomeMetadata } from "@/lib/blog/blog-metadata";
import BlogHomeExplorer from "@/components/blog/BlogHomeExplorer";
import BlogPageShell from "@/components/blog/BlogPageShell";
import {
  BLOG_POSTS_PER_PAGE,
  clampBlogPage,
  getBlogTotalPages,
  parseBlogPageParam,
} from "@/lib/blog/blog-pagination";
import {
  getAllPublishedPostsForBlogHome,
  getBlogCategoriesForHome,
  getFeaturedPublishedPost,
} from "@/lib/blog/public-queries";

export const dynamic = "force-dynamic";

export const metadata = buildBlogHomeMetadata();

type BlogHomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BlogHomePage({ searchParams }: BlogHomePageProps) {
  const params = await searchParams;
  const requestedPage = parseBlogPageParam(params?.page);

  const [featured, categories, posts] = await Promise.all([
    getFeaturedPublishedPost(),
    getBlogCategoriesForHome(),
    getAllPublishedPostsForBlogHome(),
  ]);

  const listingCount = posts.filter((p) => p.id !== featured?.id).length;
  const totalPages = getBlogTotalPages(listingCount, BLOG_POSTS_PER_PAGE);
  const initialPage = clampBlogPage(requestedPage, totalPages);

  const categoryChips = categories
    .filter((c) => c._count.posts > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      postCount: c._count.posts,
    }));

  return (
    <BlogPageShell innerClassName="ds-stack-section">
      <BlogHomeExplorer
        featured={featured}
        categories={categoryChips}
        posts={posts}
        initialPage={initialPage}
      />
    </BlogPageShell>
  );
}
