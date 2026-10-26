import Link from "next/link";
import { PORTFOLIO_DEFAULT_TITLE, type PortfolioBlockConfig } from "@/lib/website/blocks";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";
import type { TrabajoTarjeta } from "@/lib/trabajos/publico";
import { BLOG_HEADING_STYLE } from "@/components/website/blog/blog-post-card";
import { TrabajosGrilla } from "@/components/website/render/trabajos/trabajos-grilla";

/**
 * Tarjetas de ejemplo para la vista previa del constructor: ahí el renderer corre en el navegador
 * y no recibe los trabajos (ver `dynamic-data.ts`). Muestran la forma, no contenido real.
 */
function ejemplos(count: number): TrabajoTarjeta[] {
  return Array.from({ length: count }, (_, i) => ({
    titulo: "Así se va a ver el título de un trabajo",
    slug: `ejemplo-${i + 1}`,
    categoriaSlug: "categoria",
    categoriaNombre: "Categoría",
    lugar: "Lugar",
    fechaTexto: "14 de marzo de 2025",
    portadaUrl: null,
    href: "#",
  }));
}

/**
 * "Trabajos": las últimas N tarjetas de trabajos publicados y un enlace a todos.
 *
 * En el sitio (`data` presente), sin trabajos para este bloque no se dibuja: una sección vacía en
 * la portada se ve rota. Sin `data` (vista previa del constructor) muestra ejemplos.
 */
export function PortfolioBlockView({ config, blockId, data }: { config: PortfolioBlockConfig; blockId?: string; data?: WebsiteDynamicData }) {
  const real = data === undefined ? null : blockId ? data.portfolio?.[blockId] : undefined;
  if (real !== null && (!real || real.tarjetas.length === 0)) return null;

  const tarjetas = real ? real.tarjetas.slice(0, config.count) : ejemplos(config.count);
  const verTodosHref = real?.verTodosHref ?? "#";

  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl" style={BLOG_HEADING_STYLE}>
            {config.title?.trim() || PORTFOLIO_DEFAULT_TITLE}
          </h2>
          {config.showViewAll ? (
            <Link href={verTodosHref} className="text-sm font-semibold" style={{ color: "var(--wsite-primary)" }}>
              Ver todos los trabajos →
            </Link>
          ) : null}
        </div>
        <TrabajosGrilla trabajos={tarjetas} layout={config.layout} />
      </div>
    </section>
  );
}
