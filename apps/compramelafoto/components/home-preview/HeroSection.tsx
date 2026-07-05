"use client";

import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import { usePreviewSearch } from "@/components/home-preview/PreviewSearchContext";
import { cn } from "@/lib/utils";

export default function HeroSection() {
  const { query, setQuery, goToSearch } = usePreviewSearch();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    goToSearch("albumes-disponibles", query);
  }

  return (
    <PreviewSection id="inicio" variant="accent" className="!pt-10 md:!pt-14 !pb-12 md:!pb-16">
      <PreviewReveal className="w-full max-w-[min(100%,42rem)] mx-auto flex flex-col items-center text-center min-w-0 box-border">
        <h1 className="text-4xl sm:text-5xl md:text-[3.25rem] font-semibold leading-[1.08] text-[#111827] m-0 tracking-tight text-balance">
          Encontrá tus fotos
        </h1>
        <p className="text-base sm:text-lg text-[#6b7280] mt-4 mb-0 leading-relaxed max-w-[min(100%,36rem)] mx-auto">
          Buscá por evento, escuela, club, fotógrafo o código de acceso.
        </p>

        <div className="mt-8 w-full flex flex-col items-center min-w-0">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-2xl min-w-0 box-border"
          >
            <label htmlFor="hero-search-input" className="sr-only">
              Buscar fotos
            </label>
            <div
              className={cn(
                "flex w-full min-w-0 gap-3",
                "flex-col sm:flex-row sm:items-stretch sm:justify-center"
              )}
            >
              <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[12rem] sm:max-w-md">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none z-[1]"
                  aria-hidden
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="7" />
                    <path strokeLinecap="round" d="m20 20-3.5-3.5" />
                  </svg>
                </span>
                <input
                  id="hero-search-input"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ej: maratón, colegio San Martín, Juan Pérez…"
                  className={cn(
                    "block w-full min-w-0 h-12 sm:h-14 pl-12 pr-4 rounded-xl border border-[#e5e7eb] bg-white",
                    "text-base text-[#111827] placeholder:text-[#9ca3af]",
                    "focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/25 focus:border-[#c27b3d]/50 transition-shadow",
                    "box-border"
                  )}
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                className={cn(
                  "w-full sm:w-auto sm:shrink-0 sm:min-w-[11.5rem]",
                  "h-12 sm:h-14 px-6 rounded-xl",
                  "bg-[#c27b3d] text-white text-sm font-medium whitespace-nowrap",
                  "hover:bg-[#b06d35] active:bg-[#9a5f2f] transition-colors",
                  "box-border"
                )}
              >
                Buscar fotos
              </button>
            </div>
          </form>
        </div>
      </PreviewReveal>
    </PreviewSection>
  );
}
