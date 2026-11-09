import Link from "next/link";
import { Package } from "lucide-react";
import { requireMembersManageContext } from "@/lib/members/access";
import { cargarRecorridos } from "@/lib/box-mensual/store";
import { direccionDeEnvio, direccionLegible, etiquetaBox } from "@/lib/box-mensual/secuencia";
import { fechaBox, haceDias } from "@/lib/box-mensual/formato";
import { MarcarEnviadaForm } from "@/components/box-mensual/marcar-enviada-form";

export const dynamic = "force-dynamic";

/**
 * «Para enviar»: cada persona que tiene un mes pagado sin su caja, con la caja que le toca.
 * Primero quien más espera.
 */
export default async function BoxParaEnviarPage() {
  const { workspace } = await requireMembersManageContext();
  const now = new Date();
  const { socios, cajas } = await cargarRecorridos(workspace.id, now);

  const paraEnviar = socios
    .filter((s) => s.recorrido.estado === "PARA_ENVIAR")
    .sort(
      (a, b) =>
        (a.recorrido.esperaDesde?.getTime() ?? 0) - (b.recorrido.esperaDesde?.getTime() ?? 0) ||
        a.memberNumber.localeCompare(b.memberNumber, "es", { numeric: true }),
    );
  const alDia = socios.filter((s) => s.recorrido.estado === "AL_DIA" && s.recorrido.enviadas > 0).length;
  const esperandoPago = socios.filter((s) => s.recorrido.estado === "ESPERANDO_PAGO").length;
  const sinDireccion = paraEnviar.filter((s) => direccionDeEnvio(s) === null).length;

  if (cajas.length === 0) {
    return (
      <div className="fo-card flex flex-col items-center text-center py-16 px-6 gap-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
          <Package className="size-7" aria-hidden />
        </div>
        <div className="space-y-2 max-w-md">
          <p className="text-base font-semibold text-[var(--fo-text)]">Todavía no hay cajas cargadas</p>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Cargá la BOX N°1 y las siguientes. Después marcá en Categorías cuáles incluyen la BOX mensual.
          </p>
        </div>
        <Link href="/members/box/cajas/nueva" className="fo-btn fo-btn-primary text-sm">
          Cargar la primera caja
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--fo-muted)]">
        {paraEnviar.length === 0
          ? "No hay cajas para enviar ahora."
          : `${paraEnviar.length} ${paraEnviar.length === 1 ? "persona espera" : "personas esperan"} su caja.`}{" "}
        {esperandoPago > 0 ? `${esperandoPago} con sus cajas al día esperan el próximo pago. ` : ""}
        {alDia > 0 ? `${alDia} ya recibieron todas las cajas cargadas y esperan las nuevas.` : ""}
      </p>
      {sinDireccion > 0 ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {sinDireccion === 1
            ? "A 1 persona le falta la dirección: no se le puede enviar hasta cargarla en su ficha."
            : `A ${sinDireccion} personas les falta la dirección: no se les puede enviar hasta cargarla en su ficha.`}
        </p>
      ) : null}

      {paraEnviar.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full text-sm text-left min-w-[860px]">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Persona socia</th>
                <th className="px-4 py-3 font-semibold">Le toca</th>
                <th className="px-4 py-3 font-semibold">Dirección</th>
                <th className="px-4 py-3 font-semibold">Espera desde</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {paraEnviar.map((s) => {
                const r = s.recorrido;
                const direccion = direccionDeEnvio(s);
                return (
                  <tr key={s.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/members/${s.id}`} className="font-medium text-[var(--fo-text)] hover:underline">
                        {s.lastName}, {s.firstName}
                      </Link>
                      <p className="text-xs text-[var(--fo-muted-soft)]">N° {s.memberNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--fo-text)]">{r.proxima ? etiquetaBox(r.proxima) : "—"}</p>
                      {r.pendientes > 1 ? (
                        <p className="text-xs text-[var(--fo-muted)]">
                          {`Tiene ${r.pendientes} meses pagados sin caja: después sigue con la siguiente.`}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {direccion ? (
                        <span className="text-[var(--fo-text)]">{direccionLegible(direccion)}</span>
                      ) : (
                        <Link href={`/members/${s.id}/edit`} className="text-[var(--fo-danger)] hover:underline">
                          Falta la dirección: cargala
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--fo-muted)]">
                      {r.esperaDesde ? (
                        <>
                          {fechaBox(r.esperaDesde)}
                          <span className="block text-xs text-[var(--fo-muted-soft)]">{haceDias(r.esperaDesde, now)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.proxima ? (
                        <MarcarEnviadaForm memberId={s.id} boxId={r.proxima.id} sinDireccion={direccion === null} />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
