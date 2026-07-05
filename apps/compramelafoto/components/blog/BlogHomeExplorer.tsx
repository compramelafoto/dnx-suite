"use client";

import Image from "next/image";
import { BLOG_DEFAULT_COVER_IMAGE_PATH } from "@/lib/blog/blog-default-cover";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import BlogCategoryChips from "@/components/blog/BlogCategoryChips";
import BlogHomeHero from "@/components/blog/BlogHomeHero";
import BlogNewsletterForm from "@/components/blog/BlogNewsletterForm";
import BlogPagination from "@/components/blog/BlogPagination";
import BlogPostCard from "@/components/blog/BlogPostCard";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { clampBlogPage, getBlogTotalPages, sliceBlogPage } from "@/lib/blog/blog-pagination";
import {
  BLOG_QUICK_FILTERS,
  filterBlogPosts,
  isBlogSearchActive,
  quickFilterIsActive,
  type BlogQuickFilter,
} from "@/lib/blog/blog-search";
import type { PublicBlogPostListItem, PublicBlogPostSearchItem } from "@/lib/blog/public-queries";
import { cn } from "@/lib/utils";

type CategoryChip = {
  id: number;
  name: string;
  slug: string;
  postCount?: number;
};

type BlogHomeExplorerProps = {
  featured: PublicBlogPostListItem | null;
  categories: CategoryChip[];
  posts: PublicBlogPostSearchItem[];
  initialPage: number;
};

