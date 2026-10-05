import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { cargarAcuerdos, type AcuerdoVista } from "@/lib/course-marketplace/acuerdos";
import { ESTADOS_VIGENTES, mensajeDeAcuerdos, type AccionReventa } from "@/lib/course-marketplace/reventa";
import { formatoPorcentaje, BPS_TOTAL } from "@/lib/course-marketplace/reparto";
import { pesos } from "@/lib/course-marketplace/formato";
import { fechaLegibleArgentina } from "@/lib/course-classroom/access-rules";
import { cambiarDescuentoDeReventaAction, cambiarEstadoDeReventaAction } from "@/app/actions/course-resale";

export const dynamic = "force-dynamic";

const ESTADOS = { PENDIENTE: "Pendiente", ACTIVO: "Activo", PAUSADO: "Pausado", RECHAZADO: "Rechazado", TERMINADO: "Terminado" } as const;

function Boton({ id, accion, texto, primario = false }: { id: string; accion: AccionReventa; texto: string; primario?: boolean }) {
  return (
    <form action={cambiarEstadoDeReventaAction.bind(null, id, accion)}>
      <button type="submit" className={`fo-btn ${primario ? "fo-btn-primary" : "fo-btn-secondary"} text-sm`}>
        {texto}
      </button>
    </form>
  );
}

function Resumen({ a, rotulo }: { a: AcuerdoVista; rotulo: string }) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{a.curso.titulo}</p>
      <p className="text-sm text-[var(--fo-muted)]">
        {rotulo} {a.otraParte} · {formatoPorcentaje(a.shareBps)} por venta ({pesos(Math.round((a.curso.listaCentavos * a.shareBps) / BPS_TOTAL))}) ·
        Descuento para socios {formatoPorcentaje(a.memberDiscountBps)} · {ESTADOS[a.status]} desde el {fechaLegibleArgentina(a.desde)}
      </p>
    </div>
  );
}

export default async function AcuerdosDeReventaPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { workspace } = await requireCoursesSalesContext("VIEW");
  const { r } = await searchParams;
  const mensaje = mensajeDeAcuerdos(r);
  const { comoDueno, comoRevendedor } = await cargarAcuerdos(workspace.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Acuerdos de reventa"
        description="Quién vende tus cursos y qué cursos de otros vendés vos. Cualquiera de los dos puede pausar o terminar un acuerdo; quienes ya compraron conservan su acceso."
        actions={
          <Link href="/dashboard/mercado-de-cursos" className="fo-btn fo-btn-secondary text-sm">
            Volver al Mercado
          </Link>
        }
      />
      {mensaje ? (
        <p className="fo-card text-sm" role="status">
          {mensaje}
        </p>
      ) : null}

      <section className="space-y-3" aria-label="Sobre tus cursos">
        <h2 className="text-lg font-semibold">Quién vende tus cursos</h2>
        {comoDueno.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Nadie pidió vender tus cursos todavía.</p>
        ) : (
          <ul className="space-y-3">
            {comoDueno.map((a) => (
              <li key={a.id} className="fo-card space-y-3">
                <Resumen a={a} rotulo="Lo vende" />
                <div className="flex flex-wrap gap-2">
                  {a.status === "PENDIENTE" ? (
                    <>
                      <Boton id={a.id} accion="APROBAR" texto="Aprobar" primario />
                      <Boton id={a.id} accion="RECHAZAR" texto="Rechazar" />
                    </>
                  ) : null}
                  {a.status === "ACTIVO" ? <Boton id={a.id} accion="PAUSAR" texto="Pausar" /> : null}
                  {a.status === "PAUSADO" && a.pausadoPorMi ? <Boton id={a.id} accion="REANUDAR" texto="Reanudar" /> : null}
                  {a.status === "ACTIVO" || a.status === "PAUSADO" ? <Boton id={a.id} accion="TERMINAR" texto="Terminar" /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-label="Cursos que revendés">
        <h2 className="text-lg font-semibold">Cursos que vendés</h2>
        {comoRevendedor.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no vendés cursos de otros. Buscalos en el <Link href="/dashboard/mercado-de-cursos" className="underline">Mercado de cursos</Link>.
          </p>
        ) : (
          <ul className="space-y-3">
            {comoRevendedor.map((a) => (
              <li key={a.id} className="fo-card space-y-3">
                <Resumen a={a} rotulo="De" />
                {ESTADOS_VIGENTES.includes(a.status) ? (
                  <form action={cambiarDescuentoDeReventaAction.bind(null, a.id)} className="flex flex-wrap items-end gap-2">
                    <label className="text-sm">
                      Descuento para tus socios (%, hasta {formatoPorcentaje(a.shareBps)}){" "}
                      <input name="descuento" defaultValue={String(a.memberDiscountBps / 100).replace(".", ",")} inputMode="decimal" className="fo-input inline-block w-20" />
                    </label>
                    <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                      Guardar descuento
                    </button>
                  </form>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {a.status === "ACTIVO" ? <Boton id={a.id} accion="PAUSAR" texto="Pausar" /> : null}
                  {a.status === "PAUSADO" && a.pausadoPorMi ? <Boton id={a.id} accion="REANUDAR" texto="Reanudar" /> : null}
                  {ESTADOS_VIGENTES.includes(a.status) ? <Boton id={a.id} accion="TERMINAR" texto={a.status === "PENDIENTE" ? "Cancelar pedido" : "Terminar"} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
