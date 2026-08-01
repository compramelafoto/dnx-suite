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
  releasePromptAction,
  upsertPromptAction,
} from "@/lib/timeline/admin-actions";
import { fixedClock } from "@/lib/timeline/clock";
import { toPromptPublicDto, assertLockedDtoIsSafe } from "@/lib/timeline/prompt-dto";
import type { PromptRecord } from "@/lib/timeline/types";
import {
  formatTimelineDateTime,
  presentAdminPromptStatus,
  presentParticipantPromptVisibility,
  presentReleaseMode,
  summarizeTimelineAdmin,
  timelineToneToBadgeVariant,
} from "@/lib/timeline/ui/timeline-status-presentation";

type Props = { params: Promise<{ editionId: string }> };

export default async function EditionPromptsAdminPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true, slug: true, timezone: true },
  });
  if (!edition) notFound();

  const timezone = edition.timezone ?? "America/Argentina/Buenos_Aires";

  const prompts = await prisma.clickatonPrompt.findMany({
    where: { editionId },
    orderBy: { sequence: "asc" },
  });

  const summary = summarizeTimelineAdmin({
    promptStatuses: prompts.map((p) => p.status),
    timelineStatus: null,
    hasDraft: false,
    paused: false,
  });

  /** Simulación de vista previa “antes de apertura” (no ejecuta publicación). */
  const simulatedBefore = fixedClock(new Date("2026-09-19T09:00:00-03:00"));

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Consignas de la edición"
        description="Creá las consignas que deberán completar los participantes y definí cuándo estarán disponibles."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Consignas" },
        ]}
        actions={
          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              href="#nueva-consigna"
              variant="primary"
              className="min-h-11 w-full sm:w-auto"
            >
              Crear consigna
            </Button>
            <Button
              href={`${adminRoutes.editions}/${editionId}/cronograma`}
              variant="secondary"
              className="min-h-11 w-full sm:w-auto"
            >
              Ir al cronograma
            </Button>
          </div>
        }
      />

      <Card variant="outlined" className="min-w-0 space-y-3 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Resumen</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded border border-ck-border px-3 py-3 text-sm">
            <p className="text-ck-text-muted">En preparación</p>
            <p className="mt-1 text-lg font-semibold">{summary.draftPrompts}</p>
          </li>
          <li className="rounded border border-ck-border px-3 py-3 text-sm">
            <p className="text-ck-text-muted">Programadas / ocultas</p>
            <p className="mt-1 text-lg font-semibold">{summary.scheduledPrompts}</p>
          </li>
          <li className="rounded border border-ck-border px-3 py-3 text-sm">
            <p className="text-ck-text-muted">Visibles</p>
            <p className="mt-1 text-lg font-semibold">{summary.releasedPrompts}</p>
          </li>
          <li className="rounded border border-ck-border px-3 py-3 text-sm">
            <p className="text-ck-text-muted">Finalizadas / canceladas</p>
            <p className="mt-1 text-lg font-semibold">{summary.closedPrompts}</p>
          </li>
        </ul>
        <p className="text-sm text-ck-text-secondary">
          Guardar una consigna no la hace visible. Publicar ahora la muestra de inmediato.
          La apertura programada depende del cronograma y del estado.
        </p>
        {/* LEGAL_REVIEW */}
        <p className="text-xs text-ck-text-muted">
          Publicar o reabrir consignas puede afectar plazos de entrega. No modifica las bases
          legales por sí solo. <span className="font-mono">LEGAL_REVIEW</span>
        </p>
      </Card>

      <Card
        id="nueva-consigna"
        variant="outlined"
        className="min-w-0 space-y-4 p-5 md:p-6 scroll-mt-24"
      >
        <h2 className="text-lg font-semibold">Crear o editar consigna</h2>
        <p className="text-sm text-ck-text-secondary">
          El título y las indicaciones son el contenido que verán los participantes cuando la
          consigna esté disponible. Mientras esté en preparación o programada, ese contenido
          permanece oculto.
        </p>
        <form
          action={upsertPromptAction.bind(null, editionId)}
          className="grid gap-5 md:grid-cols-2"
        >
          <label className="text-sm">
            Referencia interna (opcional)
            <span className="mt-1 block text-xs text-ck-text-muted">
              Para editar una consigna existente, pegá su referencia técnica. Vacío = crear
              nueva.
            </span>
            <input
              name="promptId"
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
              aria-label="Referencia interna de la consigna"
            />
          </label>
          <label className="text-sm">
            Orden
            <span className="mt-1 block text-xs text-ck-text-muted">
              Número de consigna en la secuencia del evento.
            </span>
            <input
              name="sequence"
              type="number"
              defaultValue={(prompts[prompts.length - 1]?.sequence ?? 0) + 1}
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Nombre interno
            <span className="mt-1 block text-xs text-ck-text-muted">
              Solo para el equipo. No es el título que ven los participantes.
            </span>
            <input
              name="internalName"
              placeholder="Ej.: consigna-1"
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Estado de preparación
            <span className="mt-1 block text-xs text-ck-text-muted">
              En preparación: no visible. Lista / Programada: sigue oculta hasta la apertura.
            </span>
            <select
              name="status"
              defaultValue="DRAFT"
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            >
              <option value="DRAFT">En preparación</option>
              <option value="READY">Lista para programar</option>
              <option value="LOCKED">Programada · oculta</option>
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            Título de la consigna
            <span className="mt-1 block text-xs text-ck-text-muted">
              Lo verán los participantes cuando la consigna esté disponible.
            </span>
            <input
              name="title"
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Indicaciones para los participantes
            <span className="mt-1 block text-xs text-ck-text-muted">
              Explicá qué deben fotografiar o entregar. Se oculta hasta la publicación.
            </span>
            <textarea
              name="instructions"
              rows={4}
              className="mt-2 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <div className="md:col-span-2 space-y-2">
            <Button type="submit" variant="primary" className="min-h-11 w-full sm:w-auto">
              Guardar cambios
            </Button>
            <p className="text-xs text-ck-text-muted">
              Guardar no publica la consigna. Para mostrarlas ya, usá “Publicar ahora” en la
              ficha correspondiente.
            </p>
          </div>
        </form>
        <p className="text-xs text-ck-text-muted">
          Antes de un evento en vivo, evitá publicar consignas reales de prueba.
        </p>
      </Card>

      {prompts.length === 0 ? (
        <Card variant="outlined" className="p-5">
          <p className="font-medium text-ck-text">Aún no creaste consignas</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            Creá una consigna y definí cuándo estará disponible.
          </p>
        </Card>
      ) : (
        <ul className="space-y-6">
          {prompts.map((p) => {
            const record = p as PromptRecord;
            const adminStatus = presentAdminPromptStatus(p.status);
            const lockedPreview = toPromptPublicDto(record, { clock: simulatedBefore });
            const visibility = presentParticipantPromptVisibility(lockedPreview.status);
            let leakWarning: string | null = null;
            try {
              if (lockedPreview.status === "LOCKED") assertLockedDtoIsSafe(lockedPreview);
            } catch {
              leakWarning =
                "Hay un problema de seguridad en la vista previa: el contenido oculto no debería filtrarse.";
            }
            const canRelease = p.status !== "RELEASED" && p.status !== "CANCELLED";
            return (
              <li key={p.id}>
                <Card variant="outlined" className="min-w-0 space-y-4 p-5 md:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <p className="text-lg font-semibold">
                        Consigna {p.sequence}
                        {p.title?.trim() ? ` · ${p.title}` : ""}
                      </p>
                      <p className="text-sm text-ck-text-secondary">
                        Nombre interno: {p.internalName}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={timelineToneToBadgeVariant(adminStatus.tone)}>
                          {adminStatus.label}
                        </Badge>
                        <Badge variant={timelineToneToBadgeVariant(visibility.tone)}>
                          {visibility.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-ck-text-secondary">{adminStatus.description}</p>
                      <p className="text-sm text-ck-text-secondary">{visibility.description}</p>
                      <p className="text-xs text-ck-text-muted">
                        {presentReleaseMode(p.releaseMode)}
                        {p.releasedAt
                          ? ` · Liberada ${formatTimelineDateTime(p.releasedAt, timezone)}`
                          : ""}
                        {p.captureStartsAt
                          ? ` · Apertura programada ${formatTimelineDateTime(p.captureStartsAt, timezone)}`
                          : ""}
                      </p>
                    </div>
                    {canRelease ? (
                      <form action={releasePromptAction.bind(null, editionId, p.id)}>
                        <ConfirmSubmitButton
                          variant="primary"
                          className="min-h-11 w-full sm:w-auto"
                          confirmMessage={[
                            "¿Publicar esta consigna ahora?",
                            "",
                            "Los participantes podrán ver el título y las indicaciones de inmediato.",
                            "No espera la fecha programada del cronograma.",
                            "Esta acción no elimina entregas existentes.",
                          ].join("\n")}
                        >
                          Publicar ahora
                        </ConfirmSubmitButton>
                      </form>
                    ) : (
                      <p className="text-sm text-ck-yellow" role="status">
                        Ya publicada o cancelada
                      </p>
                    )}
                  </div>

                  <div className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border p-4">
                    <h3 className="text-sm font-semibold text-ck-text">
                      Vista previa para participantes (antes de la apertura)
                    </h3>
                    <p className="mt-2 text-sm text-ck-text-secondary">
                      {lockedPreview.status === "LOCKED"
                        ? lockedPreview.message
                        : "En esta simulación la consigna no permanecería oculta."}
                    </p>
                    {lockedPreview.status === "LOCKED" && lockedPreview.opensAt ? (
                      <p className="mt-2 text-sm text-ck-text-muted">
                        Apertura estimada:{" "}
                        {formatTimelineDateTime(lockedPreview.opensAt, timezone)}
                      </p>
                    ) : null}
                    {leakWarning ? (
                      <p className="mt-2 text-sm text-red-400" role="alert">
                        {leakWarning}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-ck-text-muted">
                        La vista previa oculta no incluye título ni indicaciones.
                      </p>
                    )}
                  </div>

                  <AdminTechnicalInfo
                    title="Información técnica de la consigna"
                    description="IDs y payload de vista previa para soporte. Cerrado por defecto."
                    rows={[
                      {
                        label: "ID de consigna",
                        value: p.id,
                        mono: true,
                        copyText: p.id,
                      },
                      {
                        label: "Estado interno",
                        value: p.status,
                        mono: true,
                      },
                      {
                        label: "Modo de liberación",
                        value: p.releaseMode,
                        mono: true,
                      },
                      {
                        label: "Vista previa (sanitizada)",
                        value: JSON.stringify(lockedPreview),
                        mono: true,
                      },
                      {
                        label: "Versión de contenido",
                        value: String(p.contentVersion),
                      },
                    ]}
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
