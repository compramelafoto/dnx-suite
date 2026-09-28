import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSalesAssistantManager } from "@/lib/sales-assistant/access";
import { resumenConexionAlboom } from "@/lib/sales-assistant/alboom/credentials";
import { iaDisponible } from "@/lib/sales-assistant/analyzer";
import {
  ETIQUETA_FILTRO,
  FILTROS_BANDEJA,
  fechaHoraVenta,
  filtroDesdeUrl,
  type FiltroBandeja,
} from "@/lib/sales-assistant/format";
import { diasEntre } from "@/lib/sales-assistant/needs-analysis";
import { normalizarTelefonoArgentino } from "@/lib/sales-assistant/phone";
import { bandeja, leerAjustes, ultimaLecturaBuena } from "@/lib/sales-assistant/repository";
import { ActualizarAhora } from "./acciones-rapidas";
import { SuggestionCard } from "./suggestion-card";

export const dynamic = "force-dynamic";
/**
 * "Actualizar ahora" corre la sincronización entera dentro de la Server Action, que hereda el
 * límite de tiempo de esta página. La acción le da a la corrida entera (lectura de Alboom incluida)
 * 180 s (`PLAZO_CORRIDA_MS`), con margen para el análisis que esté en curso al cumplirse.
 */
export const maxDuration = 300;

const VACIO: Record<FiltroBandeja, string> = {
  HOY: "No hay nada para escribir hoy. Buen momento para mirar «Esperando».",
  ESPERANDO: "No hay oportunidades esperando respuesta.",
  PARA_CERRAR: "No hay oportunidades para cerrar.",
  ARCHIVADAS: "No archivaste ninguna oportunidad.",
};

/**
 * La bandeja del día. Pensada primero para el teléfono: el resumen arriba, una tarjeta por
 * oportunidad debajo, ordenadas por urgencia (eso lo decide `bandeja`, no esta pantalla).
 */
export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { workspace } = await requireSalesAssistantManager();
  const { filtro } = await searchParams;
  const activo = filtroDesdeUrl(filtro);

  const [conexion, ajustes] = await Promise.all([
    resumenConexionAlboom(workspace.id),
    leerAjustes(workspace.id),
  ]);

  if (!conexion) {
    return (
      <div className="space-y-6">
        <PageHeader title="Asistente de ventas" description="Qué hacer hoy con cada presupuesto abierto." />
        <div className="fo-card space-y-3 p-6">
          <p className="text-sm leading-relaxed">
            Para empezar, conectá tu cuenta de Alboom. El asistente lee tus oportunidades abiertas
            todos los días y te propone a quién escribirle y qué decirle.
          </p>
          <Link href="/ventas/configuracion" className="fo-btn fo-btn-primary min-h-11">
            Ir a Configuración
          </Link>
        </div>
      </div>
    );
  }

  // Un solo `ahora` para la lista, los contadores y los "en N días": si cada uno tomara su hora,
  // una oportunidad podría contarse en una pestaña y listarse en otra.
  const ahora = new Date();
  const [hoy, esperando, paraCerrar, archivadas, lecturaBuena] = await Promise.all([
    bandeja(workspace.id, "HOY", ajustes.staleDays, ahora),
    bandeja(workspace.id, "ESPERANDO", ajustes.staleDays, ahora),
    bandeja(workspace.id, "PARA_CERRAR", ajustes.staleDays, ahora),
    bandeja(workspace.id, "ARCHIVADAS", ajustes.staleDays, ahora),
    ajustes.lastSyncStatus === "ERROR_ALBOOM" ? ultimaLecturaBuena(workspace.id) : Promise.resolve(null),
  ]);
  const porFiltro: Record<FiltroBandeja, typeof hoy> = {
    HOY: hoy,
    ESPERANDO: esperando,
    PARA_CERRAR: paraCerrar,
    ARCHIVADAS: archivadas,
  };
  const tarjetas = porFiltro[activo];
  const rechazada = ajustes.lastSyncStatus === "ERROR_LOGIN" || conexion.estado === "NEEDS_RECONSENT";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asistente de ventas"
        description={
          ajustes.lastSyncAt
            ? `Última sincronización: ${fechaHoraVenta(ajustes.lastSyncAt)}.${
                ajustes.lastSyncStatus === "OK" && ajustes.lastSyncMessage ? ` ${ajustes.lastSyncMessage}.` : ""
              }`
            : "Todavía no se sincronizó nunca."
        }
        actions={<ActualizarAhora />}
      />

      {rechazada ? (
        <p
          role="alert"
          className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed text-[var(--fo-danger)]"
        >
          Alboom rechazó el usuario.{" "}
          <Link href="/ventas/configuracion" className="font-medium underline">
            Revisá la conexión
          </Link>
          .
        </p>
      ) : ajustes.lastSyncStatus === "ERROR_ALBOOM" ? (
        <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed">
          No se pudo leer Alboom hoy; lo que ves es de la sincronización anterior
          {lecturaBuena ? ` (${fechaHoraVenta(lecturaBuena)})` : ""}.
        </p>
      ) : null}

      {!iaDisponible() ? (
        <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed">
          Sin sugerencias: falta configurar la IA. Las oportunidades se leen igual, pero sin mensaje
          propuesto.
        </p>
      ) : null}

      <nav className="flex flex-wrap gap-1.5" aria-label="Filtros">
        {FILTROS_BANDEJA.map((f) => {
          const cuantos = porFiltro[f].length;
          const esActiva = f === activo;
          return (
            <Link
              key={f}
              href={`/ventas?filtro=${f.toLowerCase()}`}
              aria-current={esActiva ? "page" : undefined}
              aria-label={`${ETIQUETA_FILTRO[f]}, ${cuantos}`}
              className={`fo-btn min-h-10 text-sm ${esActiva ? "fo-btn-primary" : "fo-btn-secondary"} ${
                cuantos === 0 && !esActiva ? "opacity-60" : ""
              }`}
            >
              <span aria-hidden="true">{ETIQUETA_FILTRO[f]}</span>
              <span
                aria-hidden="true"
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  esActiva ? "bg-white/25" : "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]"
                }`}
              >
                {cuantos}
              </span>
            </Link>
          );
        })}
      </nav>

      {tarjetas.length === 0 ? (
        <p className="fo-card p-6 text-sm leading-relaxed text-[var(--fo-muted)]">{VACIO[activo]}</p>
      ) : (
        <ul className="space-y-3">
          {tarjetas.map((t) => (
            <li key={t.oportunidadId}>
              <SuggestionCard
                tarjeta={t}
                filtro={activo}
                whatsappDisponible={normalizarTelefonoArgentino(t.telefono) !== null}
                alboomUrl={
                  conexion.subdomain
                    ? `https://${conexion.subdomain}.alboomcrm.com/#/leads/view/${encodeURIComponent(t.externalId)}`
                    : null
                }
                diasHastaEvento={t.fechaEvento ? diasEntre(ahora, t.fechaEvento) : null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
