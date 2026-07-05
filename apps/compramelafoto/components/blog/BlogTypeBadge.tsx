import { BLOG_POST_TYPE_LABELS } from "@/components/blog/admin/blog-admin-constants";
import { cn } from "@/lib/utils";

type BlogTypeBadgeProps = {
  type: string;
  className?: string;
  featured?: boolean;
};

export default function BlogTypeBadge({ type, className = "", featured = false }: BlogTypeBadgeProps) {
  const label = BLOG_POST_TYPE_LABELS[type] ?? type;
  return (
    <span
      className={cn(
        "blog-type-badge",
        featured && "blog-type-badge--featured",
        className
      )}
    >
      {label}
    </span>
  );
}
