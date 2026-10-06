import { ctaLabel, deadlineLine, type ShowcaseItem } from "@/lib/contests/showcase";

const ETIQUETA: Record<ShowcaseItem["source"], string> = { fotorank: "FotoRank", clickaton: "Clickatón" };

/**
 * Una tarjeta de la vitrina de concursos. Abre el concurso en su plataforma (FotoRank o Clickatón)
 * en otra pestaña: el socio no pierde su portal.
 */
export function ContestCard({
  item,
  institution,
  now,
  className = "",
}: {
  item: ShowcaseItem;
  institution: string;
  now: Date;
  className?: string;
}) {
  const urgente = item.phase === "open" && item.closesAt !== null && item.closesAt.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
  return (
    <article
      className={`flex flex-col overflow-hidden rounded-[var(--fo-radius)] border bg-[var(--fo-surface)] ${
        item.own ? "border-2 border-[var(--fo-accent)]" : "border-[var(--fo-border)]"
      } ${className}`}
    >
      <div className="relative aspect-[16/9] bg-[var(--fo-surface-muted)]">
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- portadas de otras plataformas de la suite
          <img src={item.coverUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center px-4 text-center text-sm font-semibold text-[var(--fo-text-secondary)]">
            {item.title}
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            item.own ? "bg-[var(--fo-accent)] text-white" : "bg-[var(--fo-surface)]/90 text-[var(--fo-text)]"
          }`}
        >
          {item.own ? `Organiza ${institution}` : ETIQUETA[item.source]}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
        <p className="text-xs text-[var(--fo-muted)]">{item.organizer}</p>
        <p className={`mt-1 text-xs font-medium ${urgente ? "text-[var(--fo-danger)]" : "text-[var(--fo-warning)]"}`}>
          {deadlineLine(item, now)}
        </p>
        <a
          href={item.url}
          target="_blank"
          rel="noopener"
          className={`fo-btn mt-auto justify-center text-sm ${item.phase === "open" ? "fo-btn-primary" : "fo-btn-secondary"}`}
          style={{ marginTop: "0.75rem" }}
        >
          {ctaLabel(item)} ↗
        </a>
      </div>
    </article>
  );
}