export default function BlogHomeExplorer({
  featured,
  categories,
  posts,
  initialPage,
}: BlogHomeExplorerProps) {
  const searchInputId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [searchPage, setSearchPage] = useState(1);

  const filters = useMemo(() => ({ query, categorySlug }), [query, categorySlug]);
  const searching = isBlogSearchActive(filters);
  const filteredPosts = useMemo(() => filterBlogPosts(posts, filters), [posts, filters]);

  const listingPosts = useMemo(() => {
    const excludeId = featured?.id;
    return posts.filter((p) => p.id !== excludeId);
  }, [posts, featured?.id]);

  const listingTotalPages = getBlogTotalPages(listingPosts.length);
  const listingPage = clampBlogPage(initialPage, listingTotalPages);

  const searchTotalPages = getBlogTotalPages(filteredPosts.length);
  const activeSearchPage = clampBlogPage(searchPage, searchTotalPages);

  const visiblePosts = useMemo(() => {
    if (searching) {
      return sliceBlogPage(filteredPosts, activeSearchPage);
    }
    return sliceBlogPage(listingPosts, listingPage);
  }, [searching, filteredPosts, activeSearchPage, listingPosts, listingPage]);

  const isFirstBlogPage = !searching && listingPage === 1;

  const applyQuickFilter = useCallback((filter: BlogQuickFilter) => {
    if (quickFilterIsActive(filter, { query, categorySlug })) {
      setQuery("");
      setCategorySlug(null);
      setSearchPage(1);
      return;
    }
    setQuery(filter.query ?? "");
    setCategorySlug(filter.categorySlug ?? null);
    setSearchPage(1);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [query, categorySlug]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setCategorySlug(null);
    setSearchPage(1);
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    setSearchPage(1);
  }, [query, categorySlug]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (typing) return;
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-12">
        <div className="ds-content-container min-w-0">
          <h1 className="blog-page-title">Blog</h1>
          <p className="blog-page-lead">
            Guías, casos de éxito y recursos para fotógrafos, organizadores y escuelas.
          </p>

          <div className="blog-search mt-6">
            <label htmlFor={searchInputId} className="sr-only">
              Buscar artículos del blog
            </label>
            <div className="blog-search__field">
              <span className="blog-search__icon" aria-hidden>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                ref={searchRef}
                id={searchInputId}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchPage(1);
                }}
                placeholder="Buscar por tema, categoría o palabra clave…"
                className="blog-search__input"
                autoComplete="off"
                enterKeyHint="search"
              />
              {searching ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="blog-search__clear"
                  aria-label="Limpiar búsqueda"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              ) : (
                <kbd className="blog-search__hint" aria-hidden>
                  /
                </kbd>
              )}
            </div>

            <div className="blog-search__quick" role="group" aria-label="Búsquedas frecuentes">
              {BLOG_QUICK_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => applyQuickFilter(filter)}
                  className={cn(
                    "blog-quick-filter",
                    quickFilterIsActive(filter, filters) && "blog-quick-filter--active"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {searching ? (
              <p className="blog-search__status" role="status" aria-live="polite">
                {filteredPosts.length === 0
                  ? "No encontramos artículos con esos criterios."
                  : filteredPosts.length === 1
                    ? "1 artículo encontrado"
                    : `${filteredPosts.length} artículos encontrados`}
                {categorySlug ? (
                  <>
                    {" "}
                    en{" "}
                    <button
                      type="button"
                      className="blog-search__status-link"
                      onClick={() => setCategorySlug(null)}
                    >
                      {categories.find((c) => c.slug === categorySlug)?.name ?? categorySlug}
                    </button>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="blog-search__helper">
                Probá con «referidos», «preventa» o usá los atajos. Presioná <kbd>/</kbd> para
                buscar al instante.
              </p>
            )}
          </div>
        </div>

        <div className="ds-stack-anchor flex shrink-0 justify-center lg:justify-end lg:pt-1">
          <Image
            src={BLOG_DEFAULT_COVER_IMAGE_PATH}
            alt="Blog de ComprameLaFoto"
            width={360}
            height={240}
            className="h-28 w-auto max-w-[220px] rounded-xl object-cover shadow-sm md:h-36 md:max-w-[280px]"
            priority
            unoptimized
          />
        </div>
      </header>

      {isFirstBlogPage && featured ? <BlogHomeHero post={featured} /> : null}

      {isFirstBlogPage && categories.length > 0 ? (
        <section className="ds-stack-section">
          <h2 className="blog-section-title">Categorías</h2>
          <BlogCategoryChips categories={categories} />
        </section>
      ) : null}

      <section
        id="blog-articles"
        ref={resultsRef}
        className="ds-stack-section scroll-mt-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="blog-section-title">
            {searching
              ? "Resultados"
              : listingPage === 1
                ? "Últimos artículos"
                : `Artículos — página ${listingPage}`}
          </h2>
          {searching && filteredPosts.length > 0 ? (
            <Link href="/blog" className="blog-link text-sm font-medium" onClick={clearSearch}>
              Ver todo el blog
            </Link>
          ) : null}
        </div>

        {visiblePosts.length === 0 ? (
          <div className="blog-empty-panel">
            <DsEmptyState variant="tight">
              {searching ? (
                <>
                  No hay artículos que coincidan.{" "}
                  <button type="button" className="blog-link" onClick={clearSearch}>
                    Limpiar filtros
                  </button>
                </>
              ) : (
                "Todavía no hay artículos publicados."
              )}
            </DsEmptyState>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visiblePosts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>

            {searching ? (
              <BlogSearchPagination
                currentPage={activeSearchPage}
                totalPages={searchTotalPages}
                onPageChange={(page) => {
                  setSearchPage(page);
                  resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            ) : (
              <BlogPagination
                currentPage={listingPage}
                totalPages={listingTotalPages}
                totalItems={listingPosts.length}
                className="mt-8"
              />
            )}
          </>
        )}
      </section>

      {isFirstBlogPage ? (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="blog-about-card">
            <h2 className="blog-section-title">Sobre este blog</h2>
            <p className="blog-about-card__text">
              Compartimos conocimiento sobre venta de fotos online, eventos, tecnología y la
              plataforma ComprameLaFoto para ayudarte a crecer.
            </p>
            <p className="blog-about-card__footnote">
              ¿Buscás algo específico? Usá el buscador de arriba, explorá las categorías o
              suscribite al newsletter.
            </p>
          </div>
          <BlogNewsletterForm source="blog-home" />
        </section>
      ) : null}
    </>
  );
}

type BlogSearchPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

function BlogSearchPagination({ currentPage, totalPages, onPageChange }: BlogSearchPaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
  );

  return (
    <nav className="blog-pagination mt-8" aria-label="Paginación de resultados">
      <ul className="blog-pagination__list">
        <li>
          <button
            type="button"
            className="blog-pagination__control"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            ← Anterior
          </button>
        </li>
        {pageNumbers.map((page, index) => {
          const prev = pageNumbers[index - 1];
          const showEllipsis = prev != null && page - prev > 1;
          return (
            <li key={page} className="flex items-center gap-1">
              {showEllipsis ? <span className="blog-pagination__ellipsis">…</span> : null}
              <button
                type="button"
                className={cn(
                  "blog-pagination__page",
                  page === currentPage && "blog-pagination__page--active"
                )}
                aria-current={page === currentPage ? "page" : undefined}
                onClick={() => onPageChange(page)}
              >
                {page}
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className="blog-pagination__control"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Siguiente →
          </button>
        </li>
      </ul>
    </nav>
  );
}
