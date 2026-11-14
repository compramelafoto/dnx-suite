import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { puedePedirReventa } from "@/lib/course-marketplace/mercado";
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
        {rotulo} {a.otraParte} ·{" "}
        {a.shareBps === BPS_TOTAL
          ? "Regalado: se queda con todo lo que venda"
          : `${formatoPorcentaje(a.shareBps)} por venta (${pesos(Math.round((a.curso.listaCentavos * a.shareBps) / BPS_TOTAL))})`}{" "}
        · {a.membersFree ? "Gratis para sus socios" : `Descuento para socios ${formatoPorcentaje(a.memberDiscountBps)}`} · {ESTADOS[a.status]}
        {a.invitadoPorDueno ? " (invitación del dueño)" : ""} · {a.fechaRotulo} {fechaLegibleArgentina(a.fecha)} · {a.alumnos}{" "}
        {a.alumnos === 1 ? "alumno" : "alumnos"}
      </p>
      <Link href={`/dashboard/mercado-de-cursos/acuerdos/${a.id}`} className="text-sm underline">
        Ver el curso
      </Link>
    </div>
  );
}

export default async function AcuerdosDeReventaPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { user, workspace } = await requireCoursesSalesContext("VIEW");
  const puedeGestionar = await puedePedirReventa(user.id, workspace.id);
  const { r } = await searchParams;
  const mensaje = mensajeDeAcuerdos(r);
  const { comoDueno, comoRevendedor } = await cargarAcuerdos(workspace.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cursos compartidos"
        description="Con quién compartís tus cursos y qué cursos de otros ofrecés vos. Cualquiera de los dos puede pausar o terminar un acuerdo; quienes ya lo tienen conservan su acceso."
        actions={
          <Link href="/dashboard/mercado-de-cursos" className="fo-btn fo-btn-secondary text-sm">
            Volver al Mercado
          </Link>
        }
      />
      {!puedeGestionar ? (
        <p className="fo-card text-sm text-[var(--fo-muted)]">
          Sólo el dueño o un administrador del negocio puede responder pedidos o cambiar un acuerdo. Acá los ves en modo lectura.
        </p>
      ) : null}
      {mensaje ? (
        <p className="fo-card text-sm" role="status">
          {mensaje}
        </p>
      ) : null}

      <section className="space-y-3" aria-label="Sobre tus cursos">
        <h2 className="text-lg font-semibold">Con quién compartís tus cursos</h2>
        {comoDueno.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no compartiste ningún curso. Lo hacés desde la ficha de cada curso, en «Compartir».
          </p>
        ) : (
          <ul className="space-y-3">
            {comoDueno.map((a) => (
              <li key={a.id} className="fo-card space-y-3">
                <Resumen a={a} rotulo="Lo vende" />
                {puedeGestionar ? <div className="flex flex-wrap gap-2">
                  {a.status === "PENDIENTE" && a.invitadoPorDueno ? (
                    <>
                      <span className="text-sm text-[var(--fo-muted)]">Esperando que {a.otraParte} acepte.</span>
                      <Boton id={a.id} accion="TERMINAR" texto="Cancelar invitación" />
                    </>
                  ) : null}
                  {a.status === "PENDIENTE" && !a.invitadoPorDueno ? (
                    <>
                      <Boton id={a.id} accion="APROBAR" texto="Aprobar" primario />
                      <Boton id={a.id} accion="RECHAZAR" texto="Rechazar" />
                    </>
                  ) : null}
                  {a.status === "ACTIVO" ? <Boton id={a.id} accion="PAUSAR" texto="Pausar" /> : null}
                  {a.status === "PAUSADO" && a.pausadoPorMi ? <Boton id={a.id} accion="REANUDAR" texto="Reanudar" /> : null}
                  {a.status === "ACTIVO" || a.status === "PAUSADO" ? <Boton id={a.id} accion="TERMINAR" texto="Terminar" /> : null}
                </div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-label="Cursos que revendés">
        <h2 className="text-lg font-semibold">Cursos de otros que ofrecés</h2>
        {comoRevendedor.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no vendés cursos de otros. Buscalos en el <Link href="/dashboard/mercado-de-cursos" className="underline">Mercado de cursos</Link>.
          </p>
        ) : (
          <ul className="space-y-3">
            {comoRevendedor.map((a) => (
              <li key={a.id} className="fo-card space-y-3">
                <Resumen a={a} rotulo="De" />
                {puedeGestionar && ESTADOS_VIGENTES.includes(a.status) && !a.membersFree && a.shareBps < BPS_TOTAL ? (
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
                {puedeGestionar ? <div className="flex flex-wrap gap-2">
                  {a.status === "PENDIENTE" && a.invitadoPorDueno ? (
                    <>
                      <Boton id={a.id} accion="APROBAR" texto="Aceptar" primario />
                      <Boton id={a.id} accion="RECHAZAR" texto="Rechazar" />
                    </>
                  ) : null}
                  {a.status === "ACTIVO" ? <Boton id={a.id} accion="PAUSAR" texto="Pausar" /> : null}
                  {a.status === "PAUSADO" && a.pausadoPorMi ? <Boton id={a.id} accion="REANUDAR" texto="Reanudar" /> : null}
                  {ESTADOS_VIGENTES.includes(a.status) && !(a.status === "PENDIENTE" && a.invitadoPorDueno) ? (
                    <Boton id={a.id} accion="TERMINAR" texto={a.status === "PENDIENTE" ? "Cancelar pedido" : "Terminar"} />
                  ) : null}
                </div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
