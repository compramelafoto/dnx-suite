import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspace } from "@/lib/workspace";
import { loadCardBoard, type CardBoardEvent } from "@/lib/carnet/board";
import {
  canDownloadPdf,
  commonTransitions,
  groupStates,
  STATE_GROUPS,
  tiempoRelativo,
} from "@/lib/carnet/board-actions";
import { stateLabel, type FulfillmentState } from "@/lib/carnet/fulfillment";
import { isPdfDownloadEvent } from "@/lib/carnet/print-log";
import { canViewCards, resolveCardCapabilities } from "@/lib/carnet/operators";
import { CardsTable, type CardRowView, type TimelineEntry } from "./cards-table";
import { IssueButton } from "./issue-button";

export const dynamic = "force-dynamic";

/**
 * Tablero de emisión de carnets físicos.
 *
 * Responde en qué punto está cada carnet y quién lo movió. El impresor entra a «Para
 * imprimir», ve la tanda entera y la marca junta; la Secretaría entra a «Para entregar».
 *
 * Todo lo que depende de la hora o de los permisos se resuelve **acá**, en el servidor, y baja
 * ya masticado: la tabla es interactiva pero no tiene por qué recalcular quién puede hacer qué.
 */

function fechaHora(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const hora = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()} ${hora}:${min}`;
}

function armarHistoria(events: CardBoardEvent[]): TimelineEntry[] {
  return events.map((e) => {
    const descarga = isPdfDownloadEvent(e);
    return {
      kind: descarga ? ("DESCARGA" as const) : ("PASO" as const),
      // La descarga del PDF no mueve el carnet de estado: se cuenta como lo que es, el
      // momento en que alguien se llevó el archivo para mandarlo a la imprenta.
      label: descarga ? "PDF descargado" : stateLabel(e.toState),
      actor: e.actorLabel,
      note: descarga ? null : e.note,
      when: fechaHora(e.createdAt),
    };
  });
}

export default async function CarnetsPage({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string }>;
}) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const capabilities = await resolveCardCapabilities(user.id, workspace.id);
  if (!canViewCards(capabilities)) redirect("/members");

  const params = await searchParams;
  const grupo = params.grupo ? groupStates(params.grupo) : null;

  const board = await loadCardBoard(workspace.id, grupo ? { states: grupo } : {});
  const ahora = new Date();

  const rows: CardRowView[] = board.rows.map((c) => ({
    id: c.id,
    cardNumber: c.cardNumber,
    memberId: c.memberId,
    memberNumber: c.memberNumber,
    fullName: c.fullName,
    avatarUrl: c.avatarUrl,
    state: c.state,
    waitingLabel: tiempoRelativo(c.updatedAt ?? c.issuedAt, ahora),
    lastActorLabel: c.lastActorLabel,
    lastNote: c.lastNote,
    noticeError: c.noticeError,
    canPdf: canDownloadPdf(c.state) && capabilities.includes("PRODUCIR"),
    // Solo los pasos que esta persona puede dar: mostrarle al impresor un botón de
    // «entregado» que después le rechazan es una promesa vacía.
    actions: commonTransitions([c.state], capabilities),
    timeline: armarHistoria(c.events),
  }));

  const totalPorGrupo = (states: readonly FulfillmentState[]) =>
    states.reduce((t, e) => t + board.counts[e], 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carnets"
        description="En qué punto está cada carnet impreso y quién lo movió."
      />

      {capabilities.includes("ADMINISTRAR") ? (
        <div className="flex flex-wrap items-start gap-3">
          <Link href="/members/carnets/permisos" className="fo-btn text-xs inline-flex">
            Permisos de carnets
          </Link>
          <IssueButton />
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-1.5">
        <Link
          href="/members/carnets"
          className={`fo-btn text-xs ${!grupo ? "fo-btn-primary" : ""}`}
        >
          Todos
          <span className="ml-1.5 tabular-nums opacity-70">
            {totalPorGrupo(Object.keys(board.counts) as FulfillmentState[])}
          </span>
        </Link>
        {STATE_GROUPS.map((g) => (
          <Link
            key={g.id}
            href={`/members/carnets?grupo=${g.id}`}
            title={g.description}
            className={`fo-btn text-xs ${params.grupo === g.id ? "fo-btn-primary" : ""}`}
          >
            {g.label}
            <span className="ml-1.5 tabular-nums opacity-70">{totalPorGrupo(g.states)}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="fo-card p-5 text-sm text-[var(--fo-muted)]">
          {grupo
            ? "No hay carnets en esta etapa."
            : "Todavía no se pidió ninguna tarjeta impresa."}
        </p>
      ) : (
        <CardsTable rows={rows} capabilities={[...capabilities]} />
      )}
    </div>
  );
}
