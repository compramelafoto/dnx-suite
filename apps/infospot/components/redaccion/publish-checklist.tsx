import type { PublishChecklistItem } from "@/lib/launch-content";

export function PublishChecklist({
  items,
  title = "Checklist editorial",
}: {
  items: PublishChecklistItem[];
  title?: string;
}) {
  const missing = items.filter((i) => i.required && !i.ok);
  return (
    <aside className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
        {title}
      </p>
      {missing.length > 0 ? (
        <p className="mt-2 text-sm text-amber-800" role="status">
          Faltan campos requeridos antes de publicar: {missing.map((m) => m.label).join(", ")}.
        </p>
      ) : (
        <p className="mt-2 text-sm text-teal-800" role="status">
          Campos requeridos completos. Revisá los opcionales antes de publicar.
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className={`inline-flex size-5 items-center justify-center rounded-full text-xs font-bold ${
                item.ok
                  ? "bg-teal-100 text-teal-800"
                  : item.required
                    ? "bg-amber-100 text-amber-900"
                    : "bg-[var(--is-bg-elevated)] text-[var(--is-muted)]"
              }`}
            >
              {item.ok ? "✓" : "·"}
            </span>
            <span className={item.ok ? "text-[var(--is-text)]" : "text-[var(--is-text-secondary)]"}>
              {item.label}
              {item.required ? "" : " (opcional)"}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
