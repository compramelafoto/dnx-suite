import Link from "next/link";
import type { RankedRecommendation } from "@repo/recommendations";

function Block({
  title,
  eyebrow,
  items,
}: {
  title: string;
  eyebrow: string;
  items: RankedRecommendation[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-5">
      <div>
        <p className="is-eyebrow">{eyebrow}</p>
        <h2 className="is-h2 mt-2 text-xl md:text-2xl">{title}</h2>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((rec) => (
          <li key={rec.item.id}>
            <Link
              href={rec.item.publicUrl || "#"}
              className="block rounded-xl border border-[var(--is-border)] bg-[var(--is-surface)] p-4 transition hover:border-[var(--is-accent)]"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
                {rec.item.contentType.replaceAll("_", " ")}
                {rec.distanceKm != null
                  ? ` · ${rec.distanceKm < 10 ? rec.distanceKm.toFixed(1) : Math.round(rec.distanceKm)} km`
                  : null}
              </p>
              <p className="mt-2 text-base font-semibold leading-snug">
                {rec.item.title}
              </p>
              {process.env.NODE_ENV === "development" ? (
                <p className="mt-2 text-[11px] text-[var(--is-muted)]" data-rec-explain>
                  {rec.explain.summaryLines.join(" · ")}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type RecommendationBlocksProps = {
  similar: RankedRecommendation[];
  nearby: RankedRecommendation[];
  upcoming: RankedRecommendation[];
  openCalls: RankedRecommendation[];
  coverages: RankedRecommendation[];
};

/**
 * Bloques de recomendación del detalle (motor @repo/recommendations).
 */
export function RecommendationBlocks({
  similar,
  nearby,
  upcoming,
  openCalls,
  coverages,
}: RecommendationBlocksProps) {
  const hasAny =
    similar.length +
      nearby.length +
      upcoming.length +
      openCalls.length +
      coverages.length >
    0;
  if (!hasAny) return null;

  return (
    <div className="space-y-12 border-t border-[var(--is-border)] pt-10">
      <Block
        eyebrow="Recomendado"
        title="También te puede interesar"
        items={similar}
      />
      <Block eyebrow="Cercanía" title="Cerca de este lugar" items={nearby} />
      <Block
        eyebrow="Agenda"
        title="Próximas actividades relacionadas"
        items={upcoming}
      />
      <Block
        eyebrow="Fotógrafos"
        title="Convocatorias relacionadas"
        items={openCalls}
      />
      <Block eyebrow="Visual" title="Coberturas relacionadas" items={coverages} />
    </div>
  );
}
