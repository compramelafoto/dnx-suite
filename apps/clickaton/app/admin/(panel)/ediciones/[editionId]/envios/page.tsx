import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { SubmissionFiltersPanel } from "@/components/admin/submissions/SubmissionFiltersPanel";
import { SubmissionPhotoPreview } from "@/components/admin/submissions/SubmissionPhotoPreview";
import { ValidationChecklist } from "@/components/admin/submissions/ValidationChecklist";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  adminReviewSubmissionAction,
  ensureUploadConfigAction,
} from "@/lib/photo-upload/admin";
import {
  SUBMISSION_STATUS_FILTER_OPTIONS,
  VALIDATION_FILTER_OPTIONS,
  buildValidationChecklist,
  deriveSubmissionOperationalSummary,
  formatSubmissionDateTime,
  parseTechnicalSummary,
  presentAdminReviewActionLabel,
  presentExifStatus,
  presentFailureOrCaptureReason,
  presentFotoRankLink,
  presentGpsStatus,
  presentMimeAsFormat,
  presentSubmissionStatus,
  presentValidationResult,
  submissionToneToBadgeVariant,
} from "@/lib/photo-upload/ui/submission-status-presentation";
import {
  HUMAN_DECISION_HELP,
  TECHNICAL_VALIDATION_DISCLAIMER,
} from "@/lib/technical-admission/ui/admission-status-presentation";

type Props = {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ status?: string; validation?: string }>;
};

function selectClassName() {
  return "min-h-11 w-full rounded-[var(--ck-radius-sm)] border border-ck-border bg-transparent px-3 py-2 text-sm";
}

