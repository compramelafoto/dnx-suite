import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { contarCrudosPorEntidad } from "@/lib/alboom/almacen";
import { resumirAvance, type EstadoEntidad } from "@/lib/alboom/avance";
import { resumenConexionAlboom } from "@/lib/alboom/credenciales";
import { ENTIDADES } from "@/lib/alboom/entidades";
import { ultimaExtraccion, type EstadoExtraccion } from "@/lib/alboom/extracciones";
import { fechaHoraBA } from "@/lib/ficha/formato";
import { AutoRefresco, BorrarLoExtraido, Cancelar, Desconectar, Extraer, ProbarConexion } from "./botones";
import { ConexionForm } from "./conexion-form";

export const dynamic = "force-dynamic";

const ESTADO_EXTRACCION: Record<EstadoExtraccion, string> = {
  PENDIENTE: "Esperando la primera tanda",
  CORRIENDO: "En curso",
  LISTA: "Terminada",
  ERROR: "Frenada por un error",
  CANCELADA: "Cancelada",
};

const ESTADO_ENTIDAD: Record<EstadoEntidad, string> = {
  PENDIENTE: "Pendiente",
  EN_CURSO: "En curso",
  LISTA: "Lista",
  ERROR: "Con error",
  NO_DISPONIBLE: "No disponible",
};

const n = (v: number) => v.toLocaleString("es-AR");

/**
 * Configuración → Migración desde Alboom (etapa 8A). Sólo dueño o administrador. Conecta la cuenta de Alboom
 * (credencial cifrada) y extrae todo el CRM en segundo plano a una tabla de datos crudos. Acá sólo se muestran
 * cantidades y estados: los datos extraídos (de clientes de la institución) nunca llegan al navegador.
 */
