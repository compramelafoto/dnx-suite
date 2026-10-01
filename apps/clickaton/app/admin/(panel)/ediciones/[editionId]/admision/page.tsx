import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { JuryHandoffCard } from "@/components/admin/jury/JuryHandoffCard";
import { PasosDelLote } from "@/components/admin/admission/PasosDelLote";
import { ColaDeRevision } from "@/components/admin/admission/ColaDeRevision";
import { MiniaturaDeEnvio } from "@/components/admin/admission/MiniaturaDeEnvio";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getAdminIntegrations } from "@/config/admin/integrations";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  closeBatchAction,
  ensureDraftBatchAction,
  evaluatePendingBulkAction,
  toggleAdmissionAction,
  freezeBatchAction,
  reopenBatchAction,
} from "@/lib/technical-admission/actions";
import {
  ensureAdmissionConfig,
  getAdmissionDashboard,
  listarPendientesDeRevision,
} from "@/lib/technical-admission/service";
import { senalDeDecision } from "@/lib/technical-admission/por-que-espera";
import {
  pasosDelLote,
  resumenDeLaSituacion,
  type EstadoDelLote,
  type SituacionDelLote,
} from "@/lib/technical-admission/pasos-del-lote";
import {
  HUMAN_DECISION_HELP,
  TECHNICAL_VALIDATION_DISCLAIMER,
  admissionToneToBadgeVariant,
  parseReasonCodes,
  presentAccreditationPolicy,
  presentAdmissionReasonCode,
  presentAdmissionStatus,
  presentBatchStatus,
} from "@/lib/technical-admission/ui/admission-status-presentation";
import { formatSubmissionDateTime } from "@/lib/photo-upload/ui/submission-status-presentation";
import {
  CONFLICT_OF_INTEREST_COPY,
  presentJuryActionLabel,
} from "@/lib/jury-results/ui/jury-results-status-presentation";

type Props = { params: Promise<{ editionId: string }> };

/**
 * El tilde y la cruz de cada fila.
 *
 * La etiqueta sola obliga a leer para saber si la foto entró o quedó afuera;
 * el símbolo se ve de un vistazo. Va con `aria-hidden` porque la etiqueta de
 * al lado ya dice lo mismo con palabras.
 */
const SENAL = {
  ADMITIDA: { simbolo: "✓", clase: "text-base text-ck-success" },
  RECHAZADA: { simbolo: "✗", clase: "text-base text-ck-danger" },
  ESPERA: { simbolo: "⏳", clase: "text-base text-ck-warning" },
  FUERA_DE_JUEGO: { simbolo: "—", clase: "text-base text-ck-text-muted" },
} as const;

