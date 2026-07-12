import Link from "next/link";
import {
  REDACCION_VISTAS,
  type RedaccionVista,
} from "@/lib/redaccion-queues";

type VistaDef = { id: RedaccionVista; label: string };

type Props = {
  active: RedaccionVista;
  counts?: Partial<Record<RedaccionVista, number>>;
  /** Base path for tabs (default noticias/sala). */
  basePath?: string;
  vistas?: ReadonlyArray<VistaDef>;
};

export function RedaccionViewTabs({
  active,
  counts,
  basePath = "/redaccion",
  vistas = REDACCION_VISTAS,
}: Props) {
  return (
    <nav aria-label="Secciones de trabajo" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
        {vistas.map((vista) => {
          const isActive = active === vista.id;
          const count = counts?.[vista.id];
          const href =
            vista.id === "mi-trabajo"
              ? basePath
              : `${basePath}?vista=${vista.id}`;
          return (
            <li key={vista.id}>
              <Link
                href={href}
                className={`inline-flex min-h-11 items-center gap-2 rounded-[var(--is-radius-sm)] border px-3.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-[var(--is-accent)] bg-[var(--is-accent-soft)] text-[var(--is-accent-hover)]"
                    : "border-[var(--is-border)] bg-white text-[var(--is-text-secondary)] hover:border-[var(--is-border-strong)] hover:text-[var(--is-text)]"
                }`}
              >
                {vista.label}
                {typeof count === "number" ? (
                  <span
                    className={`tabular-nums text-xs ${
                      isActive ? "text-[var(--is-accent-hover)]" : "text-[var(--is-muted)]"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
