import type { PortfolioPublico as Datos } from "@/lib/presupuesto-automatico/portfolio";

/**
 * El portfolio del tipo de evento en la página pública del presupuesto (spec 2026-10-25), antes del
 * detalle. Sin JavaScript: en el celular es una tira que se desliza con el dedo (cada foto se
 * engancha al borde) y en la compu una grilla. Sólo miniaturas, con carga diferida salvo las
 * primeras; tocar una abre la vista grande. Las URLs son enlaces firmados que vencen.
 */
export function PortfolioPublico({ portfolio }: { portfolio: Datos }) {
  return (
    <section aria-labelledby="portfolio-titulo" className="space-y-3 print:hidden">
      <div>
        <h2 id="portfolio-titulo" className="text-lg font-semibold">Algunos de nuestros trabajos · {portfolio.titulo}</h2>
        <p className="text-sm text-[var(--fo-muted)]">Deslizá para ver más. Abajo tenés tu presupuesto.</p>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {portfolio.fotos.map((f, i) => (
          <li key={f.id} className="w-[70%] shrink-0 snap-start md:w-auto">
            <a href={f.grande ?? f.miniatura} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg bg-[var(--fo-bg-elevated)]">
              {/* Enlace firmado y externo: no pasa por el optimizador de imágenes de Next. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.miniatura}
                alt=""
                loading={i < 2 ? "eager" : "lazy"}
                decoding="async"
                width={f.ancho ?? undefined}
                height={f.alto ?? undefined}
                className="aspect-[4/5] h-auto w-full object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
