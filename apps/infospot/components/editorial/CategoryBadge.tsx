import Link from "next/link";
import { cx } from "@/components/foundations/cx";

type Props = {
  name: string;
  slug?: string | null;
  className?: string;
};

export function CategoryBadge({ name, slug, className }: Props) {
  const classes = cx(
    "is-label inline-flex rounded-[var(--is-radius-sm)] bg-[var(--is-accent-soft)] px-2 py-1",
    className,
  );

  if (slug) {
    return (
      <Link href={`/categorias/${slug}`} className={classes}>
        {name}
      </Link>
    );
  }

  return <span className={classes}>{name}</span>;
}
