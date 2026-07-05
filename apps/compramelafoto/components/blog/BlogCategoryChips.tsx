import Link from "next/link";
import { cn } from "@/lib/utils";

type CategoryChip = {
  id: number;
  name: string;
  slug: string;
  postCount?: number;
};

type BlogCategoryChipsProps = {
  categories: CategoryChip[];
  activeSlug?: string;
};

export default function BlogCategoryChips({ categories, activeSlug }: BlogCategoryChipsProps) {
  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const active = activeSlug === category.slug;
        return (
          <Link
            key={category.id}
            href={`/blog/categoria/${category.slug}`}
            className={cn("blog-category-chip", active && "blog-category-chip--active")}
          >
            {category.name}
            {typeof category.postCount === "number" ? (
              <span className="blog-category-chip__count">({category.postCount})</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
