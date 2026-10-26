import type { TestimonioPublico } from "@/lib/testimonios/publico";
import { BLOG_HEADING_STYLE, BLOG_SOFT_BG, BLOG_SOFT_BORDER } from "@/components/website/blog/blog-post-card";
import { urlMostrable } from "@/components/website/render/trabajos/trabajos-grilla";
import { TextoLeerMas } from "./texto-leer-mas";

/**
 * La tarjeta de un testimonio. La comparten el bloque TESTIMONIALS (que también se dibuja en la vista
 * previa del constructor, en el navegador) y la página `/testimonios`: no consulta nada ni usa hooks.
 * Mide lo que ocupa su texto: en el carrusel y en la grilla nunca se estira a la altura de la más larga.
 */

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** El enlace del autor ya se validó al guardarlo; se vuelve a mirar porque termina en un `href`. */
function enlaceSeguro(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/**
 * La foto ya llega filtrada por `listarTestimoniosPublicos` (`fotoPublicaDelAutor`): sólo del bucket
 * público de FOTOFFICE, armada de la key, o una ruta propia; lo demás llega en null. La tarjeta
 * también se dibuja en el navegador, donde no se conoce el bucket: acá se vuelve a mirar la forma
 * (https o ruta propia, nunca `//otro-sitio`) y, si no sirve, van las iniciales.
 */
function Avatar({ t }: { t: TestimonioPublico }) {
  if (urlMostrable(t.autorFotoUrl)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- las fotos viven en R2
      <img src={t.autorFotoUrl} alt="" loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      style={{ backgroundColor: "color-mix(in srgb, var(--wsite-primary) 15%, transparent)", color: "var(--wsite-primary)" }}
    >
      {iniciales(t.autorNombre)}
    </span>
  );
}

function Estrellas({ n }: { n: number }) {
  return (
    <p className="text-base tracking-[0.15em]" style={{ color: "var(--wsite-primary)" }}>
      <span aria-hidden>{"★".repeat(n)}</span>
      <span aria-hidden style={{ opacity: 0.25 }}>
        {"★".repeat(5 - n)}
      </span>
      <span className="sr-only">{`${n} de 5 estrellas`}</span>
    </p>
  );
}

export function TestimonioCard({ testimonio: t }: { testimonio: TestimonioPublico }) {
  const enlace = enlaceSeguro(t.autorEnlace);
  return (
    <figure
      className="flex h-auto flex-col gap-4 rounded-2xl border p-6"
      style={{ borderColor: BLOG_SOFT_BORDER, backgroundColor: BLOG_SOFT_BG, color: "var(--wsite-text)" }}
    >
      {t.calificacion ? <Estrellas n={Math.min(5, Math.max(1, t.calificacion))} /> : null}
      <blockquote className="space-y-3 leading-relaxed">
        {t.extracto ? (
          <p className="text-lg leading-snug break-words" style={BLOG_HEADING_STYLE}>
            «{t.extracto}»
          </p>
        ) : null}
        <TextoLeerMas texto={t.texto} />
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3 pt-2">
        <Avatar t={t} />
        <span className="flex min-w-0 flex-col">
          {enlace ? (
            <a href={enlace} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold break-words hover:underline">
              {t.autorNombre}
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          ) : (
            <span className="font-semibold break-words">{t.autorNombre}</span>
          )}
          {t.autorDetalle ? (
            <span className="text-sm break-words" style={{ opacity: 0.65 }}>
              {t.autorDetalle}
            </span>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}

/** Grilla de testimonios: `items-start` para que cada tarjeta mida lo suyo. */
export function TestimoniosGrilla({ testimonios }: { testimonios: readonly TestimonioPublico[] }) {
  return (
    <ul className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {testimonios.map((t) => (
        <li key={t.id}>
          <TestimonioCard testimonio={t} />
        </li>
      ))}
    </ul>
  );
}
