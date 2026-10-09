import { fechaCorta } from "@/lib/pedidos/pantalla";
import type { EtapaDelPlan } from "@/lib/proyectos/ficha-vista";

const TEXTO_ESTADO: Record<NonNullable<EtapaDelPlan["estado"]>, string> = { hecha: "Hecha", actual: "Etapa actual", pendiente: "Pendiente" };

/**
 * El plan del proyecto: el vencimiento planificado de cada etapa (no se mueve aunque haya atraso),
 * con la etapa actual marcada y el atraso contra su plan.
 */
export function PlanProyecto({ plan, atraso }: { plan: EtapaDelPlan[]; atraso: number }) {
  if (plan.length === 0) return null;
  return (
    <section aria-labelledby="plan-titulo" className="fo-card space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="plan-titulo" className="text-base font-semibold text-[var(--fo-text)]">
          Plan por etapa
        </h2>
        {atraso > 0 ? (
          <span className="text-sm font-medium text-[var(--fo-danger)]">
            Atraso: {atraso} {atraso === 1 ? "día" : "días"}
          </span>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--fo-muted)]">
              <th scope="col" className="py-1 pr-3 font-medium">Etapa</th>
              <th scope="col" className="py-1 pr-3 font-medium">Vence según el plan</th>
              <th scope="col" className="py-1 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((e) => (
              <tr key={e.stageId} className={e.estado === "actual" ? "font-medium" : undefined}>
                <td className="py-1 pr-3 text-[var(--fo-text)]">{e.nombre}</td>
                <td className="py-1 pr-3 tabular-nums text-[var(--fo-text)]">{fechaCorta(e.plan)}</td>
                <td className="py-1 text-[var(--fo-muted)]">{e.estado ? TEXTO_ESTADO[e.estado] : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
