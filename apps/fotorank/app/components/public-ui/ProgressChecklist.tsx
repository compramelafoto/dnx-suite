import type { ChecklistItem } from "../../lib/fotorank/public-ux/participant-status";

type Props = {
  items: ChecklistItem[];
  title?: string;
};

const STATE_LABEL: Record<ChecklistItem["state"], string> = {
  done: "Completado",
  pending: "Pendiente",
  attention: "Requiere atención",
  blocked: "Bloqueado",
  upcoming: "Próximamente",
};

export function ProgressChecklist({ items, title = "Tu progreso" }: Props) {
  return (
    <section aria-labelledby="participant-checklist-title" data-testid="progress-checklist">
      <h2 id="participant-checklist-title" className="fr-public-title text-xl md:text-2xl">
        {title}
      </h2>
      <ol className="fr-public-checklist fr-public-stack-content">
        {items.map((item) => (
          <li key={item.id} className="fr-public-checklist__item" data-state={item.state}>
            <span className="fr-public-checklist__mark" aria-hidden>
              {item.mark}
            </span>
            <div>
              <p className="font-semibold text-[var(--foreground)]">
                {item.title}
                <span className="fr-public-sr-only"> — {STATE_LABEL[item.state]}</span>
              </p>
              <p className="fr-public-body mt-2 text-sm">{item.description}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                {STATE_LABEL[item.state]}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
