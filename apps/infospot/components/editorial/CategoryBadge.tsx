import Link from "next/link";
import { cx } from "@/components/foundations/cx";

type Props = {
  name: string;
  slug?: string | null;
  className?: string;
  /**
   * Si false, renderiza span aunque haya slug (evitar <a> anidado dentro de cards).
   * Por defecto true cuando hay slug.
   */
  asLink?: boolean;
};

export function CategoryBadge({
  name,
  slug,
  className,
  asLink = true,
}: Props) {
  const classes = cx(
    "is-label inline-flex rounded-[var(--is-radius-sm)] bg-[var(--is-accent-soft)] px-2 py-1",
    className,
  );

  if (slug && asLink) {
    return (
      <Link href={`/categorias/${slug}`} className={classes}>
        {name}
      </Link>
    );
  }

  return <span className={classes}>{name}</span>;
}
