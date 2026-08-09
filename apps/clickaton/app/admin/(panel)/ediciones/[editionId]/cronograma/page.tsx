import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  activateTimelineAction,
  ensureDraftTimelineAction,
  pauseTimelineAction,
  shiftFutureEventsAction,
  updateTimelineEventAction,
} from "@/lib/timeline/admin-actions";
import {
  emergencyRevealAction,
  extendUploadWindowAction,
  getPreEventReadyChecklist,
  releaseAllPromptsAction,
  rollbackRevealToLockedAction,
  saveEditionScheduleAction,
} from "@/lib/photo-upload/edition-schedule-admin";
import Link from "next/link";
import {
  cleanupTestModeAction,
  enterTestModeAction,
  setTestClockAction,
} from "@/lib/test-mode/admin-actions";
import { getEditionTemporalState } from "@/lib/timeline/prisma-timeline";
import {
  formatTimelineDateTime,
  presentAuditAction,
  presentMilestoneStatus,
  presentTimelineEventType,
  presentTimelineVersionStatus,
  timelineToneToBadgeVariant,
} from "@/lib/timeline/ui/timeline-status-presentation";
import { formatScheduleRange } from "@/lib/photo-upload/edition-schedule";

type Props = { params: Promise<{ editionId: string }> };

function toLocalInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditionTimelineAdminPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: {
      id: true,
      name: true,
      timezone: true,
      slug: true,
      uploadConfig: true,
    },
  });
  if (!edition) notFound();

  const timezone = edition.timezone ?? "America/Argentina/Buenos_Aires";
  const cfg = edition.uploadConfig;
  const ready = await getPreEventReadyChecklist(editionId);

  const timelines = await prisma.clickatonEditionTimeline.findMany({
    where: { editionId },
    include: {
      events: { orderBy: { sequence: "asc" } },
      audits: { orderBy: { createdAt: "desc" }, take: 20 },
    },
    orderBy: { version: "desc" },
  });

  const draft = timelines.find((t) => t.status === "DRAFT") ?? null;
  const active = timelines.find((t) => t.status === "ACTIVE") ?? null;
  const temporal = await getEditionTemporalState(editionId);
  const publishedStatus = presentTimelineVersionStatus(temporal.timelineStatus, {
    paused: temporal.paused,
  });
  const nextMilestone = temporal.nextEvent
    ? presentMilestoneStatus(temporal.nextEvent.status)
    : null;
  const nextType = temporal.nextEvent
    ? presentTimelineEventType(temporal.nextEvent.eventType)
    : null;

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Cronograma de la edición"
        description="Organizá las actividades de Clickatón y definí cuándo estarán disponibles para los participantes."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Cronograma" },
        ]}
        actions={
          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Badge variant={timelineToneToBadgeVariant(publishedStatus.tone)}>
              {publishedStatus.label}
            </Badge>
            <form action={ensureDraftTimelineAction.bind(null, editionId)}>
              <Button type="submit" variant="secondary" className="min-h-11 w-full sm:w-auto">
                Crear borrador de cronograma
              </Button>
            </form>
            <Button
              href={`${adminRoutes.editions}/${editionId}/consignas`}
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
            >
              Ir a consignas
            </Button>
          </div>
        }
      />

      <Card variant="outlined" className="min-w-0 space-y-6 border-ck-yellow/40 p-5 md:p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Cronograma de consignas (SoT)</h2>
          <p className="text-sm text-ck-text-secondary leading-relaxed">
            Todas las consignas se revelan juntas. La ventana de captura (cuándo debió tomarse la
            foto) es independiente de la ventana de carga (cuándo se acepta el archivo).
          </p>
          <Badge variant={ready.ready ? "success" : "warning"}>
            {ready.ready ? "READY" : "NOT READY"}
          </Badge>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {ready.items.map((i) => (
              <li key={i.key} className={i.ok ? "text-ck-text" : "text-ck-text-muted"}>
                {i.ok ? "✓" : "○"} {i.label}
              </li>
            ))}
          </ul>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ck-text-muted">Revelado de consignas</dt>
            <dd>
              {cfg?.eventRevealAt
                ? formatTimelineDateTime(cfg.eventRevealAt, timezone)
                : "Sin configurar"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ck-text-muted">Fotografías válidas si fueron tomadas entre</dt>
            <dd>
              {formatScheduleRange(
                cfg?.captureWindowStartsAt ?? null,
                cfg?.captureWindowEndsAt ?? null,
                timezone,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ck-text-muted">Carga permitida</dt>
            <dd>
              {formatScheduleRange(
                cfg?.uploadWindowStartsAt ?? null,
                cfg?.uploadWindowEndsAt ?? null,
                timezone,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ck-text-muted">Reemplazos · Timezone</dt>
            <dd>
              {cfg?.allowReplacement === false ? "No" : "Sí"} · {timezone}
            </dd>
          </div>
        </dl>

        <form action={saveEditionScheduleAction.bind(null, editionId)} className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2 text-sm">
            <span className="font-semibold">Revelado de consignas</span>
            <input
              type="datetime-local"
              name="eventRevealAt"
              defaultValue={toLocalInputValue(cfg?.eventRevealAt)}
              className="min-h-11 w-full rounded-lg border border-ck-border bg-ck-bg px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-semibold">Inicio captura (sacar fotos)</span>
            <input
              type="datetime-local"
              name="captureWindowStartsAt"
              defaultValue={toLocalInputValue(cfg?.captureWindowStartsAt)}
              className="min-h-11 w-full rounded-lg border border-ck-border bg-ck-bg px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-semibold">Fin captura</span>
            <input
              type="datetime-local"
              name="captureWindowEndsAt"
              defaultValue={toLocalInputValue(cfg?.captureWindowEndsAt)}
              className="min-h-11 w-full rounded-lg border border-ck-border bg-ck-bg px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-semibold">Inicio carga (subir fotos)</span>
            <input
              type="datetime-local"
              name="uploadWindowStartsAt"
              defaultValue={toLocalInputValue(cfg?.uploadWindowStartsAt)}
              className="min-h-11 w-full rounded-lg border border-ck-border bg-ck-bg px-3"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-semibold">Fin carga</span>
            <input
              type="datetime-local"
              name="uploadWindowEndsAt"
              defaultValue={toLocalInputValue(cfg?.uploadWindowEndsAt)}
              className="min-h-11 w-full rounded-lg border border-ck-border bg-ck-bg px-3"
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="allowReplacement" value="1" defaultChecked={cfg?.allowReplacement !== false} />
            Permitir reemplazos dentro de la ventana de carga
          </label>
          <input type="hidden" name="globalPromptReveal" value="1" />
          <div className="md:col-span-2">
            <Button type="submit" variant="primary" className="min-h-11">
              Guardar ventanas
            </Button>
          </div>
        </form>

        <div className="space-y-4 border-t border-ck-border pt-4">
          <p className="text-sm text-ck-text-secondary">
            Uploads comerciales:{" "}
            <strong>{cfg?.uploadsEnabled ? "ON" : "OFF"}</strong>
            {" · "}
            Canonical:{" "}
            <strong>{cfg?.canonicalAssetsEnabled ? "ON" : "OFF"}</strong>
            {" · "}
            <Link
              href={`${adminRoutes.editions}/${editionId}/ops-dia`}
              className="text-ck-yellow underline-offset-2 hover:underline"
            >
              Panel ops día
            </Link>
          </p>

          <form
            action={extendUploadWindowAction.bind(null, editionId)}
            className="grid gap-3 rounded-lg border border-ck-border/80 p-4 sm:grid-cols-[8rem_1fr_auto]"
          >
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase text-ck-text-muted">
                + minutos carga
              </span>
              <input
                type="number"
                name="minutes"
                min={5}
                max={1440}
                defaultValue={30}
                required
                className="min-h-11 w-full rounded-lg border border-ck-border bg-ck-bg px-3"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase text-ck-text-muted">
                Motivo (auditoría)
              </span>
              <input
                type="text"
                name="reason"
                required
                minLength={5}
                placeholder="Ej. contingencia conectividad sede"
                className="min-h-11 w-full rounded-lg border border-ck-border bg-ck-bg px-3"
              />
            </label>
            <div className="flex items-end">
              <ConfirmSubmitButton
                confirmMessage="¿Extender la ventana de CARGA? Queda auditado."
                className="min-h-11"
              >
                Extender ventana de carga
              </ConfirmSubmitButton>
            </div>
          </form>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <form
              action={emergencyRevealAction.bind(null, editionId)}
              className="flex flex-wrap items-end gap-2"
            >
              <label className="block space-y-1 text-sm">
                <span className="text-xs text-ck-text-muted">
                  Motivo reveal emergencia
                </span>
                <input
                  type="text"
                  name="reason"
                  required
                  minLength={5}
                  className="min-h-11 min-w-[16rem] rounded-lg border border-ck-border bg-ck-bg px-3"
                />
              </label>
              <ConfirmSubmitButton
                confirmMessage="¿Reveal de emergencia AHORA? No activa uploads."
                className="min-h-11"
              >
                Reveal emergencia
              </ConfirmSubmitButton>
            </form>
            <form
              action={rollbackRevealToLockedAction.bind(null, editionId)}
              className="flex flex-wrap items-end gap-2"
            >
              <label className="block space-y-1 text-sm">
                <span className="text-xs text-ck-text-muted">
                  Motivo rollback reveal
                </span>
                <input
                  type="text"
                  name="reason"
                  required
                  minLength={5}
                  className="min-h-11 min-w-[16rem] rounded-lg border border-ck-border bg-ck-bg px-3"
                />
              </label>
              <ConfirmSubmitButton
                confirmMessage="¿Volver consignas a LOCKED? No borra envíos."
                className="min-h-11"
              >
                Rollback reveal → LOCKED
              </ConfirmSubmitButton>
            </form>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <form action={releaseAllPromptsAction.bind(null, editionId)}>
              <ConfirmSubmitButton
                confirmMessage="¿Liberar TODAS las consignas ahora? No activa uploads."
                className="min-h-11"
              >
                Liberar todas las consignas
              </ConfirmSubmitButton>
            </form>
            <form action={enterTestModeAction.bind(null, editionId)}>
              <Button type="submit" variant="secondary" className="min-h-11">
                Probar como participante
              </Button>
            </form>
            <form
              action={setTestClockAction.bind(null, editionId)}
              className="flex flex-wrap items-end gap-2"
            >
              <label className="block space-y-1 text-sm">
                <span className="text-xs text-ck-text-muted">
                  Simular hora (Modo Test)
                </span>
                <input
                  type="datetime-local"
                  name="virtualClock"
                  className="min-h-11 rounded-lg border border-ck-border bg-ck-bg px-3"
                />
              </label>
              <Button type="submit" variant="outline" className="min-h-11">
                Aplicar reloj virtual
              </Button>
            </form>
            <form action={cleanupTestModeAction.bind(null, editionId)}>
              <ConfirmSubmitButton
                confirmMessage="¿Eliminar SOLO datos de Modo Test de esta edición?"
                className="min-h-11"
              >
                Limpiar datos de prueba
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>
      </Card>

      {/* Próximo evento */}
      <Card variant="outlined" className="min-w-0 space-y-3 border-ck-yellow/40 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Próxima actividad</h2>
        {temporal.nextEvent && nextType && nextMilestone ? (
          <>
            <p className="text-base font-medium text-ck-text">
              {temporal.nextEvent.name || nextType.label}
            </p>
            <p className="text-sm text-ck-text-secondary">{nextType.description}</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ck-text-muted">Fecha y hora</dt>
                <dd className="text-sm">
                  {temporal.nextEvent.startsAt
                    ? formatTimelineDateTime(temporal.nextEvent.startsAt, timezone)
                    : "Horario a confirmar"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ck-text-muted">Estado</dt>
                <dd>
                  <Badge variant={timelineToneToBadgeVariant(nextMilestone.tone)}>
                    {nextMilestone.label}
                  </Badge>
                </dd>
              </div>
            </dl>
            <p className="text-sm text-ck-text-secondary">
              {nextMilestone.description} Horario de Argentina
              {timezone.includes("Argentina") ? "" : ` (${timezone})`}.
            </p>
            {/* LEGAL_REVIEW: plazos del evento */}
            <p className="text-xs text-ck-text-muted">
              Los plazos visibles para participantes dependen del cronograma publicado.{" "}
              <span className="font-mono">LEGAL_REVIEW</span>
            </p>
          </>
        ) : (
          <p className="text-sm text-ck-text-muted">
            Todavía no hay una próxima actividad programada. Publicá el cronograma o completá
            los horarios del borrador.
          </p>
        )}
      </Card>

      {/* Estado general */}
      <Card variant="outlined" className="min-w-0 space-y-3 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Estado del cronograma</h2>
        <p className="text-sm text-ck-text-secondary">{publishedStatus.description}</p>
        {publishedStatus.nextAction ? (
          <p className="text-sm font-medium text-ck-text">
            Próximo paso: {publishedStatus.nextAction}
          </p>
        ) : null}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ck-text-muted">Versión publicada</dt>
            <dd>
              {temporal.timelineVersion != null
                ? `Versión ${temporal.timelineVersion}`
                : "Ninguna"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Zona horaria de la edición</dt>
            <dd>Horario de Argentina</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Acciones automáticas</dt>
            <dd>
              {temporal.paused
                ? "En pausa por contingencia"
                : "Pueden ejecutarse según el cronograma publicado"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-ck-text-muted">
          Riesgo conocido: el selector de fecha del borrador usa la zona horaria del servidor
          al editar; la vista publicada se muestra en la zona de la edición. Verificá siempre
          el horario resultante.
        </p>
      </Card>

      {/* Ventanas operativas (copy humano; no cambia lógica) */}
      <Card variant="outlined" className="min-w-0 space-y-3 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Ventanas del día del evento</h2>
        <p className="text-sm text-ck-text-secondary">
          Referencia operativa Argentina 2026. La captura y el envío son ventanas distintas:
          no las mezcles al comunicar plazos.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title: "Acreditación",
              body: "Desde las 14:00 hasta las 16:00",
            },
            {
              title: "Introducción",
              body: "Desde las 16:00 hasta las 16:30",
            },
            {
              title: "Captura de fotografías",
              body: "Desde las 16:00 hasta las 20:00 (según fecha de la foto)",
            },
            {
              title: "Envío de fotografías",
              body: "Desde las 16:00 hasta las 22:00 (según reloj del sistema)",
            },
          ].map((w) => (
            <li
              key={w.title}
              className="rounded-[var(--ck-radius-card)] border border-ck-border px-4 py-3"
            >
              <p className="font-medium text-ck-text">{w.title}</p>
              <p className="mt-1 text-sm text-ck-text-secondary">{w.body}</p>
            </li>
          ))}
        </ul>
        {/* LEGAL_REVIEW */}
        <p className="text-xs text-ck-text-muted">
          Estos horarios son referencia operativa; no reemplazan las bases y condiciones.{" "}
          <span className="font-mono">LEGAL_REVIEW</span>
        </p>
      </Card>

      {/* Borrador editable */}
      {draft ? (
        <Card variant="outlined" className="min-w-0 space-y-6 p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                Borrador · versión {draft.version}
              </h2>
              <p className="text-sm text-ck-text-secondary">
                Editá nombres y horarios. Guardar un evento no lo publica. Publicar el
                borrador lo convierte en el cronograma en uso.
              </p>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <form action={activateTimelineAction.bind(null, editionId, draft.id)}>
                <ConfirmSubmitButton
                  variant="primary"
                  className="min-h-11 w-full sm:w-auto"
                  confirmMessage={[
                    "¿Publicar este cronograma ahora?",
                    "",
                    "Esta versión pasará a ser el cronograma en uso.",
                    "Los participantes verán las actividades según estas fechas.",
                    "La versión publicada no se edita en el lugar.",
                  ].join("\n")}
                >
                  Publicar cronograma
                </ConfirmSubmitButton>
              </form>
              <form
                action={pauseTimelineAction.bind(null, editionId, draft.id)}
                className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end"
              >
                <label className="block min-w-0 flex-1 text-sm">
                  Motivo de la pausa
                  <input
                    name="reason"
                    placeholder="Ej.: demora en sede"
                    className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
                    aria-label="Motivo de pausa"
                  />
                </label>
                <ConfirmSubmitButton
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  confirmMessage={[
                    "¿Pausar el cronograma?",
                    "",
                    "Las acciones automáticas pueden quedar detenidas hasta reanudar.",
                  ].join("\n")}
                >
                  Pausar por contingencia
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>
          <p className="text-sm text-ck-text-secondary">
            Si dejás vacío el inicio, se mostrará como “Horario a confirmar”.
          </p>
          <ul className="space-y-4">
            {draft.events.map((ev) => {
              const type = presentTimelineEventType(ev.eventType);
              return (
                <li
                  key={ev.id}
                  className="min-w-0 rounded-[var(--ck-radius-card)] border border-ck-border p-4"
                >
                  <form
                    action={updateTimelineEventAction.bind(null, editionId)}
                    className="grid gap-4 md:grid-cols-2"
                  >
                    <input type="hidden" name="eventId" value={ev.id} />
                    <div className="md:col-span-2 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-ck-text-muted">
                        {type.label}
                      </p>
                      <label className="block text-sm">
                        Nombre de la actividad
                        <input
                          name="name"
                          defaultValue={ev.name}
                          className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
                        />
                      </label>
                      <p className="text-xs text-ck-text-muted">{type.description}</p>
                    </div>
                    <label className="block text-sm">
                      Fecha y hora de apertura
                      <span className="mt-1 block text-xs text-ck-text-muted">
                        Desde este momento aplica la actividad, según el cronograma publicado.
                      </span>
                      <input
                        name="startsAt"
                        type="datetime-local"
                        defaultValue={
                          ev.startsAt
                            ? new Date(
                                ev.startsAt.getTime() -
                                  ev.startsAt.getTimezoneOffset() * 60000,
                              )
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                        className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      Fecha y hora de cierre (opcional)
                      <span className="mt-1 block text-xs text-ck-text-muted">
                        Después de este momento, la actividad deja de estar abierta.
                      </span>
                      <input
                        name="endsAt"
                        type="datetime-local"
                        defaultValue={
                          ev.endsAt
                            ? new Date(
                                ev.endsAt.getTime() - ev.endsAt.getTimezoneOffset() * 60000,
                              )
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                        className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
                      />
                    </label>
                    <div className="md:col-span-2">
                      <Button
                        type="submit"
                        variant="secondary"
                        className="min-h-11 w-full sm:w-auto"
                      >
                        Guardar cambios
                      </Button>
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <Card variant="outlined" className="p-5">
          <p className="font-medium text-ck-text">Todavía no hay un borrador</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            Creá un borrador de cronograma para empezar a organizar las actividades.
          </p>
          <form action={ensureDraftTimelineAction.bind(null, editionId)} className="mt-4">
            <Button type="submit" variant="primary" className="min-h-11 w-full sm:w-auto">
              Crear borrador de cronograma
            </Button>
          </form>
        </Card>
      )}

      {/* Publicado */}
      {active ? (
        <Card variant="outlined" className="min-w-0 space-y-4 p-5 md:p-6">
          <h2 className="text-lg font-semibold">
            Cronograma publicado · versión {active.version}
          </h2>
          <p className="text-sm text-ck-text-secondary">
            Esta versión está en uso y no se edita aquí. Para mover actividades futuras, usá
            la reprogramación (crea un nuevo borrador).
          </p>

          {/* Desktop-ish list */}
          <ul className="hidden space-y-2 md:block">
            {active.events.map((ev) => {
              const type = presentTimelineEventType(ev.eventType);
              return (
                <li
                  key={ev.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-ck-border py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {ev.sequence}. {ev.name}
                    </p>
                    <p className="text-ck-text-muted">{type.label}</p>
                  </div>
                  <div className="text-right text-ck-text-secondary">
                    <p>
                      {ev.startsAt
                        ? formatTimelineDateTime(ev.startsAt, active.timezone)
                        : "Horario a confirmar"}
                    </p>
                    {ev.endsAt ? (
                      <p className="text-xs">
                        Hasta {formatTimelineDateTime(ev.endsAt, active.timezone)}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Mobile cards */}
          <ul className="grid gap-3 md:hidden">
            {active.events.map((ev) => {
              const type = presentTimelineEventType(ev.eventType);
              return (
                <li
                  key={ev.id}
                  className="min-w-0 space-y-2 rounded-[var(--ck-radius-card)] border border-ck-border p-4"
                >
                  <p className="font-semibold text-ck-text">
                    {ev.sequence}. {ev.name}
                  </p>
                  <p className="text-sm text-ck-text-secondary">{type.label}</p>
                  <p className="text-sm">
                    {ev.startsAt
                      ? formatTimelineDateTime(ev.startsAt, active.timezone)
                      : "Horario a confirmar"}
                  </p>
                </li>
              );
            })}
          </ul>

          <form
            action={shiftFutureEventsAction.bind(null, editionId)}
            className="flex w-full min-w-0 flex-col gap-3 border-t border-ck-border pt-4 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <label className="text-sm">
              Minutos a desplazar
              <input
                name="minutes"
                type="number"
                defaultValue={20}
                className="mt-2 block min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2 sm:w-28"
              />
            </label>
            <label className="min-w-0 flex-1 text-sm">
              Motivo
              <input
                name="reason"
                required
                placeholder="Ej.: demora por clima"
                className="mt-2 block min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
              />
            </label>
            <ConfirmSubmitButton
              variant="primary"
              className="min-h-11 w-full sm:w-auto"
              confirmMessage={[
                "¿Reprogramar las actividades futuras?",
                "",
                "Se creará un nuevo borrador con los horarios desplazados.",
                "No se modifica el cronograma publicado en el lugar.",
                "Las consignas ya liberadas y los eventos ya ejecutados no se mueven.",
              ].join("\n")}
            >
              Pasar hitos futuros a un nuevo borrador
            </ConfirmSubmitButton>
          </form>
          <p className="text-xs text-ck-text-muted">
            Esta acción no cambia el cronograma publicado directamente: genera un borrador
            nuevo para revisar y publicar.
          </p>
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-3 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Historial reciente</h2>
        <ul className="space-y-2 text-sm">
          {(draft?.audits ?? active?.audits ?? []).map((a) => (
            <li key={a.id} className="border-b border-ck-border/60 py-2">
              <span className="text-ck-text-muted">
                {formatTimelineDateTime(a.createdAt, timezone)}
              </span>
              {" · "}
              {presentAuditAction(a.action)}
            </li>
          ))}
          {(draft?.audits ?? active?.audits ?? []).length === 0 ? (
            <li className="text-ck-text-muted">Sin cambios registrados todavía.</li>
          ) : null}
        </ul>
      </Card>

      <AdminTechnicalInfo
        description="Referencias para soporte. Incluye reloj del servidor y claves internas. Sin secretos."
        rows={[
          {
            label: "Zona horaria interna de la edición",
            value: timezone,
            mono: true,
          },
          {
            label: "Reloj del servidor (ISO)",
            value: temporal.serverNow,
            mono: true,
          },
          {
            label: "Estado interno del cronograma",
            value: temporal.timelineStatus ?? "NONE",
            mono: true,
          },
          {
            label: "Versión interna",
            value: temporal.timelineVersion != null ? String(temporal.timelineVersion) : "—",
            mono: true,
          },
          {
            label: "ID de borrador",
            value: draft?.id ?? "Sin borrador",
            mono: true,
            copyText: draft?.id,
          },
          {
            label: "ID de versión publicada",
            value: active?.id ?? "Sin versión publicada",
            mono: true,
            copyText: active?.id,
          },
          {
            label: "Tipos de evento (orden)",
            value: (active ?? draft)?.events.map((e) => e.eventType).join(" · ") ?? "—",
            mono: true,
          },
          {
            label: "Slug de edición",
            value: edition.slug,
            mono: true,
          },
        ]}
      />
    </div>
  );
}
