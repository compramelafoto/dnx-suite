import Link from "next/link";
import { cx } from "@/components/foundations/cx";

type Props = {
  page: number;
  hasNext: boolean;
  basePath?: string;
  className?: string;
};

export function Pagination({
  page,
  hasNext,
  basePath = "/",
  className,
}: Props) {
  if (page <= 1 && !hasNext) return null;

  const prevHref = page > 2 ? `${basePath}?page=${page - 1}` : basePath;
  const nextHref = `${basePath}?page=${page + 1}`;
  const canPrev = page > 1;

  return (
    <nav
      aria-label="Paginación"
      className={cx(
        "mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--is-border)] pt-8",
        className,
      )}
    >
      {canPrev ? (
        <Link href={prevHref} className="is-btn is-btn-secondary min-h-11">
          Anterior
        </Link>
      ) : (
        <span
          className="is-btn is-btn-secondary min-h-11 cursor-not-allowed opacity-40"
          aria-disabled="true"
        >
          Anterior
        </span>
      )}

      <p className="is-metadata order-first w-full text-center sm:order-none sm:w-auto">
        Página <span className="text-[var(--is-text)]">{page}</span>
      </p>

      {hasNext ? (
        <Link href={nextHref} className="is-btn is-btn-secondary min-h-11">
          Siguiente
        </Link>
      ) : (
        <span
          className="is-btn is-btn-secondary min-h-11 cursor-not-allowed opacity-40"
          aria-disabled="true"
        >
          Siguiente
        </span>
      )}
    </nav>
  );
}
