import Link from "next/link";
import { requireMembersManageContext } from "@/lib/members/access";
import { listarCajas } from "@/lib/box-mensual/store";
import { etiquetaBox } from "@/lib/box-mensual/secuencia";

export const dynamic = "force-dynamic";

/** «Cajas»: el catálogo del recorrido, por N°. Se agregan nuevas (N°11 en adelante) y se desactivan. */
export default async function BoxCajasPage() {
  const { workspace } = await requireMembersManageContext();
  const cajas = await listarCajas(workspace.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--fo-muted)] max-w-2xl">
          Las personas socias reciben las cajas activas de menor a mayor. Después de la última quedan al
          día, y siguen con las nuevas que cargues.
        </p>
        <Link href="/members/box/cajas/nueva" className="fo-btn fo-btn-primary text-sm">
          Nueva caja
        </Link>
      </div>

      {cajas.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay cajas cargadas.</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {cajas.map((c) => (
            <li key={c.id} className="fo-card space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-[var(--fo-text)]">{etiquetaBox(c)}</h2>
                  <p className="text-xs text-[var(--fo-muted-soft)]">
                    {c.isActive ? "Activa" : "Desactivada"} ·{" "}
                    {c.enviadas === 1 ? "1 enviada" : `${c.enviadas} enviadas`}
                  </p>
                </div>
                <Link
                  href={`/members/box/cajas/${c.id}`}
                  className="shrink-0 text-sm text-[var(--fo-accent)] font-medium hover:underline"
                >
                  Editar
                </Link>
              </div>
              {c.description ? <p className="text-sm text-[var(--fo-muted)]">{c.description}</p> : null}
              <ul className="text-sm divide-y divide-[var(--fo-border)]">
                {c.materials.map((m) => (
                  <li key={m.material} className="flex justify-between gap-3 py-1">
                    <span className="text-[var(--fo-text)]">{m.material}</span>
                    <span className="tabular-nums text-[var(--fo-muted)]">{m.perBox}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
