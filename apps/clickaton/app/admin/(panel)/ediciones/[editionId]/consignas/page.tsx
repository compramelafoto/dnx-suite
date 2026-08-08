import { notFound } from "next/navigation";
import {
  listItems,
  listThemes,
  MAX_PROMPTS_PER_EDITION,
  PHOTO_PROMPT_DIFFICULTIES,
  PHOTO_PROMPT_INSPIRATION_TYPES,
} from "@repo/photo-prompt-library";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { LibraryPicker } from "@/components/admin/prompt-library/LibraryPicker";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  createLibraryDraftFromEditionAction,
  movePromptFormAction,
  unassignLibraryPromptFormAction,
} from "@/lib/prompt-library/admin-actions";
import { isOpsTestEdition } from "@/lib/prompt-library/ops-test-edition";
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

type Props = {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ draftCreated?: string }>;
};

const DIFFICULTY_LABELS: Record<string, string> = {
  EASY: "Fácil",
  MEDIUM: "Media",
  HARD: "Difícil",
};

const INSPIRATION_LABELS: Record<string, string> = {
  DIRECTOR: "Director/a",
  MOVIE: "Película",
  GENRE: "Género",
  ART_MOVEMENT: "Movimiento artístico",
  PHOTOGRAPHER: "Fotógrafo/a",
  VISUAL_STYLE: "Estilo visual",
  OTHER: "Otra",
};