export default async function MigracionAlboomPage() {
  const { workspace, role } = await requireActiveWorkspaceRole();

  // El permiso va antes que cualquier lectura.
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Migración desde Alboom" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden migrar desde Alboom.</p>
      </div>
    );
  }

  const [conexion, extraccion, crudos] = await Promise.all([
    resumenConexionAlboom(workspace.id),
    ultimaExtraccion(workspace.id),
    contarCrudosPorEntidad(workspace.id),
  ]);
  const totalCrudos = Object.values(crudos).reduce((s, v) => s + v, 0);
  const activa = extraccion?.status === "PENDIENTE" || extraccion?.status === "CORRIENDO";
  const resumen = extraccion ? resumirAvance(extraccion.avance) : null;
  const esperaHasta = extraccion?.avance.reintentarDesde ? new Date(extraccion.avance.reintentarDesde) : null;

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        title="Migración desde Alboom"
        description="Traé todo tu CRM de Alboom a FotoOffice. Primero se copia tal cual (este paso); después se revisa y se carga en cada módulo."
      />

      <section className="fo-card space-y-4 p-5" aria-labelledby="alboom-cuenta">
        <h2 id="alboom-cuenta" className="text-base font-semibold">
          Cuenta de Alboom
        </h2>
        {conexion?.estado === "ACTIVE" ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-medium text-[var(--fo-success)]">Conectada</span> como <span className="font-medium">{conexion.usuario}</span>
              {conexion.subdomain ? (
                <>
                  {" "}
                  en <span className="font-medium">{conexion.subdomain}.alboomcrm.com</span>
                </>
              ) : null}
              , desde el {fechaHoraBA(conexion.conectadaEn)}.
              {conexion.ultimoUso ? ` Último uso: ${fechaHoraBA(conexion.ultimoUso)}.` : ""}
            </p>
            <ProbarConexion />
            <Desconectar />
          </div>
        ) : (
          <div className="space-y-3">
            {conexion ? (
              <p className="text-sm text-[var(--fo-danger)]" role="alert">
                Alboom rechazó el usuario o la contraseña guardados ({conexion.usuario}). Volvé a conectar la cuenta para seguir.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
                Usá el mismo usuario y contraseña con los que entrás al panel de Alboom. Se guardan cifrados y sólo se usan para
                leer: FotoOffice nunca cambia nada en Alboom.
              </p>
            )}
            <ConexionForm subdomainInicial={conexion?.subdomain ?? ""} usuarioInicial={conexion?.usuario ?? ""} reconectar={Boolean(conexion)} />
            {conexion ? <Desconectar /> : null}
          </div>
        )}
      </section>

      <section className="fo-card space-y-4 p-5" aria-labelledby="alboom-extraccion">
        <h2 id="alboom-extraccion" className="text-base font-semibold">
          Extracción
        </h2>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
          Sólo lee Alboom, de a un pedido por segundo y en tandas cada 5 minutos, así que puede tardar varias horas. Podés cerrar
          esta pantalla: sigue sola. &ldquo;Volver a extraer&rdquo; repasa todo y sólo actualiza lo que cambió.
        </p>

        {extraccion ? (
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-medium">{ESTADO_EXTRACCION[extraccion.status]}</span>
              {extraccion.mode === "INCREMENTAL" ? " (volver a extraer)" : ""} · empezó el {fechaHoraBA(extraccion.startedAt)}
              {extraccion.finishedAt ? ` · terminó el ${fechaHoraBA(extraccion.finishedAt)}` : ""}
            </p>
            {resumen ? (
              <p className="text-[var(--fo-muted)]">
                {n(resumen.terminadas)} de {n(resumen.total)} partes · {n(resumen.registros)} registros leídos · {n(extraccion.avance.pedidos)} pedidos a
                Alboom
                {resumen.errores > 0 ? ` · ${n(resumen.errores)} errores` : ""}
                {resumen.dudas > 0 ? ` · ${n(resumen.dudas)} dudas` : ""}
              </p>
            ) : null}
            {activa && esperaHasta && esperaHasta.getTime() > Date.now() ? (
              <p className="text-[var(--fo-muted)]">Alboom pidió esperar: sigue a partir de las {fechaHoraBA(esperaHasta)}.</p>
            ) : null}
            {extraccion.errorReason ? (
              <p className="text-[var(--fo-danger)]" role="alert">
                {extraccion.errorReason}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm">Todavía no se extrajo nada.</p>
        )}

        {activa ? (
          <>
            <Cancelar />
            <AutoRefresco />
          </>
        ) : conexion?.estado === "ACTIVE" ? (
          totalCrudos > 0 ? <Extraer modo="INCREMENTAL" etiqueta="Volver a extraer" /> : <Extraer modo="TODO" etiqueta="Extraer todo" />
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--fo-muted)]">
                <th className="py-2 pr-3 font-medium">Qué</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 text-right font-medium">Guardados</th>
                <th className="py-2 pr-3 text-right font-medium">Nuevos / cambiados</th>
                <th className="py-2 pr-3 text-right font-medium">Pedidos</th>
                <th className="py-2 pr-3 text-right font-medium">Errores / dudas</th>
                <th className="py-2 font-medium">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {ENTIDADES.map((e) => {
                const a = extraccion?.avance.entidades[e.clave];
                return (
                  <tr key={e.clave} className="border-t border-[var(--fo-border)] align-top">
                    <td className="py-2 pr-3">{e.nombre}</td>
                    <td className={"py-2 pr-3 " + (a?.estado === "ERROR" ? "text-[var(--fo-danger)]" : "")}>
                      {a ? ESTADO_ENTIDAD[a.estado] : "—"}
                      {a?.ultimoError && (a.estado === "ERROR" || a.estado === "NO_DISPONIBLE" || a.errores > 0) ? (
                        <span className="block text-xs text-[var(--fo-muted)]">{a.ultimoError}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{n(crudos[e.clave] ?? 0)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{a ? `${n(a.nuevos)} / ${n(a.cambiados)}` : "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{a ? n(a.paginas) : "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{a ? `${n(a.errores)} / ${n(a.dudas)}` : "—"}</td>
                    <td className="py-2 text-xs text-[var(--fo-muted)]">{a?.actualizado ? fechaHoraBA(a.actualizado) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {totalCrudos > 0 && !activa ? (
        <section className="fo-card space-y-3 p-5" aria-labelledby="alboom-borrar">
          <h2 id="alboom-borrar" className="text-base font-semibold">
            Datos extraídos
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Hay {n(totalCrudos)} registros copiados de Alboom. Son datos personales de tus clientes: sólo los usa la migración y
            se pueden borrar cuando quieras.
          </p>
          <BorrarLoExtraido />
        </section>
      ) : null}
    </div>
  );
}
