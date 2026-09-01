import Link from "next/link";
import type { ResolvedPortalItem } from "@/lib/portal/menu";
import { PortalIcon } from "./portal-icon";

/**
 * Todas las secciones del portal, disponibles y por venir.
 *
 * Las que faltan se muestran apagadas y con su aviso, en vez de esconderse. En el panel
 * administrativo la regla es la contraria —un módulo apagado no existe— porque ahí una lista de
 * funciones que no andan es una lista de deudas que alguien relee todos los días.
 *
 * Acá el lector es el socio, que entra cada tanto y lo que necesita saber es qué le da la
 * institución por su cuota. Lo que viene es parte de esa respuesta.
 */
export function PortalSections({ items }: { items: ResolvedPortalItem[] }) {
  const disponibles = items.filter((i) => i.state === "DISPONIBLE");
  const proximas = items.filter((i) => i.state === "PROXIMAMENTE");

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Tu espacio</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {disponibles.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className="flex h-full items-start gap-3 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] p-3 transition-colors hover:border-[var(--fo-accent)]"
              >
                <span className="mt-0.5 text-[var(--fo-accent)]">
                  <PortalIcon name={i.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{i.label}</span>
                  <span className="block text-xs leading-relaxed text-[var(--fo-muted)]">
                    {i.description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {proximas.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            En camino{" "}
            <span className="font-normal text-[var(--fo-muted)]">
              ({proximas.length})
            </span>
          </h2>
          <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
            Estas secciones se están construyendo. Te avisamos acá cuando se habiliten.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {proximas.map((i) => (
              <li
                key={i.href}
                className="flex h-full items-start gap-3 rounded-[var(--fo-radius)] border border-dashed border-[var(--fo-border)] p-3"
              >
                <span className="mt-0.5 text-[var(--fo-muted-soft)]">
                  <PortalIcon name={i.icon} />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--fo-muted)]">{i.label}</span>
                    <span className="rounded-full bg-[var(--fo-surface-muted)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--fo-muted)]">
                      Próximamente
                    </span>
                  </span>
                  <span className="block text-xs leading-relaxed text-[var(--fo-muted-soft)]">
                    {i.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
