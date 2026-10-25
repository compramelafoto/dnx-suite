import { AVISO_DESDE_HOY } from "@/lib/circuitos/ficha-vista";
import type { ProyeccionFicha } from "@/lib/circuitos/ficha";
import { fechaBA } from "@/lib/ficha/formato";

/**
 * Cuándo terminaría cada etapa que falta si se cumplen los plazos. Si la etapa actual ya
 * venció, los plazos se cuentan desde hoy (con una ventana nueva para la etapa actual).
 */
export function Proyeccion({ proyeccion }: { proyeccion: ProyeccionFicha }) {
  return (
    <section aria-labelledby="proyeccion-titulo" className="fo-card space-y-3">
      <h2 id="proyeccion-titulo" className="text-base font-semibold text-[var(--fo-text)]">
        Proyección
      </h2>
      {proyeccion.desdeHoy ? (
        <p role="note" className="fo-alert-warning rounded p-2 text-sm">
          {AVISO_DESDE_HOY}
        </p>
      ) : null}
      {proyeccion.etapas.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">No quedan etapas activas por delante.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--fo-muted)]">
                <th scope="col" className="py-1 pr-3 font-medium">Etapa</th>
                <th scope="col" className="py-1 pr-3 font-medium">Inicio estimado</th>
                <th scope="col" className="py-1 font-medium">Fin estimado</th>
              </tr>
            </thead>
            <tbody>
              {proyeccion.etapas.map((e) => (
                <tr key={e.id} className="border-t border-[var(--fo-border)]">
                  <td className="py-1.5 pr-3 text-[var(--fo-text)]">{e.nombre}</td>
                  <td className="py-1.5 pr-3">{fechaBA(e.inicio)}</td>
                  <td className="py-1.5">{e.fin ? fechaBA(e.fin) : "Sin plazo"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--fo-border)] font-medium">
                <td className="py-1.5 pr-3" colSpan={2}>
                  Total
                </td>
                <td className="py-1.5">{proyeccion.fin ? fechaBA(proyeccion.fin) : "Sin plazo"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
