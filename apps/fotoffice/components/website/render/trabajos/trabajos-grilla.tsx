import Link from "next/link";
import type { TrabajoTarjeta } from "@/lib/trabajos/publico";
import { BLOG_HEADING_STYLE, BLOG_SOFT_BG } from "@/components/website/blog/blog-post-card";

/**
 * Las tarjetas de Trabajos. La comparten las páginas públicas (`/trabajos`, una categoría, «También
 * vieron») y el bloque PORTFOLIO — que también se dibuja en la vista previa del constructor
 * (cliente), así que no consulta nada ni usa hooks.
 *
 * No hay redimensionador de imágenes en el sitio: la portada va con su dirección original, con
 * carga diferida y el tamaño lo pone el CSS.
 */

export type TrabajosLayout = "grid" | "masonry";

/** Sólo direcciones https o rutas propias: nada de `javascript:` ni `data:`. */
export function urlMostrable(url: string | null | undefined): url is string {
  return typeof url === "string" && (/^https:\/\//i.test(url) || /^\/(?![\/\\])/.test(url));
}

function Portada({ src, alt, masonry }: { src: string | null; alt: string; masonry: boolean }) {
  if (!urlMostrable(src)) {
    // Sin portada, un bloque con los colores de la institución: la grilla no queda con huecos.
    return (
      <div
        aria-hidden
        className="aspect-[4/3] w-full"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--wsite-primary) 85%, transparent), color-mix(in srgb, var(--wsite-accent) 70%, transparent))",
        }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- las portadas viven en R2
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`w-full transition-transform duration-500 group-hover:scale-[1.03] ${masonry ? "h-auto" : "aspect-[4/3] object-cover"}`}
    />
  );
}

export function TrabajoCard({ trabajo, masonry = false }: { trabajo: TrabajoTarjeta; masonry?: boolean }) {
  const detalle = [trabajo.lugar, trabajo.fechaTexto].filter(Boolean).join(" · ");
  // Sin precarga: la ficha suma una vista al abrirse, y una precarga la contaría sin que nadie entre.
  return (
    <Link href={trabajo.href} prefetch={false} className={`group block ${masonry ? "mb-6 break-inside-avoid" : ""}`}>
      <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: BLOG_SOFT_BG }}>
        <Portada src={trabajo.portadaUrl} alt={trabajo.titulo} masonry={masonry} />
      </div>
      <div className="space-y-1 pt-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--wsite-primary)" }}>
          {trabajo.categoriaNombre}
        </p>
        <h3 className="text-lg leading-snug break-words group-hover:underline" style={BLOG_HEADING_STYLE}>
          {trabajo.titulo}
        </h3>
        {detalle ? (
          <p className="text-sm" style={{ opacity: 0.65 }}>
            {detalle}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function TrabajosGrilla({ trabajos, layout = "grid" }: { trabajos: TrabajoTarjeta[]; layout?: TrabajosLayout }) {
  if (layout === "masonry") {
    return (
      <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
        {trabajos.map((t) => (
          <TrabajoCard key={t.href} trabajo={t} masonry />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {trabajos.map((t) => (
        <TrabajoCard key={t.href} trabajo={t} />
      ))}
    </div>
  );
}
