import Link from "next/link";
import type { RedaccionVista } from "@/lib/redaccion-queues";

export type SummaryItem = {
  label: string;
  value: number;
  href: string;
  vista?: RedaccionVista;
};

type Props = {
  items: SummaryItem[];
  activeVista?: RedaccionVista;
};

export function RedaccionSummary({ items, activeVista }: Props) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Resumen editorial" className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-muted)]">
        Resumen editorial
      </h2>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr))`,
        }}
      >
        {items.map((item) => {
          const active = item.vista != null && item.vista === activeVista;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`group rounded-[var(--is-radius)] border px-4 py-4 transition-colors ${
                active
                  ? "border-[var(--is-accent)] bg-[var(--is-accent-soft)]"
                  : "border-[var(--is-border)] bg-[var(--is-surface)] hover:border-[var(--is-border-strong)]"
              }`}
            >
              <p className="text-xs leading-snug text-[var(--is-muted)]">{item.label}</p>
              <p className="mt-2 font-[family-name:var(--font-source-serif)] text-3xl font-semibold tabular-nums tracking-tight text-[var(--is-text)]">
                {item.value}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