export default async function EditionAdmissionPage({ params }: Props) {
  const user = await requireClickatonAdmin();
  const { editionId } = await params;
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true },
  });
  if (!edition) notFound();

  await ensureAdmissionConfig(editionId);
  const dash = await getAdmissionDashboard(editionId, {
    id: user.id,
    email: user.email,
    globalRole: user.globalRole,
  });
  const integrations = getAdminIntegrations();

  const recent = await prisma.clickatonTechnicalAdmissionDecision.findMany({
    where: { editionId },
    orderBy: { evaluatedAt: "desc" },
    take: 25,
    select: {
      id: true,
      submissionId: true,
      status: true,
      eligible: true,
      publicRejectionReason: true,
      evaluatedAt: true,
      blockingReasons: true,
      warningReasons: true,
      manualReviewReasons: true,
      fotorankEntryId: true,
    },
  });

  /*
   * Vista previa de cada obra: decidir sin ver la fotografía no es decidir.
   *
   * Antes se buscaba un asset `JURY_PREVIEW` de FotoRank, que en Clickatón no
   * existe: la copia liviana vive en el bucket privado de la maratón, no en
   * FotoRank. Por eso todas las filas decían "Sin vista previa". Los bytes
   * salen de la ruta del panel, que pide sesión de administración.
   */
  const pendientes = await listarPendientesDeRevision({
    editionId,
    actor: { id: user.id, email: user.email, globalRole: user.globalRole },
    limite: 25,
  });

  const batchStatus = presentBatchStatus(dash.batch?.status);

  /*
   * Cuántas fotos revisa cada pasada.
   *
   * El mismo número va al formulario y al texto que dice cuántas veces hay que
   * apretar: si fueran dos constantes, un día dirían cosas distintas.
   */
  const POR_TANDA = 100;

  const situacionDelLote: SituacionDelLote = {
    estadoDelLote: (dash.batch?.status ?? null) as EstadoDelLote | null,
    sinEvaluar: dash.totals.sinRevisar,
    requierenRevision: dash.totals.pendingReview,
    admitidas: dash.totals.admitted,
    porTanda: POR_TANDA,
  };
  const pasos = pasosDelLote(situacionDelLote);
  const kpiCards: Array<{ label: string; value: number; help: string }> = [
    {
      label: "Entregas",
      value: dash.totals.submissions,
      help: "Fotografías registradas en la edición.",
    },
    {
      label: "Confirmadas",
      value: dash.totals.confirmed,
      help: "Entregas en estado confirmado.",
    },
    {
      label: "Elegibles",
      value: dash.totals.eligible,
      help: "Cumplen condiciones para admisión técnica.",
    },
    {
      label: "Aceptadas técnicamente",
      value: dash.totals.admitted,
      help: "Admitidas en la etapa técnica (no es decisión del jurado).",
    },
    {
      label: "Requieren revisión",
      value: dash.totals.pendingReview,
      help: "Necesitan una mirada humana.",
    },
    {
      label: "No admitidas",
      value: dash.totals.rejected,
      help: "No continúan en esta etapa técnica.",
    },
    {
      label: "Excluidas",
      value: dash.totals.excluded,
      help: "Excluidas por la organización.",
    },
    {
      label: "Listas para jurado",
      value: dash.totals.frozen,
      help: "Congeladas para el circuito de jurado.",
    },
    {
      label: "Sin vínculo FotoRank",
      value: dash.totals.withoutEntry,
      help: "Entregas sin fotografía vinculada en FotoRank.",
    },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Admisión técnica · ${edition.name}`}
        description="Definí qué fotografías continúan hacia la evaluación. La admisión técnica no asigna puntajes ni elige ganadores."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Admisión técnica" },
        ]}
        actions={
          <>
            <Button
              href={`/api/admin/editions/${editionId}/admission/export?mode=admin`}
              variant="secondary"
              className="min-h-11"
            >
              Exportar para organización
            </Button>
            <Button
              href={`/api/admin/editions/${editionId}/admission/export?mode=jury`}
              variant="secondary"
              className="min-h-11"
            >
              Exportar para jurado
            </Button>
          </>
        }
      />

      <Card variant="outlined" className="space-y-3 p-5 text-sm">
        <p className="font-semibold text-ck-text">Validación técnica</p>
        <p className="leading-relaxed text-ck-text-secondary">{TECHNICAL_VALIDATION_DISCLAIMER}</p>
        <p className="leading-relaxed text-ck-text-muted">{HUMAN_DECISION_HELP}</p>
        <p className="leading-relaxed text-ck-text-muted">
          {presentJuryActionLabel("freeze_for_jury")} prepara el circuito artístico. No es{" "}
          {presentJuryActionLabel("publish_results").toLowerCase()} ni cierra puntajes del jurado.
        </p>
      </Card>

      <JuryHandoffCard
        editionId={editionId}
        batchStatus={dash.batch?.status}
        batchId={dash.batch?.id}
        frozenCount={dash.totals.frozen}
        fotorankAdminHref={integrations.fotorank.href}
        admissionHref={`${adminRoutes.editions}/${editionId}/admision`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((item) => (
          <Card key={item.label} variant="outlined" className="space-y-2 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ck-text-muted">
              {item.label}
            </p>
            <p className="text-2xl font-semibold text-ck-text">{item.value}</p>
            <p className="text-xs leading-relaxed text-ck-text-muted">{item.help}</p>
          </Card>
        ))}
      </div>

      <Card variant="outlined" className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h2 className="font-semibold text-ck-text">Estado del proceso</h2>
            <p className="text-sm leading-relaxed text-ck-text-secondary">
              Admisión habilitada:{" "}
              <strong>{dash.config.admissionEnabled ? "Sí" : "No"}</strong>
              {" · "}Acreditación:{" "}
              <strong>
                {presentAccreditationPolicy(dash.config.accreditationRequiredForAdmission)}
              </strong>
            </p>
            <p className="text-sm text-ck-text-muted">
              {dash.config.admissionEnabled
                ? "Cada foto que entra se revisa sola: hora de captura, GPS y duplicados."
                : "Con la admisión apagada las fotos se suben igual, pero ninguna se revisa sola y el jurado no va a tener obras para mirar: sólo ve las que pasaron por acá."}
            </p>
            <form action={toggleAdmissionAction.bind(null, editionId)}>
              <input
                type="hidden"
                name="enabled"
                value={dash.config.admissionEnabled ? "false" : "true"}
              />
              {dash.config.admissionEnabled ? (
                <ConfirmSubmitButton
                  confirmMessage="Si apagás la admisión técnica, las fotos que entren dejan de revisarse solas. ¿Seguro?"
                  variant="outline"
                  size="sm"
                >
                  Apagar la admisión técnica
                </ConfirmSubmitButton>
              ) : (
                <Button type="submit" variant="primary" size="sm">
                  Encender la admisión técnica
                </Button>
              )}
            </form>
          </div>
          <Badge variant={admissionToneToBadgeVariant(batchStatus.tone)}>
            {batchStatus.label}
          </Badge>
        </div>
        <p className="text-sm text-ck-text-muted">{batchStatus.description}</p>
        {dash.batch ? (
          <p className="text-sm text-ck-text-secondary">
            En este lote: {dash.batch.admittedEntries} aceptadas técnicamente ·{" "}
            {dash.batch.pendingReviewEntries} con revisión pendiente
          </p>
        ) : (
          <p className="text-sm text-ck-text-secondary">
            Todavía no hay un lote. Creá uno en preparación para evaluar entregas.
          </p>
        )}
        <AdminTechnicalInfo
          title="Información técnica del proceso"
          description="Versiones, reloj del servidor e IDs de lote. Cerrado por defecto."
          rows={[
            {
              label: "Versión de reglas",
              value: dash.config.rulesVersion,
              mono: true,
            },
            {
              label: "Versión de cronograma",
              value:
                dash.window.timelineVersion != null
                  ? String(dash.window.timelineVersion)
                  : "—",
              mono: true,
            },
            {
              label: "Hora del servidor",
              value: dash.window.serverNow,
              mono: true,
            },
            {
              label: "ID de lote",
              value: dash.batch?.id ?? "—",
              mono: true,
              copyText: dash.batch?.id,
            },
            {
              label: "Estado interno del lote",
              value: dash.batch?.status ?? "—",
              mono: true,
            },
          ]}
        />
      </Card>

      <PasosDelLote
        pasos={pasos}
        resumen={resumenDeLaSituacion(situacionDelLote)}
        acciones={{
          1: (
            <form action={ensureDraftBatchAction.bind(null, editionId)}>
              <Button type="submit" variant="secondary" size="sm" className="min-h-11">
                Abrir el lote
              </Button>
            </form>
          ),
          2: (
            <form action={evaluatePendingBulkAction.bind(null, editionId)}>
              <input type="hidden" name="requestId" value={crypto.randomUUID()} />
              <input type="hidden" name="limit" value={String(POR_TANDA)} />
              <ConfirmSubmitButton
                variant="primary"
                size="sm"
                className="min-h-11"
                confirmMessage="¿Revisar las fotos contra las reglas? No es una decisión del jurado: las que no cumplan quedan con su motivo, y las dudosas esperan que las mires vos."
              >
                Revisar las fotos
              </ConfirmSubmitButton>
            </form>
          ),
          3: dash.batch ? (
            <form action={closeBatchAction.bind(null, editionId)}>
              <input type="hidden" name="batchId" value={dash.batch.id} />
              <ConfirmSubmitButton
                variant="secondary"
                size="sm"
                className="min-h-11"
                confirmMessage="¿Cerrar el lote? No van a entrar más fotos a esta tanda."
              >
                Cerrar el lote
              </ConfirmSubmitButton>
            </form>
          ) : null,
          4: dash.batch ? (
            <form action={freezeBatchAction.bind(null, editionId)}>
              <input type="hidden" name="batchId" value={dash.batch.id} />
              <ConfirmSubmitButton
                variant="primary"
                size="sm"
                className="min-h-11"
                confirmMessage="¿Congelar para el jurado? Las obras quedan anónimas y listas para evaluar. A partir de acá el jurado las ve."
              >
                Congelar para el jurado
              </ConfirmSubmitButton>
            </form>
          ) : null,
        }}
      />

      {/*
        Reabrir queda aparte de los pasos a propósito: no es parte del camino,
        es dar marcha atrás. Mezclarla con los cuatro la haría parecer un paso
        más, y pedir el motivo dejaría de leerse como lo que es.
      */}
      {dash.batch ? (
        <Card variant="outlined" className="space-y-3 p-5">
          <p className="text-sm font-semibold text-ck-text">Volver atrás</p>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Reabrir el lote deshace el cierre. No se puede si ya está congelado para el jurado.
          </p>
          <form
            action={reopenBatchAction.bind(null, editionId)}
            className="flex w-full flex-col gap-3 sm:flex-row"
          >
            <input type="hidden" name="batchId" value={dash.batch.id} />
            <input
              name="reason"
              placeholder="Por qué lo reabrís"
              className="min-h-11 flex-1 rounded-[var(--ck-radius-sm)] border border-ck-border bg-transparent px-3 text-sm sm:max-w-sm"
              required
              aria-label="Motivo de reapertura del lote"
            />
            <ConfirmSubmitButton
              variant="outline"
              size="sm"
              className="min-h-11 w-full sm:w-auto"
              confirmMessage="¿Reabrir el lote? Escribí el motivo antes de confirmar."
            >
              Reabrir el lote
            </ConfirmSubmitButton>
          </form>
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-3 p-5 text-sm">
        <p className="font-semibold text-ck-text">{CONFLICT_OF_INTEREST_COPY.title}</p>
        <p className="leading-relaxed text-ck-text-secondary">
          {CONFLICT_OF_INTEREST_COPY.description}
        </p>
        <p className="leading-relaxed text-ck-text-muted">
          La declaración y reasignación se gestionan en FotoRank durante la evaluación. En Clickatón
          no se informan conflictos desde esta pantalla.
        </p>
        <p className="text-xs text-ck-text-muted">
          Revisión legal pendiente sobre definición y consecuencias exactas (
          {CONFLICT_OF_INTEREST_COPY.action}).
        </p>
      </Card>

      <ColaDeRevision
        editionId={editionId}
        filas={pendientes}
        totalPendientes={dash.totals.pendingReview}
      />

      <Card variant="outlined" className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold text-ck-text">Decisiones recientes</h2>
          <p className="mt-2 text-sm text-ck-text-muted">
            Resumen operativo. Los IDs quedan en información técnica de cada fila.
          </p>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-ck-text-muted">
            Todavía no hay evaluaciones. Aparecerán cuando se evalúe el lote.
          </p>
        ) : (
          <ul className="space-y-4">
            {recent.map((d) => {
              const admission = presentAdmissionStatus(d.status);
              const blocking = parseReasonCodes(d.blockingReasons);
              const warnings = parseReasonCodes(d.warningReasons);
              const manual = parseReasonCodes(d.manualReviewReasons);
              const primaryReasonCode = blocking[0] ?? manual[0] ?? warnings[0];
              const primaryReason = primaryReasonCode
                ? presentAdmissionReasonCode(primaryReasonCode)
                : null;

              const senal = senalDeDecision(d.status);

              return (
                <li
                  key={d.id}
                  className="space-y-3 rounded-[var(--ck-radius-card)] border border-ck-border px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <MiniaturaDeEnvio
                        submissionId={d.submissionId}
                        alt="Vista previa de la obra evaluada"
                        className="h-20 w-20 shrink-0 object-cover"
                        abreEnPestana
                      />
                      <div className="space-y-1">
                        <p className="flex items-center gap-2 text-sm font-semibold text-ck-text">
                          <span aria-hidden="true" className={SENAL[senal].clase}>
                            {SENAL[senal].simbolo}
                          </span>
                          {admission.label}
                        </p>
                        <p className="text-xs text-ck-text-muted">
                          Evaluada: {formatSubmissionDateTime(d.evaluatedAt)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={admissionToneToBadgeVariant(admission.tone)}>
                      {admission.label}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-ck-text-secondary">
                    {admission.description}
                  </p>
                  {primaryReason ? (
                    <div className="rounded-[var(--ck-radius-sm)] bg-ck-surface-strong px-3 py-3 text-sm">
                      <p className="font-medium text-ck-text">{primaryReason.title}</p>
                      <p className="mt-1 text-ck-text-secondary">
                        {primaryReason.adminExplanation}
                      </p>
                    </div>
                  ) : null}
                  {d.publicRejectionReason ? (
                    <p className="text-sm text-ck-text-muted">
                      Lo que puede ver el participante: {d.publicRejectionReason}
                    </p>
                  ) : null}
                  <p className="text-sm text-ck-text-secondary">
                    FotoRank:{" "}
                    {d.fotorankEntryId
                      ? "Hay vínculo con FotoRank"
                      : "Sin vínculo con FotoRank"}
                  </p>
                  <AdminTechnicalInfo
                    title="Información técnica de la decisión"
                    rows={[
                      {
                        label: "ID de decisión",
                        value: d.id,
                        mono: true,
                        copyText: d.id,
                      },
                      {
                        label: "ID de entrega",
                        value: d.submissionId,
                        mono: true,
                        copyText: d.submissionId,
                      },
                      {
                        label: "Estado interno",
                        value: d.status,
                        mono: true,
                      },
                      {
                        label: "Elegible",
                        value: d.eligible ? "true" : "false",
                        mono: true,
                      },
                      {
                        label: "Motivos bloqueantes",
                        value: blocking.length ? blocking.join(", ") : "—",
                        mono: true,
                      },
                      {
                        label: "Advertencias",
                        value: warnings.length ? warnings.join(", ") : "—",
                        mono: true,
                      },
                      {
                        label: "Motivos de revisión",
                        value: manual.length ? manual.join(", ") : "—",
                        mono: true,
                      },
                      {
                        label: "ID FotoRank",
                        value: d.fotorankEntryId ?? "—",
                        mono: true,
                      },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
