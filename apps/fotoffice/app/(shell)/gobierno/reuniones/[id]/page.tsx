import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, FileText } from "lucide-react";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/governance/member-select";
import { ProjectStatusBadge } from "@/components/governance/badges";
import { requireGovernanceViewer } from "@/lib/governance/access";
import { getMeeting, loadVoting } from "@/lib/governance/repository";
import { fechaHora } from "@/lib/governance/labels";
import {
  canApplyOutcome,
  isMinutesLocked,
  ITEM_OUTCOMES,
  meetingStatusLabel,
  outcomeLabel,
} from "@/lib/governance/meetings";
import { tallyLabel, type Tally } from "@/lib/governance/votes";
import { toLocalDateTimeInput } from "@/lib/governance/datetime";
import { listActiveOfficeHolders } from "@/lib/commission/terms";
import type { ProjectStatus } from "@/lib/governance/constants";
import {
  addAgendaItemAction,
  addMeetingNoteAction,
  approveMinutesAction,
  markMeetingHeldAction,
  moveAgendaItemAction,
  removeAgendaItemAction,
  saveAttendeesAction,
  treatAgendaItemAction,
  updateMeetingAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ReunionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, canManage } = await requireGovernanceViewer();
  const { id } = await params;
  const avisos = await searchParams;
  const r = await getMeeting(workspace.id, id);
  if (!r) notFound();

  const bloqueada = isMinutesLocked(r.status);
  const editable = canManage && !bloqueada;
  const proyectoIds = r.items.flatMap((i) => (i.projectId ? [i.projectId] : []));
  const [votacion, holders, otrosProyectos] = await Promise.all([
    loadVoting(workspace.id, proyectoIds),
    editable ? listActiveOfficeHolders(workspace.id).catch(() => []) : Promise.resolve([]),
    editable
      ? prisma.govProject.findMany({
          where: {
            workspaceId: workspace.id,
            id: { notIn: proyectoIds },
            status: { notIn: ["ARCHIVED", "REJECTED", "DONE", "CANCELLED"] },
          },
          orderBy: { title: "asc" },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);
  const presentes = new Set(r.attendees.map((a) => a.memberId ?? `u:${a.userId}`));
  const sinTratar = r.items.filter((i) => !i.treatedAt).length;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/gobierno/reuniones" className="text-sm text-[var(--fo-muted)] hover:underline">
          ← Reuniones
        </Link>
        <PageHeader
          title={r.title}
          description={`${fechaHora(r.scheduledAt)}${r.location ? ` · ${r.location}` : ""}`}
          actions={
            <Link href={`/imprimir/acta/${r.id}`} className="fo-btn fo-btn-secondary text-sm" target="_blank">
              <FileText className="size-4" aria-hidden />
              {bloqueada ? "Ver el acta" : "Ver el borrador del acta"}
            </Link>
          }
        />
        <p className="text-sm font-medium text-[var(--fo-text-secondary)]">{meetingStatusLabel(r.status)}</p>
      </div>

      <Flash error={avisos.error} ok={avisos.ok} />

      {editable ? (
        <section className="fo-card flex flex-wrap items-center gap-3 p-5">
          {r.status === "PLANNED" ? (
            <form action={markMeetingHeldAction}>
              <input type="hidden" name="meetingId" value={r.id} />
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Marcar como realizada
              </button>
            </form>
          ) : null}
          {r.status === "HELD" ? (
            <form action={approveMinutesAction}>
              <input type="hidden" name="meetingId" value={r.id} />
              <button type="submit" className="fo-btn fo-btn-primary text-sm">
                Aprobar el acta
              </button>
            </form>
          ) : null}
          <p className="text-sm text-[var(--fo-muted)]">
            {r.status === "PLANNED"
              ? "Los temas se pueden tratar desde ya; al terminar, marcala como realizada."
              : sinTratar > 0
                ? `Quedan ${sinTratar} tema${sinTratar === 1 ? "" : "s"} sin tratar.`
                : "Todo tratado. Aprobada el acta, ya no se modifica."}
          </p>
        </section>
      ) : null}

      <section id="temario" className="space-y-4">
        <h2 className="text-lg font-semibold">Temario</h2>
        {r.items.length === 0 ? <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">El temario está vacío.</p> : null}
        <ol className="space-y-4">
          {r.items.map((item, i) => {
            const estado = item.project?.status as ProjectStatus | undefined;
            const foto = (item.voteSnapshot ?? null) as Tally | null;
            const actual = item.projectId ? votacion.tallyOf(item.projectId) : null;
            return (
              <li key={item.id} id={`item-${item.id}`} className="fo-card space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--fo-muted)]">Tema {i + 1}</p>
                    {item.project ? (
                      <Link href={`/gobierno/${item.project.id}`} className="font-semibold hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      <p className="font-semibold">{item.title}</p>
                    )}
                    {item.project ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--fo-muted)]">
                        <ProjectStatusBadge status={item.project.status} />
                        <span>{tallyLabel(foto ?? actual!)}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--fo-muted)]">Tema suelto</p>
                    )}
                  </div>
                  {editable ? (
                    <div className="flex items-center gap-1">
                      {(["up", "down"] as const).map((d) => (
                        <form key={d} action={moveAgendaItemAction}>
                          <input type="hidden" name="meetingId" value={r.id} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="direction" value={d} />
                          <button
                            type="submit"
                            className="fo-icon-btn"
                            disabled={d === "up" ? i === 0 : i === r.items.length - 1}
                            aria-label={d === "up" ? "Subir tema" : "Bajar tema"}
                          >
                            {d === "up" ? <ArrowUp className="size-4" aria-hidden /> : <ArrowDown className="size-4" aria-hidden />}
                          </button>
                        </form>
                      ))}
                      {!item.treatedAt ? (
                        <form action={removeAgendaItemAction}>
                          <input type="hidden" name="meetingId" value={r.id} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <button type="submit" className="fo-btn fo-btn-ghost text-xs">
                            Quitar
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {item.treatedAt ? (
                  <div className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-muted)] p-3 text-sm">
                    {item.outcome ? <p className="font-medium">{outcomeLabel(item.outcome)}</p> : null}
                    <p className="whitespace-pre-line">{item.decisionText}</p>
                  </div>
                ) : null}

                {editable ? (
                  <details open={!item.treatedAt}>
                    <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">
                      {item.treatedAt ? "Corregir lo resuelto" : "Tratar el tema"}
                    </summary>
                    <form action={treatAgendaItemAction} className="mt-3 space-y-3">
                      <input type="hidden" name="meetingId" value={r.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                      {item.project && !item.outcome && estado ? (
                        <fieldset className="flex flex-wrap gap-3 text-sm">
                          <legend className="fo-label mb-2">Resultado</legend>
                          {ITEM_OUTCOMES.filter((o) => canApplyOutcome(o, estado)).map((o) => (
                            <label key={o} className="flex items-center gap-2">
                              <input type="radio" name="outcome" value={o} required />
                              {outcomeLabel(o)}
                            </label>
                          ))}
                        </fieldset>
                      ) : null}
                      <textarea
                        name="decisionText"
                        className="fo-input"
                        rows={3}
                        required
                        defaultValue={item.decisionText ?? ""}
                        placeholder="Qué se resolvió. Esto es lo que va al acta."
                        aria-label="Qué se resolvió"
                      />
                      <button type="submit" className="fo-btn fo-btn-primary text-sm">
                        Guardar
                      </button>
                    </form>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>

        {editable ? (
          <form action={addAgendaItemAction} className="fo-card flex flex-wrap items-end gap-3 p-5">
            <input type="hidden" name="meetingId" value={r.id} />
            <div className="fo-field-stack min-w-[14rem] flex-1">
              <label className="fo-label" htmlFor="new-topic">
                Agregar un tema suelto
              </label>
              <input id="new-topic" name="title" className="fo-input" maxLength={300} placeholder="Ej.: Renovación del alquiler de la sede" />
            </div>
            {otrosProyectos.length > 0 ? (
              <div className="fo-field-stack min-w-[14rem] flex-1">
                <label className="fo-label" htmlFor="new-project">
                  …o un proyecto
                </label>
                <select id="new-project" name="projectId" className="fo-input" defaultValue="">
                  <option value="">—</option>
                  {otrosProyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              Agregar al temario
            </button>
          </form>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Asistentes</h2>
        {editable ? (
          <form action={saveAttendeesAction} className="fo-card space-y-4 p-5">
            <input type="hidden" name="meetingId" value={r.id} />
            <div className="grid gap-2 sm:grid-cols-2">
              {holders.map((h) => (
                <label key={h.termId} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="termId"
                    value={h.termId}
                    defaultChecked={presentes.has(h.memberId ?? `u:${h.userId}`)}
                  />
                  {h.displayName} <span className="text-[var(--fo-muted)]">— {h.officeName}</span>
                </label>
              ))}
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="guest">
                Invitados (opcional)
              </label>
              <input
                id="guest"
                name="guest"
                className="fo-input"
                placeholder="Nombres separados por coma"
                defaultValue={r.attendees.filter((a) => a.officeName === "Invitado/a").map((a) => a.name).join(", ")}
              />
            </div>
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              Guardar asistentes
            </button>
          </form>
        ) : r.attendees.length === 0 ? (
          <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">Sin asistentes cargados.</p>
        ) : (
          <ul className="fo-card divide-y divide-[var(--fo-border-muted)] text-sm">
            {r.attendees.map((a) => (
              <li key={a.id} className="px-5 py-2">
                {a.name}
                {a.officeName ? <span className="text-[var(--fo-muted)]"> — {a.officeName}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {bloqueada ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Notas agregadas al acta</h2>
          {r.notes.map((n) => (
            <div key={n.id} className="fo-card space-y-1 p-4 text-sm">
              <p className="whitespace-pre-line">{n.body}</p>
              <p className="text-xs text-[var(--fo-muted)]">
                {n.authorLabel} · {fechaHora(n.createdAt)}
              </p>
            </div>
          ))}
          {canManage ? (
            <form action={addMeetingNoteAction} className="fo-card space-y-3 p-5">
              <input type="hidden" name="meetingId" value={r.id} />
              <textarea name="body" className="fo-input" rows={2} required aria-label="Nota" placeholder="Una corrección o aclaración: no reescribe el acta, se suma." />
              <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                Agregar nota
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {editable ? (
        <details className="fo-card p-6">
          <summary className="cursor-pointer text-sm font-medium">Editar fecha, lugar o título</summary>
          <form action={updateMeetingAction} className="mt-6 grid max-w-2xl gap-5 sm:grid-cols-2">
            <input type="hidden" name="meetingId" value={r.id} />
            <div className="fo-field-stack sm:col-span-2">
              <label className="fo-label" htmlFor="e-title">
                Título
              </label>
              <input id="e-title" name="title" className="fo-input" defaultValue={r.title} maxLength={160} />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="e-date">
                Fecha y hora
              </label>
              <input id="e-date" name="scheduledAt" type="datetime-local" className="fo-input" required defaultValue={toLocalDateTimeInput(r.scheduledAt)} />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="e-loc">
                Lugar o enlace
              </label>
              <input id="e-loc" name="location" className="fo-input" defaultValue={r.location ?? ""} maxLength={500} />
            </div>
            <div>
              <button type="submit" className="fo-btn fo-btn-primary text-sm">
                Guardar
              </button>
            </div>
          </form>
        </details>
      ) : null}
    </div>
  );
}
