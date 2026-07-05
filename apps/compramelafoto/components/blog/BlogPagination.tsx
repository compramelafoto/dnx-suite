import Link from "next/link";
import {
  blogPageHref,
  blogPageRangeLabel,
  getBlogPageNumbers,
} from "@/lib/blog/blog-pagination";
import { cn } from "@/lib/utils";

type BlogPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  className?: string;
};

export default function BlogPagination({
  currentPage,
  totalPages,
  totalItems,
  className,
}: BlogPaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = getBlogPageNumbers(currentPage, totalPages);
  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  return (
    <nav
      className={cn("blog-pagination", className)}
      aria-label="Paginación del blog"
    >
      <p className="blog-pagination__summary">{blogPageRangeLabel(currentPage, totalItems)}</p>

      <ul className="blog-pagination__list">
        <li>
          {prevPage ? (
            <Link href={blogPageHref(prevPage)} className="blog-pagination__control" rel="prev">
              ← Anterior
            </Link>
          ) : (
            <span className="blog-pagination__control blog-pagination__control--disabled" aria-disabled>
              ← Anterior
            </span>
          )}
        </li>

        {pageNumbers.map((item, index) =>
          item === "ellipsis" ? (
            <li key={`ellipsis-${index}`} className="blog-pagination__ellipsis" aria-hidden>
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={blogPageHref(item)}
                className={cn(
                  "blog-pagination__page",
                  item === currentPage && "blog-pagination__page--active"
                )}
                aria-current={item === currentPage ? "page" : undefined}
              >
                {item}
              </Link>
            </li>
          )
        )}

        <li>
          {nextPage ? (
            <Link href={blogPageHref(nextPage)} className="blog-pagination__control" rel="next">
              Siguiente →
            </Link>
          ) : (
            <span className="blog-pagination__control blog-pagination__control--disabled" aria-disabled>
              Siguiente →
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
