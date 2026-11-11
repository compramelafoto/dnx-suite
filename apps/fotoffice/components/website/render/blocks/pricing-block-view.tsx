import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { pricingLines, type PricingBlockConfig, type PricingPlan } from "@/lib/website/blocks";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";
import { enlaceDeBoton } from "@/lib/website/button-href";
import { levelStyle } from "@/lib/website/typography";

const PRINCIPAL = "var(--wsite-primary)";
const FONDO = "var(--wsite-bg)";

/** Dos planes van lado a lado al medio; con tres o cuatro, uno por columna. */
function columnas(n: number): string {
  if (n <= 1) return "mx-auto max-w-md";
  if (n === 2) return "mx-auto max-w-4xl md:grid-cols-2";
  if (n === 3) return "mx-auto max-w-6xl md:grid-cols-3";
  return "mx-auto max-w-6xl md:grid-cols-2 xl:grid-cols-4";
}

/**
 * El trazo a mano alrededor del plan destacado: un rectángulo dibujado con lápiz, apenas torcido,
 * que sobresale del borde de la tarjeta. Se estira con la tarjeta (`preserveAspectRatio="none"`)
 * sin engordar la línea (`non-scaling-stroke`).
 */
function TrazoAMano() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 600"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -left-4 -top-4 h-[calc(100%+2rem)] w-[calc(100%+2rem)] -rotate-[1.2deg]"
    >
      <path
        d="M8 9 C 130 2, 270 5, 394 5 C 398 150, 396 420, 393 594 C 270 598, 130 597, 5 593 C 1 420, 3 160, 4 13 C 50 5, 110 3, 185 6"
        fill="none"
        stroke={`color-mix(in srgb, ${PRINCIPAL} 70%, ${FONDO})`}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Plan({ plan, href }: { plan: PricingPlan; href: string | null }) {
  const destacado = plan.highlighted;
  const tinta = destacado ? FONDO : "var(--wsite-body-color, var(--wsite-text))";
  const features = pricingLines(plan.features);
  const tarjeta: CSSProperties = destacado
    ? { backgroundColor: PRINCIPAL, color: FONDO }
    : { backgroundColor: FONDO, color: tinta, border: `1px solid color-mix(in srgb, ${PRINCIPAL} 22%, transparent)` };
  const externo = href ? /^https?:\/\//i.test(href) : false;

  return (
    <li className={`relative flex ${destacado ? "md:-my-5" : ""}`}>
      {destacado ? <TrazoAMano /> : null}
      <div className="relative flex w-full flex-col rounded-[1.25rem] px-6 pb-7 pt-9 sm:px-8" style={tarjeta}>
        {plan.badge.trim() ? (
          <span
            className="absolute -top-3.5 left-6 rounded-full px-3.5 py-1 text-sm font-semibold sm:left-8"
            style={
              destacado
                ? { backgroundColor: FONDO, color: PRINCIPAL, border: `1.5px solid ${PRINCIPAL}` }
                : { backgroundColor: PRINCIPAL, color: FONDO }
            }
          >
            {plan.badge}
          </span>
        ) : null}

        {plan.name.trim() ? (
          <h3 className="text-xl leading-snug" style={{ ...levelStyle("heading", { color: false }), fontSize: "1.375rem", color: tinta }}>
            {plan.name}
          </h3>
        ) : null}
        {plan.tagline.trim() ? (
          <p className="mt-2 text-[0.95rem] leading-relaxed" style={{ opacity: 0.82 }}>
            {plan.tagline}
          </p>
        ) : null}

        {plan.price.trim() ? (
          <p className="mt-6 flex flex-wrap items-baseline gap-x-2">
            <span
              className="text-5xl leading-none tabular-nums sm:text-[3.25rem]"
              style={{ fontFamily: "var(--wsite-heading-font)", fontWeight: 600, letterSpacing: "-0.02em" }}
            >
              {plan.price}
            </span>
            {plan.period.trim() ? <span className="text-base" style={{ opacity: 0.75 }}>{plan.period}</span> : null}
          </p>
        ) : null}

        {plan.valueNote.trim() ? (
          <p
            className="mt-4 rounded-xl px-4 py-3 text-[0.95rem] font-medium leading-snug"
            style={{ backgroundColor: `color-mix(in srgb, currentColor 12%, transparent)` }}
          >
            {plan.valueNote}
          </p>
        ) : null}

        {features.length > 0 ? (
          <div className="mt-6 flex-1">
            {plan.featuresLead.trim() ? <p className="mb-3 text-[0.95rem] font-semibold">{plan.featuresLead}</p> : null}
            <ul className="space-y-3">
              {features.map((f, i) => (
                <li key={i} className="flex gap-3 text-[0.95rem] leading-snug">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={destacado ? { backgroundColor: FONDO, color: PRINCIPAL } : { backgroundColor: PRINCIPAL, color: FONDO }}
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {href && plan.buttonLabel.trim() ? (
          <a
            href={href}
            {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="mt-8 inline-flex w-full items-center justify-center text-center transition-transform hover:scale-[1.015] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{
              ...levelStyle("button", { color: false }),
              borderRadius: "var(--wsite-button-radius)",
              paddingInline: "var(--wsite-button-padding-x)",
              paddingBlock: "calc(var(--wsite-button-padding-y) + 0.25rem)",
              ...(destacado
                ? { backgroundColor: FONDO, color: PRINCIPAL, outlineColor: FONDO }
                : { backgroundColor: PRINCIPAL, color: FONDO, outlineColor: PRINCIPAL }),
            }}
          >
            {plan.buttonLabel}
          </a>
        ) : null}
        {plan.footnote.trim() ? (
          <p className="mt-3 text-center text-sm" style={{ opacity: 0.72 }}>
            {plan.footnote}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Planes y precios. Los planes van lado a lado (en el teléfono, uno debajo del otro, en el orden
 * cargado); el destacado se dibuja lleno con el color principal, un poco más alto y rodeado por un
 * trazo a mano. Los planes sin nombre ni precio no se dibujan; sin ninguno, en el sitio la sección
 * no aparece y en la vista previa del constructor se ve un aviso.
 */
export function PricingBlockView({ config, data }: { config: PricingBlockConfig; blockId?: string; data?: WebsiteDynamicData }) {
  const preview = data === undefined;
  const plans = config.plans.filter((p) => p.name.trim() || p.price.trim());
  if (plans.length === 0) {
    if (!preview) return null;
    return (
      <section className="px-6 py-12">
        <p className="mx-auto max-w-3xl rounded-2xl border border-dashed p-8 text-center opacity-60" style={levelStyle("body", { color: true })}>
          Cargá los planes: nombre, precio, lo que incluye cada uno y su botón.
        </p>
      </section>
    );
  }
  const tranquilidades = pricingLines(config.reassurance);

  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        {config.title.trim() || config.intro.trim() ? (
          <div className="mx-auto mb-14 max-w-2xl space-y-4 text-center">
            {config.title.trim() ? (
              <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
            ) : null}
            {config.intro.trim() ? (
              <p className="whitespace-pre-line leading-relaxed" style={{ ...levelStyle("body", { color: true }), opacity: 0.85 }}>
                {config.intro}
              </p>
            ) : null}
          </div>
        ) : null}

        <ul className={`grid grid-cols-1 items-stretch gap-x-8 gap-y-12 ${columnas(plans.length)}`}>
          {plans.map((plan, i) => (
            <Plan key={plan.id || i} plan={plan} href={enlaceDeBoton(plan.buttonUrl, data?.paginasDelSitio)} />
          ))}
        </ul>

        {tranquilidades.length > 0 ? (
          <ul className="mx-auto mt-14 flex max-w-4xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8" style={levelStyle("body", { color: true })}>
            {tranquilidades.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-[0.95rem] leading-snug">
                <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" style={{ color: PRINCIPAL }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