export default async function EditionPromptsAdminPage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const sp = await searchParams;

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true, slug: true, timezone: true, isOpsFixture: true },
  });
  if (!edition) notFound();

  const timezone = edition.timezone ?? "America/Argentina/Buenos_Aires";
  const opsTestEdition = await isOpsTestEdition(editionId);

  const prompts = await prisma.clickatonPrompt.findMany({
    where: { editionId },
    orderBy: { sequence: "asc" },
    include: {
      libraryItem: {
        select: { id: true, status: true, version: true, title: true },
      },
    },
  });

  const [approvedItems, themes] = await Promise.all([
    listItems({ status: "APPROVED", take: 200 }, { prisma }),
    listThemes({ prisma }),
  ]);

  const summary = summarizeTimelineAdmin({
    promptStatuses: prompts.map((p) => p.status),
    timelineStatus: null,
    hasDraft: false,
    paused: false,
  });

  const simulatedBefore = fixedClock(new Date("2026-09-19T09:00:00-03:00"));
  const selectedCount = prompts.length;

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Consignas de la edición"
        description="Elegí consignas de la Biblioteca o creá borradores nuevos. Definí el orden y cuándo estarán disponibles."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Consignas" },
        ]}
        actions={
          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <p className="text-sm font-medium text-ck-text" aria-live="polite">
              {selectedCount} / {MAX_PROMPTS_PER_EDITION} seleccionadas
            </p>
            <LibraryPicker
              editionId={editionId}
              alreadyAssignedCount={selectedCount}
              alreadyAssignedLibraryIds={prompts
                .map((p) => p.libraryItemId)
                .filter((id): id is string => Boolean(id))}
              themes={themes.map((t) => ({ id: t.id, name: t.name, slug: t.slug }))}
              initialItems={approvedItems.map((item) => ({
                id: item.id,
                title: item.title,
                description: item.description,
                themeId: item.themeId,
                themeName: item.theme.name,
                subthemeName: item.subtheme?.name ?? null,
                difficulty: item.difficulty,
                inspirationType: item.inspirationType,
                inspirationLabel: item.inspirationLabel,
                inspirationNotes: item.inspirationNotes,
                usageCount: item.usageCount,
                lastUsedAt: item.lastUsedAt,
                version: item.version,
              }))}
            />
            <Button
              href="#crear-biblioteca"
              variant="secondary"
              className="min-h-11 w-full sm:w-auto"
            >
              + Crear nueva consigna
            </Button>
            <Button
              href={`${adminRoutes.editions}/${editionId}/cronograma`}
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
            >
              Ir al cronograma
            </Button>
          </div>
        }
      />

      {sp.draftCreated ? (
        <Card variant="outlined" className="border-ck-yellow/40 p-4" role="status">
          <p className="text-sm font-medium">
            Borrador creado en la Biblioteca (no asignado a esta edición).
          </p>
          <p className="mt-1 text-xs text-ck-text-muted font-mono">{sp.draftCreated}</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            Debe aprobarse en Super Admin antes de poder elegirlo para una edición comercial.
          </p>
        </Card>
      ) : null}

      {opsTestEdition ? (
        <p className="text-xs text-ck-text-muted" role="note">
          Edición de prueba (ops/fixture): se permite asignar borradores de biblioteca solo en este
          contexto de Test Mode.
        </p>
      ) : null}

      <Card variant="outlined" className="min-w-0 space-y-3 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Resumen</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded border border-ck-border px-3 py-3 text-sm">
            <p className="text-ck-text-muted">Seleccionadas</p>
            <p className="mt-1 text-lg font-semibold">
              {selectedCount} / {MAX_PROMPTS_PER_EDITION}
            </p>
          </li>
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
        </ul>
        <p className="text-sm text-ck-text-secondary">
          Elegir de la Biblioteca copia un snapshot inmutable. Aprobada en biblioteca no significa
          publicada a participantes: eso lo define el reveal del cronograma.
        </p>
      </Card>

      <Card
        id="crear-biblioteca"
        variant="outlined"
        className="min-w-0 space-y-4 p-5 md:p-6 scroll-mt-24"
      >
        <h2 className="text-lg font-semibold">+ Crear nueva consigna</h2>
        <p className="text-sm text-ck-text-secondary">
          Crea un borrador en la Biblioteca central. No se asigna automáticamente a esta edición.
        </p>
        <form
          action={createLibraryDraftFromEditionAction.bind(null, editionId)}
          className="grid gap-5 md:grid-cols-2"
        >
          <label className="text-sm md:col-span-2">
            Título
            <input
              name="title"
              required
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Descripción / indicaciones
            <textarea
              name="description"
              required
              rows={4}
              className="mt-2 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Temática
            <select
              name="themeId"
              required
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
              defaultValue={themes[0]?.id ?? ""}
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Dificultad
            <select
              name="difficulty"
              defaultValue="MEDIUM"
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            >
              {PHOTO_PROMPT_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d] ?? d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Tipo de inspiración (opcional)
            <select
              name="inspirationType"
              defaultValue=""
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            >
              <option value="">—</option>
              {PHOTO_PROMPT_INSPIRATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INSPIRATION_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Etiqueta de inspiración (opcional)
            <input
              name="inspirationLabel"
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Notas de inspiración (opcional)
            <textarea
              name="inspirationNotes"
              rows={2}
              className="mt-2 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" variant="primary" className="min-h-11 w-full sm:w-auto">
              Crear borrador en Biblioteca
            </Button>
          </div>
        </form>
      </Card>

      {prompts.length === 0 ? (
        <Card variant="outlined" className="p-5">
          <p className="font-medium text-ck-text">Aún no hay consignas seleccionadas</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            Usá “+ Elegir de Biblioteca” para armar las {MAX_PROMPTS_PER_EDITION} consignas de la
            edición.
          </p>
        </Card>
      ) : (
        <ul className="space-y-6">
          {prompts.map((p, index) => {
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
            const displayTitle = p.titleSnapshot?.trim() || p.title?.trim() || "";
            return (
              <li key={p.id}>
                <Card variant="outlined" className="min-w-0 space-y-4 p-5 md:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <p className="text-lg font-semibold">
                        Consigna {p.sequence}
                        {displayTitle ? ` · ${displayTitle}` : ""}
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
                        {p.libraryItemId ? (
                          <>
                            <Badge variant="brand">Biblioteca</Badge>
                            {p.themeSnapshot ? (
                              <Badge variant="neutral">{p.themeSnapshot}</Badge>
                            ) : null}
                            {p.libraryVersion != null ? (
                              <Badge variant="neutral">v{p.libraryVersion}</Badge>
                            ) : null}
                            {p.libraryItem?.status ? (
                              <Badge
                                variant={
                                  p.libraryItem.status === "APPROVED" ? "success" : "warning"
                                }
                              >
                                Biblioteca: {p.libraryItem.status}
                              </Badge>
                            ) : null}
                          </>
                        ) : (
                          <Badge variant="neutral">Manual / legacy</Badge>
                        )}
                      </div>
                      {p.subthemeSnapshot ? (
                        <p className="text-xs text-ck-text-muted">
                          Subtemática: {p.subthemeSnapshot}
                        </p>
                      ) : null}
                      <p className="text-sm text-ck-text-secondary">{adminStatus.description}</p>
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
                    <div className="flex flex-col gap-2 sm:items-end">
                      <div className="flex flex-wrap gap-2">
                        <form
                          action={movePromptFormAction.bind(null, editionId, p.id, "up")}
                        >
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="min-h-11"
                            disabled={index === 0}
                            aria-label={`Subir consigna ${p.sequence}`}
                          >
                            Subir
                          </Button>
                        </form>
                        <form
                          action={movePromptFormAction.bind(null, editionId, p.id, "down")}
                        >
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="min-h-11"
                            disabled={index === prompts.length - 1}
                            aria-label={`Bajar consigna ${p.sequence}`}
                          >
                            Bajar
                          </Button>
                        </form>
                      </div>
                      {p.libraryItemId ? (
                        <form
                          action={unassignLibraryPromptFormAction.bind(
                            null,
                            editionId,
                            p.id,
                          )}
                        >
                          <ConfirmSubmitButton
                            variant="outline"
                            className="min-h-11"
                            confirmMessage="¿Desvincular de la biblioteca? Se conservan los snapshots históricos."
                          >
                            Desvincular biblioteca
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
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
                        label: "libraryItemId",
                        value: p.libraryItemId ?? "—",
                        mono: true,
                      },
                      {
                        label: "titleSnapshot",
                        value: p.titleSnapshot ?? "—",
                      },
                      {
                        label: "Estado interno",
                        value: p.status,
                        mono: true,
                      },
                      {
                        label: "Vista previa (sanitizada)",
                        value: JSON.stringify(lockedPreview),
                        mono: true,
                      },
                    ]}
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Card
        id="nueva-consigna"
        variant="outlined"
        className="min-w-0 space-y-4 p-5 md:p-6 scroll-mt-24"
      >
        <h2 className="text-lg font-semibold">Crear consignas manuales (legacy)</h2>
        <p className="text-sm text-ck-text-secondary">
          Flujo anterior sin Biblioteca. Preferí “Elegir de Biblioteca” para nuevas ediciones.
        </p>
        <form
          action={upsertPromptAction.bind(null, editionId)}
          className="grid gap-5 md:grid-cols-2"
        >
          <label className="text-sm">
            Referencia interna (opcional)
            <input
              name="promptId"
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
              aria-label="Referencia interna de la consigna"
            />
          </label>
          <label className="text-sm">
            Orden
            <input
              name="sequence"
              type="number"
              defaultValue={(prompts[prompts.length - 1]?.sequence ?? 0) + 1}
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Nombre interno
            <input
              name="internalName"
              placeholder="Ej.: consigna-1"
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Estado de preparación
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
            <input
              name="title"
              className="mt-2 min-h-11 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Indicaciones para los participantes
            <textarea
              name="instructions"
              rows={4}
              className="mt-2 w-full rounded border border-ck-border bg-transparent px-3 py-2"
            />
          </label>
          <div className="md:col-span-2 space-y-2">
            <Button type="submit" variant="secondary" className="min-h-11 w-full sm:w-auto">
              Guardar consigna manual
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
