import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireCoveragesReviewer } from "@/lib/coverages/access";
import { canCoordinateCoverages } from "@/lib/coverages/access-policy";
import { lugaresLibres, type EstadoDeRol } from "@/lib/coverages/cupos";
import { listEvents } from "@/lib/coverages/events";
import { datetimeLocalValue } from "@/lib/coverages/generar-cobertura";
import { fechaHoraArgentina } from "@/lib/coverages/format";
import { loadCoverage } from "@/lib/coverages/repository";
import {
  ASSIGNMENT_LIVE_STATUSES,
  callStatusLabel,
  coverageEventLabel,
  coverageStatusLabel,
} from "@/lib/coverages/states";
import { ConvocatoriaPanel } from "./convocatoria-panel";

export const dynamic = "force-dynamic";

/**
 * La ficha de una cobertura: sus datos, sus roles con sus cupos, y su convocatoria.
 *
 * `loadCoverage` ya filtra por `workspaceId` en su `where` (ver `lib/coverages/repository.ts` y
 * `aislamiento.test.ts`): una cobertura de otro workspace vuelve `null` acá y cae en
 * `notFound()`. El id llega por la URL — es justo el caso que ese cuidado del plan pide
 * verificar— y no hay una segunda consulta que pudiera saltearse el filtro.
 *
 * Postulaciones y equipo quedan con un bloque de "todavía no" a propósito: es la tanda
 * siguiente (ver el plan). Lo que sí vive acá — roles con sus cupos y la convocatoria — es lo
 * que esa tanda va a necesitar leer, así que la consulta ya lo trae.
 */
export default async function FichaCoberturaPage({
  params,
}: {
  params: Promise<{ coverageId: string }>;
}) {
  const { workspace, role } = await requireCoveragesReviewer();
  const { coverageId } = await params;

  const cobertura = await loadCoverage({ workspaceId: workspace.id, coverageId });
  if (!cobertura) notFound();

  const [historialCobertura, historialConvocatoria] = await Promise.all([
    listEvents({ workspaceId: workspace.id, entityType: "COVERAGE", entityId: cobertura.id }),
    cobertura.call
      ? listEvents({ workspaceId: workspace.id, entityType: "CALL", entityId: cobertura.call.id })
      : Promise.resolve([]),
  ]);

  const puedeCoordinar = canCoordinateCoverages(role);

  const estadosDeRol: EstadoDeRol[] = cobertura.roles.map((r) => ({
    vacancies: r.vacancies,
    asignadasVivas: r.assignments.filter((a) =>
      (ASSIGNMENT_LIVE_STATUSES as readonly string[]).includes(a.status),
    ).length,
    asignadasAceptadas: r.assignments.filter(
      (a) => a.status === "ACEPTADA" || a.status === "CONFIRMADA",
    ).length,
  }));

  const call = cobertura.call
    ? {
        id: cobertura.call.id,
        title: cobertura.call.title,
        publicSummary: cobertura.call.publicSummary,
        privateBriefing: cobertura.call.privateBriefing,
        visibility: cobertura.call.visibility,
        visibilityValues: cobertura.call.visibilityValues,
        applicationsCloseAtInput: cobertura.call.applicationsCloseAt
          ? datetimeLocalValue(cobertura.call.applicationsCloseAt)
          : "",
        applicationsCloseAtDisplay: cobertura.call.applicationsCloseAt
          ? fechaHoraArgentina(cobertura.call.applicationsCloseAt)
          : null,
        urgency: cobertura.call.urgency,
        status: cobertura.call.status,
        statusLabel: callStatusLabel(cobertura.call.status),
        publishedAtDisplay: cobertura.call.publishedAt
          ? fechaHoraArgentina(cobertura.call.publishedAt)
          : null,
      }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={cobertura.title}
        description={`${cobertura.request.publicCode} · ${coverageStatusLabel(cobertura.status)}`}
        actions={
          <Link
            href={`/coberturas/${cobertura.request.id}`}
            className="fo-btn fo-btn-secondary text-sm"
          >
            Ver la solicitud
          </Link>
        }
      />

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">La cobertura</h2>
        <Dato
          label="Cuándo"
          valor={`${fechaHoraArgentina(cobertura.startsAt)} a ${fechaHoraArgentina(cobertura.endsAt)}`}
        />
        <Dato
          label="Dónde"
          valor={[cobertura.addressLine, cobertura.city].filter(Boolean).join(", ") || "—"}
        />
        <Dato label="Instrucciones" valor={cobertura.instructions ?? "—"} />
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Roles</h2>
        {cobertura.roles.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Esta cobertura no tiene roles cargados.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {cobertura.roles.map((r, i) => (
              <li key={r.id}>
                <span className="font-medium">{r.name}</span>{" "}
                <span className="text-[var(--fo-muted)]">
                  — {estadosDeRol[i].asignadasVivas} de {r.vacancies}
                  {" "}
                  ({lugaresLibres(estadosDeRol[i])} {lugaresLibres(estadosDeRol[i]) === 1 ? "lugar libre" : "lugares libres"})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConvocatoriaPanel
        coverageId={cobertura.id}
        coverageStatus={cobertura.status}
        roles={estadosDeRol}
        call={call}
        puedeCoordinar={puedeCoordinar}
      />

      <section className="fo-card space-y-2 p-5">
        <h2 className="text-base font-semibold">Postulaciones y equipo</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Todavía no hay pantalla para esto: llega en la próxima etapa, cuando se elija el
          equipo.
        </p>
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Historial de la cobertura</h2>
        <Historial eventos={historialCobertura} statusLabel={coverageStatusLabel} />
      </section>

      {cobertura.call ? (
        <section className="fo-card space-y-3 p-5">
          <h2 className="text-base font-semibold">Historial de la convocatoria</h2>
          <Historial eventos={historialConvocatoria} statusLabel={callStatusLabel} />
        </section>
      ) : null}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <p className="text-sm">
      <span className="text-[var(--fo-muted)]">{label}: </span>
      {valor}
    </p>
  );
}

function Historial({
  eventos,
  statusLabel,
}: {
  eventos: {
    id: string;
    createdAt: Date;
    actorLabel: string | null;
    type: string;
    toStatus: string | null;
    note: string | null;
  }[];
  /** `coverageStatusLabel` o `callStatusLabel` según de qué entidad es el historial: los dos
   * conjuntos de estados comparten nombres (`CERRADA`, `PUBLICADA`) pero no todos — `VENCIDA`,
   * por ejemplo, no es un estado de cobertura. */
  statusLabel: (status: string) => string;
}) {
  if (eventos.length === 0) {
    return <p className="text-sm text-[var(--fo-muted)]">Todavía no pasó nada.</p>;
  }
  return (
    <ul className="space-y-3 text-sm">
      {eventos.map((e) => (
        <li key={e.id} className="space-y-0.5">
          <p className="text-xs text-[var(--fo-muted)]">
            {fechaHoraArgentina(e.createdAt)} · {e.actorLabel ?? "El sistema"}
          </p>
          <p>
            {coverageEventLabel(e.type)}
            {e.toStatus ? ` → ${statusLabel(e.toStatus)}` : ""}
          </p>
          {e.note ? <p className="text-[var(--fo-muted)]">{e.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}