export default async function EditionSubmissionsAdminPage({ params, searchParams }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const filters = await searchParams;

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    include: { uploadConfig: true },
  });
  if (!edition) notFound();

  const submissions = await prisma.clickatonPhotoSubmission.findMany({
    where: {
      editionId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.validation ? { validationResult: filters.validation as never } : {}),
    },
    include: {
      prompt: { select: { sequence: true, internalName: true, title: true } },
      registration: { select: { visibleCode: true, firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const basePath = `${adminRoutes.editions}/${editionId}/envios`;
  const activeChips = [
    filters.status
      ? {
          label:
            SUBMISSION_STATUS_FILTER_OPTIONS.find((o) => o.value === filters.status)?.label ??
            "Estado filtrado",
        }
      : null,
    filters.validation
      ? {
          label:
            VALIDATION_FILTER_OPTIONS.find((o) => o.value === filters.validation)?.label ??
            "Validación filtrada",
        }
      : null,
  ].filter(Boolean) as Array<{ label: string }>;

  const emptyBecauseFilters = Boolean(filters.status || filters.validation);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Entregas fotográficas · ${edition.name}`}
        description="Revisá si cada fotografía cumple los requisitos técnicos de la consigna. La validación técnica no determina si será finalista o ganadora."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Entregas" },
        ]}
        actions={
          <form action={ensureUploadConfigAction.bind(null, editionId)}>
            <Button type="submit" variant="secondary" className="min-h-11">
              Preparar configuración de carga
            </Button>
          </form>
        }
      />

      <Card variant="outlined" className="space-y-3 p-5 text-sm">
        <p className="font-semibold text-ck-text">Validación técnica</p>
        <p className="leading-relaxed text-ck-text-secondary">{TECHNICAL_VALIDATION_DISCLAIMER}</p>
        <p className="text-ck-text-muted">
          Cargas habilitadas:{" "}
          <strong>{edition.uploadConfig?.uploadsEnabled ? "Sí" : "No"}</strong>
          {" · "}
          Ubicación por defecto:{" "}
          {edition.uploadConfig?.defaultGpsMode === "REQUIRED"
            ? "Obligatoria"
            : edition.uploadConfig?.defaultGpsMode === "NOT_REQUIRED"
              ? "No requerida"
              : edition.uploadConfig?.defaultGpsMode === "GEOFENCE"
                ? "Área delimitada"
                : "Opcional"}
          {" · "}
          Tolerancia de reloj: {edition.uploadConfig?.captureClockToleranceMinutes ?? 5} min
        </p>
      </Card>

      <form method="get">
        <SubmissionFiltersPanel
          activeChips={activeChips}
          clearHref={activeChips.length > 0 ? basePath : null}
          secondaryFields={
            <>
              <label className="block space-y-2 text-sm">
                <span className="font-medium text-ck-text">Estado técnico</span>
                <select
                  name="status"
                  defaultValue={filters.status ?? ""}
                  className={selectClassName()}
                >
                  <option value="">Todos los estados</option>
                  {SUBMISSION_STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-medium text-ck-text">Resultado de validación</span>
                <select
                  name="validation"
                  defaultValue={filters.validation ?? ""}
                  className={selectClassName()}
                >
                  <option value="">Toda validación</option>
                  {VALIDATION_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          }
          actions={
            <Button type="submit" variant="secondary" size="sm" className="min-h-11">
              Aplicar filtros
            </Button>
          }
        />
      </form>

      {submissions.length === 0 ? (
        <Card variant="outlined" className="space-y-2 p-6">
          <p className="font-semibold text-ck-text">
            {emptyBecauseFilters
              ? "No encontramos resultados"
              : "Todavía no hay fotografías entregadas"}
          </p>
          <p className="text-sm leading-relaxed text-ck-text-muted">
            {emptyBecauseFilters
              ? "Probá cambiar los filtros."
              : "Las fotografías aparecerán cuando los participantes completen una consigna."}
          </p>
        </Card>
      ) : (
        <>
          {/* Escritorio: tabla operativa resumida */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <caption className="sr-only">Listado de entregas fotográficas</caption>
              <thead>
                <tr className="border-b border-ck-border text-ck-text-secondary">
                  <th scope="col" className="px-3 py-3 font-medium">
                    Participante
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    Consigna
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    Estado técnico
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    Alerta
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    FotoRank
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    Fecha de entrega
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const participantName =
                    `${s.registration.firstName} ${s.registration.lastName}`.trim() ||
                    "Participante";
                  const promptLabel =
                    s.prompt.title?.trim() ||
                    s.prompt.internalName ||
                    `Consigna ${s.prompt.sequence}`;
                  const summary = deriveSubmissionOperationalSummary({
                    status: s.status,
                    validationResult: s.validationResult,
                    failureCode: s.failureCode,
                    fotorankEntryId: s.fotorankEntryId,
                    exifStatus: s.exifStatus,
                    gpsStatus: s.gpsStatus,
                    technicalSummary: parseTechnicalSummary(s.technicalSummaryJson),
                  });
                  const fr = presentFotoRankLink({
                    fotorankEntryId: s.fotorankEntryId,
                    status: s.status,
                  });
                  return (
                    <tr key={`row-${s.id}`} className="border-b border-ck-border/80">
                      <td className="px-3 py-3">
                        <p className="font-medium text-ck-text">{participantName}</p>
                        <p className="text-xs text-ck-text-muted">
                          #{s.registration.visibleCode ?? "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-ck-text-secondary">
                        {s.prompt.sequence}. {promptLabel}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={submissionToneToBadgeVariant(summary.tone)}>
                          {presentSubmissionStatus(s.status).label}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-ck-text-secondary">{summary.label}</td>
                      <td className="px-3 py-3">
                        <Badge variant={submissionToneToBadgeVariant(fr.tone)}>{fr.label}</Badge>
                      </td>
                      <td className="px-3 py-3 text-ck-text-muted">
                        {formatSubmissionDateTime(s.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <a
                          href={`#entrega-${s.id}`}
                          className="inline-flex min-h-11 items-center text-sm font-medium text-ck-yellow underline-offset-2 hover:underline"
                        >
                          Revisar entrega
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards: listado mobile + detalle expandido para ambas vistas */}
          <ul className="space-y-6">
            {submissions.map((s) => {
              const participantName =
                `${s.registration.firstName} ${s.registration.lastName}`.trim() || "Participante";
              const promptLabel =
                s.prompt.title?.trim() ||
                s.prompt.internalName ||
                `Consigna ${s.prompt.sequence}`;
              const technical = parseTechnicalSummary(s.technicalSummaryJson);
              const status = presentSubmissionStatus(s.status);
              const validation = presentValidationResult(s.validationResult);
              const summary = deriveSubmissionOperationalSummary({
                status: s.status,
                validationResult: s.validationResult,
                failureCode: s.failureCode,
                fotorankEntryId: s.fotorankEntryId,
                exifStatus: s.exifStatus,
                gpsStatus: s.gpsStatus,
                technicalSummary: technical,
              });
              const fr = presentFotoRankLink({
                fotorankEntryId: s.fotorankEntryId,
                status: s.status,
              });
              const reason =
                presentFailureOrCaptureReason(s.failureCode) ??
                presentFailureOrCaptureReason(technical.captureEval?.reason ?? null);
              const exif = presentExifStatus(s.exifStatus);
              const gps = presentGpsStatus(s.gpsStatus);
              const checklist = buildValidationChecklist({
                status: s.status,
                validationResult: s.validationResult,
                failureCode: s.failureCode,
                exifStatus: s.exifStatus,
                gpsStatus: s.gpsStatus,
                captureDateInterpreted: s.captureDateInterpreted,
                confirmedAt: s.confirmedAt,
                createdAt: s.createdAt,
                technicalSummary: technical,
                hasOriginal: Boolean(s.originalStorageKey),
                hasPreview: Boolean(s.previewStorageKey),
              });
              const device = [technical.cameraMake, technical.cameraModel]
                .filter(Boolean)
                .join(" ");

              return (
                <li key={s.id} id={`entrega-${s.id}`}>
                  <Card variant="outlined" className="space-y-6 p-5 sm:p-6">
                    <header className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-ck-yellow">
                            Entrega fotográfica
                          </p>
                          <h2 className="text-xl font-semibold tracking-tight text-ck-text">
                            Entrega de {participantName}
                          </h2>
                          <p className="text-sm leading-relaxed text-ck-text-secondary">
                            Revisá si la fotografía cumple los requisitos técnicos de la consigna.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={submissionToneToBadgeVariant(summary.tone)}>
                            {summary.label}
                          </Badge>
                          <Badge variant={submissionToneToBadgeVariant(status.tone)}>
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                      {(reason || summary.nextAction) && (
                        <div
                          className="rounded-[var(--ck-radius-sm)] border border-[var(--ck-warning)]/40 bg-[var(--ck-warning-soft)] px-4 py-3 text-sm"
                          role="status"
                        >
                          <p className="font-semibold text-ck-text">
                            {reason?.title ?? summary.label}
                          </p>
                          <p className="mt-1 leading-relaxed text-ck-text-secondary">
                            {reason?.adminExplanation ?? summary.description}
                          </p>
                          {summary.nextAction || reason?.correctableHint ? (
                            <p className="mt-2 text-ck-text-muted">
                              {summary.nextAction ?? reason?.correctableHint}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </header>

                    <SubmissionPhotoPreview
                      participantName={participantName}
                      promptLabel={promptLabel}
                      hasPreview={Boolean(s.previewStorageKey)}
                      hasOriginal={Boolean(s.originalStorageKey)}
                    />

                    <dl className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Participante
                        </dt>
                        <dd className="mt-1 text-sm text-ck-text">
                          {participantName}
                          {s.registration.visibleCode
                            ? ` · #${s.registration.visibleCode}`
                            : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Consigna
                        </dt>
                        <dd className="mt-1 text-sm text-ck-text">
                          {s.prompt.sequence}. {promptLabel}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Fecha de captura
                        </dt>
                        <dd className="mt-1 text-sm text-ck-text">
                          {s.captureDateInterpreted
                            ? formatSubmissionDateTime(s.captureDateInterpreted)
                            : "No pudimos comprobar la fecha de captura."}
                        </dd>
                        <dd className="mt-1 text-xs text-ck-text-muted">
                          Es la fecha registrada por la cámara o el dispositivo al tomar la
                          fotografía.
                          {s.captureDateInterpreted
                            ? " Dato informado por el archivo."
                            : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Fecha de entrega
                        </dt>
                        <dd className="mt-1 text-sm text-ck-text">
                          {formatSubmissionDateTime(s.createdAt)}
                        </dd>
                        <dd className="mt-1 text-xs text-ck-text-muted">
                          Es el momento en que la fotografía fue enviada a Clickatón.
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Formato
                        </dt>
                        <dd className="mt-1 text-sm text-ck-text">
                          {presentMimeAsFormat(technical.mime)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Dimensiones
                        </dt>
                        <dd className="mt-1 text-sm text-ck-text">
                          {typeof technical.width === "number" &&
                          typeof technical.height === "number"
                            ? `${technical.width} × ${technical.height} px`
                            : "No informadas"}
                        </dd>
                      </div>
                      {device ? (
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                            Dispositivo
                          </dt>
                          <dd className="mt-1 text-sm text-ck-text">{device}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-ck-text-muted">
                          Ubicación registrada
                        </dt>
                        <dd className="mt-1 text-sm text-ck-text">{gps.label}</dd>
                        <dd className="mt-1 text-xs text-ck-text-muted">{gps.description}</dd>
                      </div>
                    </dl>

                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-ck-text">Resultado de validación</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={submissionToneToBadgeVariant(validation.tone)}>
                          {validation.label}
                        </Badge>
                        <Badge variant={submissionToneToBadgeVariant(exif.tone)}>
                          {exif.label}
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-ck-text-secondary">
                        {validation.description}
                      </p>
                    </div>

                    <ValidationChecklist items={checklist} />

                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold text-ck-text">Envío a FotoRank</h3>
                      <p className="text-sm leading-relaxed text-ck-text-secondary">
                        Después de la validación técnica, la fotografía se envía a FotoRank para
                        continuar con la evaluación.
                      </p>
                      <Badge variant={submissionToneToBadgeVariant(fr.tone)}>{fr.label}</Badge>
                      <p className="text-sm text-ck-text-muted">{fr.description}</p>
                      {fr.nextAction ? (
                        <p className="text-sm text-ck-text-secondary">{fr.nextAction}</p>
                      ) : null}
                    </section>

                    <section className="space-y-4 border-t border-ck-border pt-6">
                      <div>
                        <h3 className="text-sm font-semibold text-ck-text">
                          Decisión administrativa
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-ck-text-muted">
                          {HUMAN_DECISION_HELP}
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
                        <form
                          action={adminReviewSubmissionAction.bind(null, editionId, s.id)}
                          className="w-full lg:w-auto"
                        >
                          <input type="hidden" name="decision" value="APPROVE" />
                          <ConfirmSubmitButton
                            variant="primary"
                            size="sm"
                            className="min-h-11 w-full lg:w-auto"
                            confirmMessage="¿Aceptar técnicamente esta fotografía? La validación técnica no determina si será finalista o ganadora. Revisá los datos antes de confirmar."
                          >
                            {presentAdminReviewActionLabel("APPROVE")}
                          </ConfirmSubmitButton>
                        </form>
                        <form
                          action={adminReviewSubmissionAction.bind(null, editionId, s.id)}
                          className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto"
                        >
                          <input type="hidden" name="decision" value="REJECT" />
                          <input
                            name="notes"
                            placeholder="Motivo para el participante"
                            className="min-h-11 flex-1 rounded-[var(--ck-radius-sm)] border border-ck-border bg-transparent px-3 text-sm"
                            aria-label="Motivo para marcar como no válida"
                          />
                          <ConfirmSubmitButton
                            variant="outline"
                            size="sm"
                            className="min-h-11 w-full sm:w-auto"
                            confirmMessage="¿Marcar esta fotografía como no válida? La entrega dejará de continuar hacia la evaluación. Revisá el motivo antes de confirmar. El participante puede ver un mensaje según el motivo informado."
                          >
                            {presentAdminReviewActionLabel("REJECT")}
                          </ConfirmSubmitButton>
                        </form>
                        <form
                          action={adminReviewSubmissionAction.bind(null, editionId, s.id)}
                          className="w-full lg:w-auto"
                        >
                          <input type="hidden" name="decision" value="MANUAL_REVIEW" />
                          <ConfirmSubmitButton
                            variant="secondary"
                            size="sm"
                            className="min-h-11 w-full lg:w-auto"
                            confirmMessage="¿Solicitar revisión técnica para esta fotografía? Quedará marcada para una mirada humana."
                          >
                            {presentAdminReviewActionLabel("MANUAL_REVIEW")}
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                      {s.failureMessage ? (
                        <p className="text-sm text-ck-text-secondary">
                          Mensaje registrado: {s.failureMessage}
                        </p>
                      ) : null}
                    </section>

                    <AdminTechnicalInfo
                      title="Información técnica"
                      description="IDs, códigos internos y referencias de soporte. Cerrado por defecto."
                      rows={[
                        { label: "ID de entrega", value: s.id, mono: true, copyText: s.id },
                        {
                          label: "ID de inscripción",
                          value: s.registrationId,
                          mono: true,
                          copyText: s.registrationId,
                        },
                        {
                          label: "ID de consigna",
                          value: s.promptId,
                          mono: true,
                          copyText: s.promptId,
                        },
                        {
                          label: "Estado interno",
                          value: s.status,
                          mono: true,
                        },
                        {
                          label: "Resultado de validación interno",
                          value: s.validationResult ?? "—",
                          mono: true,
                        },
                        {
                          label: "Código de falla",
                          value: s.failureCode ?? "—",
                          mono: true,
                        },
                        {
                          label: "Tipo MIME",
                          value: technical.mime ?? "—",
                          mono: true,
                        },
                        {
                          label: "Huella del archivo (hash)",
                          value: s.sha256 ?? "—",
                          mono: true,
                          copyText: s.sha256 ?? undefined,
                        },
                        {
                          label: "Clave de almacenamiento original",
                          value: s.originalStorageKey ?? "—",
                          mono: true,
                        },
                        {
                          label: "Clave de vista previa",
                          value: s.previewStorageKey ?? "—",
                          mono: true,
                        },
                        {
                          label: "ID FotoRank (obra)",
                          value: s.fotorankEntryId ?? "—",
                          mono: true,
                          copyText: s.fotorankEntryId ?? undefined,
                        },
                        {
                          label: "ID FotoRank (concurso)",
                          value: s.fotorankContestId ?? "—",
                          mono: true,
                        },
                        {
                          label: "Estado captura interno",
                          value: s.exifStatus ?? "—",
                          mono: true,
                        },
                        {
                          label: "Estado ubicación interno",
                          value: s.gpsStatus ?? "—",
                          mono: true,
                        },
                        {
                          label: "Latitud",
                          value:
                            typeof s.gpsLatitude === "number" ? String(s.gpsLatitude) : "—",
                          mono: true,
                        },
                        {
                          label: "Longitud",
                          value:
                            typeof s.gpsLongitude === "number" ? String(s.gpsLongitude) : "—",
                          mono: true,
                        },
                        {
                          label: "Delta captura (min)",
                          value:
                            s.captureDeltaMinutes != null
                              ? String(s.captureDeltaMinutes)
                              : "—",
                          mono: true,
                        },
                        {
                          label: "Zona horaria asumida",
                          value: s.captureTimezoneAssumed ?? "—",
                          mono: true,
                        },
                        {
                          label: "Actualizado",
                          value: s.updatedAt.toISOString(),
                          mono: true,
                        },
                      ]}
                    />
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
