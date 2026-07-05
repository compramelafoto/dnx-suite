export type AdminBlogPostRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  type: string;
  isFeatured: boolean;
  publishedAt: string | null;
  viewCount: number;
  category: { id: number; name: string; slug: string } | null;
  author: { id: number; name: string; slug: string } | null;
};
