export type ArticleCardProps = {
  title: string;
  excerpt?: string | null;
  href: string;
  imageUrl?: string | null;
  imageAlt?: string;
  category?: string | null;
  categorySlug?: string | null;
  publishedAt?: Date | string | null;
  authorName?: string | null;
  location?: string | null;
  priority?: boolean;
  className?: string;
};
