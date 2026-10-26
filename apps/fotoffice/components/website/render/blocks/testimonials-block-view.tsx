import Link from "next/link";
import { TESTIMONIALS_DEFAULT_CTA, TESTIMONIALS_DEFAULT_TITLE, type TestimonialsBlockConfig } from "@/lib/website/blocks";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";
import type { TestimonioPublico } from "@/lib/testimonios/publico";
import { BLOG_HEADING_STYLE } from "@/components/website/blog/blog-post-card";
import { TestimoniosGrilla } from "@/components/website/render/testimonios/testimonio-card";
import { TestimoniosCarrusel } from "@/components/website/render/testimonios/testimonios-carrusel";

/**
 * Testimonios de ejemplo para la vista previa del constructor: ahí el renderer corre en el navegador
 * y no recibe los reales (ver `dynamic-data.ts`). Muestran la forma, no contenido real.
 */
function ejemplos(count: number): TestimonioPublico[] {
  const textos = [
    "Así se va a ver un testimonio corto de un cliente.",
    "Así se va a ver un testimonio un poco más largo: cada tarjeta mide lo que ocupa su texto, así las citas cortas no quedan con un hueco abajo y las largas se leen completas con «Leer más».",
    "Otro ejemplo de testimonio, con su calificación y el detalle de quién lo escribió.",
  ];
  return Array.from({ length: count || 3 }, (_, i) => ({
    id: `ejemplo-${i + 1}`,
    texto: textos[i % textos.length]!,
    extracto: null,
    autorNombre: "Nombre del cliente",
    autorDetalle: "Detalle (por ejemplo, el evento)",
    autorFotoUrl: null,
    autorEnlace: null,
    calificacion: 5,
  }));
}

/**
 * "Testimonios": los testimonios PUBLICADOS (con permiso del autor), en carrusel o en grilla, con el
 * botón al formulario para dejar uno.
 *
 * En el sitio (`data` presente), sin ninguno publicado no se dibuja: una sección vacía en la portada
 * se ve rota. Sin `data` (vista previa del constructor) muestra ejemplos.
 */
export function TestimonialsBlockView({ config, data }: { config: TestimonialsBlockConfig; blockId?: string; data?: WebsiteDynamicData }) {
  const real = data === undefined ? null : data.testimonios;
  if (real !== null && (!real || real.items.length === 0)) return null;

  const todos = real ? real.items : ejemplos(config.count);
  const testimonios = config.count === 0 ? todos : todos.slice(0, config.count);
  const formularioHref = real?.formularioHref ?? "#";
  const verTodosHref = real?.verTodosHref ?? "#";

  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl" style={BLOG_HEADING_STYLE}>
            {config.title?.trim() || TESTIMONIALS_DEFAULT_TITLE}
          </h2>
          {config.count !== 0 && todos.length > testimonios.length ? (
            <Link href={verTodosHref} className="text-sm font-semibold" style={{ color: "var(--wsite-primary)" }}>
              Ver todos los testimonios →
            </Link>
          ) : null}
        </div>
        {config.layout === "grid" ? <TestimoniosGrilla testimonios={testimonios} /> : <TestimoniosCarrusel testimonios={testimonios} />}
        {config.showCta ? (
          <div className="flex justify-center">
            <Link
              href={formularioHref}
              className="inline-flex font-semibold"
              style={{
                borderRadius: "var(--wsite-button-radius)",
                paddingInline: "var(--wsite-button-padding-x)",
                paddingBlock: "var(--wsite-button-padding-y)",
                backgroundColor: "var(--wsite-primary)",
                color: "#ffffff",
              }}
            >
              {config.ctaLabel?.trim() || TESTIMONIALS_DEFAULT_CTA}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
