import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { EstadoSolicitudChip } from "@/components/coberturas/estado-chip";
import { requireCoveragesReviewer } from "@/lib/coverages/access";
import { fechaArgentina } from "@/lib/coverages/format";
import {
  INBOX_FILTERS,
  inboxFilterByKey,
  isInboxFilter,
  type InboxFilterGroup,
  type InboxFilterKey,
} from "@/lib/coverages/inbox-filters";
import {
  countRequestsByFilter,
  listRequests,
  loadSettings,
} from "@/lib/coverages/repository";
import { terminologyFor } from "@/lib/coverages/terminology";

export const dynamic = "force-dynamic";

/**
 * La bandeja de la coordinación.
 *
 * Ordenada por fecha de la actividad y no por fecha de carga: lo que urge es lo que ocurre
 * primero, no lo que entró primero. Un pedido de ayer para dentro de seis meses puede esperar;
 * uno de hace una hora para el sábado, no.
 *
 * **Las pestañas van en dos filas, trabajo y archivo.** Una institución que viene usando el
 * módulo tiene sesenta y pico de pedidos cerrados y uno vivo; con las siete pestañas en una sola
 * fila, «Cerradas» pesaba lo mismo que «Nuevas» y había que acordarse de cuál era cuál.
 */
export default async function CoberturasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { workspace } = await requireCoveragesReviewer();
  const { filtro } = await searchParams;
  const activo = isInboxFilter(filtro) ? filtro : "nuevas";

  // Un solo `now` para la lista y para los contadores: dos pestañas dependen de la fecha, y
  // tomar la hora por separado podría dejar un pedido contado en una y listado en otra.
  const ahora = new Date();
  const [settings, solicitudes, cuentas] = await Promise.all([
    loadSettings(workspace.id),
    listRequests({ workspaceId: workspace.id, filter: activo, now: ahora }),
    countRequestsByFilter({ workspaceId: workspace.id, now: ahora }),
  ]);
  const t = terminologyFor(settings);
  const pestania = inboxFilterByKey(activo);

  return (
    <div className="space-y-6">
      <PageHeader title={t.module} description={`Los pedidos que recibe ${workspace.name}.`} />

      <nav className="space-y-3" aria-label="Filtros">
        <Grupo
          grupo="pendientes"
          titulo="Lo que hay que atender"
          activo={activo}
          cuentas={cuentas}
        />
        <Grupo grupo="archivo" titulo="Archivo" activo={activo} cuentas={cuentas} />
      </nav>

      {solicitudes.length === 0 ? (
        <p className="fo-card p-6 text-sm leading-relaxed text-[var(--fo-muted)]">
          {pestania?.vacio ?? "No hay nada acá."}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[var(--fo-muted)]">
            {solicitudes.length === 1 ? "1 pedido" : `${solicitudes.length} pedidos`} en «
            {pestania?.label ?? activo}»
          </p>
          <ul className="space-y-2">
            {solicitudes.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/coberturas/${s.id}`}
                  className="fo-card block !p-4 transition-colors hover:bg-[var(--fo-surface-hover)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0 space-y-1">
                      {/*
                        Qué actividad es, primero y en grande: es lo único con lo que quien
                        coordina reconoce un pedido. El código público iba arriba de todo y en
                        tabulares, como si fuera lo que se busca; se busca por el nombre.
                      */}
                      <p className="font-medium leading-snug">{s.eventTitle}</p>
                      <p className="text-sm text-[var(--fo-muted)]">
                        {s.client.businessName ??
                          `${s.client.firstName ?? ""} ${s.client.lastName ?? ""}`.trim()}
                      </p>
                    </div>
                    <EstadoSolicitudChip status={s.status} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--fo-text-secondary)]">
                    {fechaArgentina(s.startsAt)}
                    {s.city ? ` · ${s.city}` : ""}
                    <span className="text-[var(--fo-muted-soft)]">
                      {" · "}
                      <span className="tabular-nums">{s.publicCode}</span>
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Grupo({
  grupo,
  titulo,
  activo,
  cuentas,
}: {
  grupo: InboxFilterGroup;
  titulo: string;
  activo: string;
  cuentas: Record<InboxFilterKey, number>;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {INBOX_FILTERS.filter((f) => f.grupo === grupo).map((f) => {
          const cuantos = cuentas[f.key];
          const esActiva = f.key === activo;
          return (
            <Link
              key={f.key}
              href={`/coberturas?filtro=${f.key}`}
              aria-current={esActiva ? "page" : undefined}
              // El número va en el nombre accesible y no sólo a la vista: para quien navega
              // con lector de pantalla, «Nuevas» y «Nuevas, 3 pedidos» no son lo mismo.
              aria-label={`${f.label}, ${cuantos} ${cuantos === 1 ? "pedido" : "pedidos"}`}
              className={`fo-btn text-sm min-h-10 ${
                esActiva ? "fo-btn-primary" : "fo-btn-secondary"
              } ${cuantos === 0 && !esActiva ? "opacity-60" : ""}`}
            >
              <span aria-hidden="true">{f.label}</span>
              {/*
                El número se muestra siempre, incluso en cero. Esconderlo obligaría a abrir la
                pestaña para saber que está vacía, que es justo lo que esto vino a evitar; una
                pestaña en cero se apaga un poco, pero sigue diciendo cuántos hay.
              */}
              <span
                aria-hidden="true"
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  esActiva
                    ? "bg-white/25"
                    : "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]"
                }`}
              >
                {cuantos}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
