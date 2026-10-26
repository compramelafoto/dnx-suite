import { absoluteUrl } from "@/lib/blog/public-format";
import type { TrabajoPublico } from "./publico";

/**
 * Piezas puras de las páginas públicas de Trabajos (`app/w/[workspaceSlug]/trabajos/**`): la
 * paginación, el enlace de «Pedir presupuesto» y el JSON-LD de la ficha. Sin base ni request,
 * para poder probarlas solas.
 */

/** Trabajos por página en `/trabajos` y en cada categoría. */
export const TRABAJOS_POR_PAGINA = 24;

/** Fotos que se describen en el JSON-LD: Google no necesita las 300, y el HTML no se infla. */
const FOTOS_EN_JSON_LD = 50;

/** `?pagina=` tal como llega: cualquier cosa que no sea un entero ≥ 1 es la página 1. */
export function numeroDePagina(raw: string | string[] | undefined): number {
  const valor = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

export function totalDePaginas(total: number): number {
  return Math.max(1, Math.ceil(total / TRABAJOS_POR_PAGINA));
}

/**
 * Adónde lleva «Pedir presupuesto»: el formulario con la categoría de Consultas que se llama
 * igual que la del trabajo, o sin categoría. `null` con Consultas apagado (no hay formulario y el
 * botón no se muestra).
 */
export function enlacePresupuesto(workspaceSlug: string, consultasEncendido: boolean, categoriaConsultaId: string | null): string | null {
  if (!consultasEncendido) return null;
  const base = `/w/${workspaceSlug}/presupuesto`;
  return categoriaConsultaId ? `${base}?categoria=${encodeURIComponent(categoriaConsultaId)}` : base;
}

/**
 * El JSON-LD `ImageGallery` de la ficha de un trabajo, listo para un `<script>`. Sólo fotos (los
 * videos por enlace no son imágenes). El `<` se escapa para que un título con `</script>` no
 * corte el script.
 */
export function serializarGaleriaJsonLd(input: {
  trabajo: Pick<TrabajoPublico, "titulo" | "categoriaNombre" | "lugar" | "portadaUrl" | "fotos">;
  url: string;
  descripcion: string;
  nombreSitio: string;
  urlSitio: string;
  appBase: string;
}): string {
  const { trabajo } = input;
  const imagenes = trabajo.fotos
    .filter((f) => f.tipo === "FOTO")
    .slice(0, FOTOS_EN_JSON_LD)
    .flatMap((f) => {
      const contentUrl = absoluteUrl(input.appBase, f.url);
      if (!contentUrl) return [];
      return [
        {
          "@type": "ImageObject",
          contentUrl,
          ...(f.ancho ? { width: f.ancho } : {}),
          ...(f.alto ? { height: f.alto } : {}),
          ...(f.alt ? { caption: f.alt } : {}),
        },
      ];
    });
  const portada = absoluteUrl(input.appBase, trabajo.portadaUrl);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: trabajo.titulo,
    description: input.descripcion,
    url: input.url,
    genre: trabajo.categoriaNombre,
    ...(trabajo.lugar ? { contentLocation: { "@type": "Place", name: trabajo.lugar } } : {}),
    ...(portada ? { thumbnailUrl: portada } : {}),
    image: imagenes,
    publisher: { "@type": "Organization", name: input.nombreSitio, url: input.urlSitio },
  };
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}
