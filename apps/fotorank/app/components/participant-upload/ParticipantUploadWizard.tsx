"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  canStartUpload,
  EMPTY_WORK_DATA,
  formatBytes,
  formatDimensions,
  mapEntryToUploadFileStatus,
  presentUploadFileStatus,
  translateUploadError,
  validateFileClient,
  type UploadRequirementsSummary,
  type UploadWizardStepId,
  type WorkDataForm,
} from "../../lib/fotorank/participant-upload";
import { formatParticipantDate } from "../../lib/fotorank/participant-experience/dates";
import { UploadConfirmModal } from "./UploadConfirmModal";
import { UploadStepper } from "./UploadStepper";

type EntryView = {
  id: string;
  status: string;
  entryNumber: string | null;
  technicalSummaryStatus: string;
  manualReviewStatus?: string | null;
  admissionStatus?: string | null;
  admissionPublic?: {
    publicLabel: string;
    publicMessage: string;
    replacementAllowed: boolean;
    evidenceRequested: boolean;
    evidencePublicMessage: string | null;
    evidenceDeadlineAt: string | null;
    admitted: boolean;
    rejected: boolean;
    frozen: boolean;
  } | null;
  publicRejectionReason?: string | null;
  previewUrl: string | null;
  checks: Array<{ checkCode: string; status: string; title: string; message: string }>;
};

export type ParticipantUploadWizardProps = {
  contestId: string;
  contestSlug: string;
  registrationId: string;
  registrationNumber: string;
  registrationStatus: string;
  requirements: UploadRequirementsSummary;
  detailHref: string;
  participacionesHref?: string;
  /** Fixture: no llama APIs reales. */
  mode?: "live" | "fixture";
  /** Escenario inicial del fixture. */
  fixtureScenario?:
    | "requirements"
    | "photo-valid"
    | "photo-invalid"
    | "data"
    | "review"
    | "confirmation"
    | "correction"
    | "error";
};

type SelectedFileMeta = {
  name: string;
  sizeBytes: number;
  width: number;
  height: number;
  mimeType: string;
};

export function ParticipantUploadWizard({
  contestId,
  contestSlug,
  registrationId,
  registrationNumber,
  registrationStatus,
  requirements,
  detailHref,
  participacionesHref = "/participaciones",
  mode = "live",
  fixtureScenario = "requirements",
}: ParticipantUploadWizardProps) {
  const isFixture = mode === "fixture";
  const fileErrorId = useId();
  const [step, setStep] = useState<UploadWizardStepId>("requirements");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [entry, setEntry] = useState<EntryView | null>(null);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "processing" | "done">(
    "idle",
  );
  const [workData, setWorkData] = useState<WorkDataForm>(EMPTY_WORK_DATA);
  const [file, setFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<SelectedFileMeta | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const startGate = canStartUpload({
    registrationStatus,
    uploadWindow: requirements.uploadWindow,
    uploadedCount: entry ? 1 : 0,
    maxFiles: requirements.maxFiles,
    admissionStatus: entry?.admissionStatus,
    frozen: entry?.admissionPublic?.frozen,
  });

  const replacementAllowed =
    Boolean(entry?.admissionPublic?.replacementAllowed) ||
    entry?.manualReviewStatus === "REPLACEMENT_REQUESTED" ||
    (Boolean(entry) &&
      entry?.status !== "CONFIRMED" &&
      requirements.allowReplace &&
      requirements.uploadWindow.isOpen);

  const fileStatus = mapEntryToUploadFileStatus({
    entryStatus: entry?.status,
    technicalSummaryStatus: entry?.technicalSummaryStatus,
    manualReviewStatus: entry?.manualReviewStatus,
    admissionStatus: entry?.admissionStatus,
    uploadPhase,
  });
  const fileStatusUi = presentUploadFileStatus(
    fileMeta && !entry && uploadPhase === "idle" ? "selected" : fileStatus,
  );

  const revokePreview = useCallback(() => {
    setPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(() => () => revokePreview(), [revokePreview]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (isFixture) {
      applyFixtureScenario(fixtureScenario);
      return;
    }
    // Sin obra es 404 esperado en /entries/me; solo consultamos si la ventana permite operar.
    if (!requirements.uploadWindow.isOpen) return;
    void refreshEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId, isFixture, fixtureScenario, requirements.uploadWindow.isOpen]);

  useEffect(() => {
    if (!dirty || isFixture) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, isFixture]);

  function applyFixtureScenario(scenario: NonNullable<ParticipantUploadWizardProps["fixtureScenario"]>) {
    setError(null);
    setInfo(null);
    setEntry(null);
    setFile(null);
    setFileMeta(null);
    revokePreview();
    setWorkData({
      ...EMPTY_WORK_DATA,
      title: "Fixture — amanecer en el río",
      captureLocality: "Rosario",
      territoryConfirmed: true,
      captureWithinPeriod: true,
      declaredDeviceKind: "MIRRORLESS",
      authorshipDeclared: true,
      editingPolicyDeclared: true,
      noGenerativeAiDeclared: true,
      instagramHandle: "@fixture_demo",
    });

    if (scenario === "requirements") {
      setStep("requirements");
      return;
    }
    if (scenario === "photo-invalid") {
      setStep("photo");
      setError("El archivo supera el peso permitido.");
      return;
    }
    if (scenario === "photo-valid" || scenario === "data" || scenario === "review" || scenario === "confirmation") {
      setFileMeta({
        name: "fixture-obra.jpg",
        sizeBytes: 2_400_000,
        width: 4000,
        height: 3000,
        mimeType: "image/jpeg",
      });
      setStep(
        scenario === "photo-valid"
          ? "photo"
          : scenario === "data"
            ? "data"
            : scenario === "review"
              ? "review"
              : "confirmation",
      );
      if (scenario === "confirmation") {
        setEntry({
          id: "fixture-entry",
          status: "CONFIRMED",
          entryNumber: "FIX-001",
          technicalSummaryStatus: "APPROVED",
          previewUrl: null,
          checks: [],
        });
        setInfo("Envío recibido. Enviar no implica admisión.");
      }
      return;
    }
    if (scenario === "correction") {
      setStep("photo");
      setEntry({
        id: "fixture-entry",
        status: "REQUIRES_REVIEW",
        entryNumber: null,
        technicalSummaryStatus: "REQUIRES_REVIEW",
        manualReviewStatus: "REPLACEMENT_REQUESTED",
        admissionPublic: {
          publicLabel: "Reemplazo habilitado",
          publicMessage: "Podés reemplazar el archivo.",
          replacementAllowed: true,
          evidenceRequested: false,
          evidencePublicMessage: null,
          evidenceDeadlineAt: null,
          admitted: false,
          rejected: false,
          frozen: false,
        },
        publicRejectionReason: "Motivo público de ejemplo: la imagen no cumple el encuadre solicitado.",
        previewUrl: null,
        checks: [],
      });
      return;
    }
    if (scenario === "error") {
      setStep("review");
      setFileMeta({
        name: "fixture-obra.jpg",
        sizeBytes: 2_400_000,
        width: 4000,
        height: 3000,
        mimeType: "image/jpeg",
      });
      setError("Error de red al subir. Conservamos tus datos: reintentá el envío.");
    }
  }

  async function refreshEntry() {
    if (isFixture) return;
    const res = await fetch(`/api/fotorank/contests/${contestId}/entries/me`);
    if (!res.ok) return;
    const data = (await res.json()) as { entry: EntryView | null };
    if (data.entry) setEntry(data.entry);
  }

  function updateWorkData<K extends keyof WorkDataForm>(key: K, value: WorkDataForm[K]) {
    setDirty(true);
    setWorkData((prev) => ({ ...prev, [key]: value }));
  }

  async function onPickFile(next: File | null) {
    setError(null);
    setInfo(null);
    if (!next) return;
    setUploadPhase("idle");
    const result = await validateFileClient(next, requirements.policy);
    if (!result.ok) {
      setFile(null);
      setFileMeta(null);
      revokePreview();
      setError(result.message);
      return;
    }
    setFile(next);
    setFileMeta({
      name: result.name,
      sizeBytes: result.sizeBytes,
      width: result.width,
      height: result.height,
      mimeType: result.mimeType,
    });
    revokePreview();
    setPreviewObjectUrl(URL.createObjectURL(next));
    setDirty(true);
  }

  function validateWorkData(): string | null {
    if (!requirements.requiresSantaFeEligibility) return null;
    if (!workData.territoryConfirmed || !workData.captureLocality.trim()) {
      return "Confirmá territorio y localidad de captura antes de continuar.";
    }
    if (!workData.captureWithinPeriod) {
      return "Confirmá que la fotografía fue tomada en el período oficial.";
    }
    if (workData.declaredDeviceKind === "UNKNOWN") {
      return "Indicá el tipo de dispositivo utilizado.";
    }
    if (requirements.categorySlug.includes("profesional") && workData.declaredDeviceKind === "SMARTPHONE") {
      return "Esta categoría no admite fotografías tomadas con teléfono celular.";
    }
    if (
      !workData.authorshipDeclared ||
      !workData.editingPolicyDeclared ||
      !workData.noGenerativeAiDeclared
    ) {
      return "Confirmá las declaraciones obligatorias.";
    }
    if (workData.declaredDeviceKind === "DRONE" && !workData.droneAck) {
      return "Confirmá el cumplimiento normativo de la operación con dron.";
    }
    return null;
  }

  function goNext() {
    setError(null);
    if (step === "requirements") {
      if (!startGate.allowed && !replacementAllowed) {
        setError(startGate.reason);
        return;
      }
      setStep("photo");
      return;
    }
    if (step === "photo") {
      if (!fileMeta && !entry?.previewUrl) {
        setError("Seleccioná una fotografía válida para continuar.");
        return;
      }
      setStep("data");
      return;
    }
    if (step === "data") {
      const msg = validateWorkData();
      if (msg) {
        setError(msg);
        return;
      }
      setStep("review");
    }
  }

  function goBack() {
    setError(null);
    if (step === "photo") setStep("requirements");
    else if (step === "data") setStep("photo");
    else if (step === "review") setStep("data");
  }

  async function performUploadAndConfirm() {
    setError(null);
    setInfo(null);

    if (isFixture) {
      setUploadPhase("uploading");
      await new Promise((r) => setTimeout(r, 400));
      setUploadPhase("processing");
      await new Promise((r) => setTimeout(r, 400));
      setEntry({
        id: "fixture-entry",
        status: "CONFIRMED",
        entryNumber: "FIX-001",
        technicalSummaryStatus: "APPROVED",
        previewUrl: previewObjectUrl,
        checks: [],
      });
      setUploadPhase("done");
      setDirty(false);
      setStep("confirmation");
      setInfo("Envío recibido. Enviar no implica admisión ni aprobación.");
      return;
    }

    if (!file) {
      // Solo confirmar si ya hay entry lista
      if (entry && (entry.status === "READY_TO_CONFIRM" || entry.status === "REQUIRES_REVIEW")) {
        await confirmEntry(entry.status === "REQUIRES_REVIEW");
        return;
      }
      setError("Seleccioná una fotografía para enviar.");
      return;
    }

    setUploadPhase("uploading");
    startTransition(async () => {
      try {
        const intentRes = await fetch(`/api/fotorank/contests/${contestId}/entries/upload-intent`, {
          method: "POST",
        });
        const intent = (await intentRes.json()) as {
          ok?: boolean;
          entryId?: string;
          uploadUrl?: string;
          error?: { code?: string; message?: string };
        };
        if (!intentRes.ok || !intent.entryId || !intent.uploadUrl) {
          setError(translateUploadError(intent.error?.code, intent.error?.message));
          setUploadPhase("idle");
          return;
        }

        setUploadPhase("processing");
        setInfo("Estamos verificando el archivo.");
        const replace = Boolean(entry && entry.status !== "DRAFT");
        const fd = new FormData();
        fd.set("file", file);
        if (replace) fd.set("replace", "1");
        if (requirements.requiresSantaFeEligibility) {
          fd.set("captureLocality", workData.captureLocality.trim());
          if (workData.captureDepartment.trim()) {
            fd.set("captureDepartment", workData.captureDepartment.trim());
          }
          fd.set("territoryConfirmedSantaFe", workData.territoryConfirmed ? "1" : "0");
          fd.set("declaredDeviceKind", workData.declaredDeviceKind);
          if (workData.declaredDeviceMake.trim()) {
            fd.set("declaredDeviceMake", workData.declaredDeviceMake.trim());
          }
          if (workData.declaredDeviceModel.trim()) {
            fd.set("declaredDeviceModel", workData.declaredDeviceModel.trim());
          }
          fd.set("captureWithinPeriodDeclared", workData.captureWithinPeriod ? "1" : "0");
          fd.set("authorshipDeclared", workData.authorshipDeclared ? "1" : "0");
          fd.set("editingPolicyDeclared", workData.editingPolicyDeclared ? "1" : "0");
          fd.set("noGenerativeAiDeclared", workData.noGenerativeAiDeclared ? "1" : "0");
          if (workData.instagramHandle.trim()) {
            fd.set("instagramHandle", workData.instagramHandle.trim());
          }
          if (workData.droneAck) fd.set("droneRegulationAcknowledged", "1");
        }

        const upRes = await fetch(
          replace
            ? `/api/fotorank/contests/${contestId}/entries/${intent.entryId}/replace`
            : intent.uploadUrl,
          { method: "POST", body: fd },
        );
        const up = (await upRes.json()) as {
          ok?: boolean;
          error?: { code?: string; message?: string };
          technicalSummaryStatus?: string;
        };
        if (!upRes.ok || !up.ok) {
          setError(translateUploadError(up.error?.code, up.error?.message));
          setUploadPhase("idle");
          return;
        }

        await refreshEntry();
        // Re-fetch entry id for confirm
        const meRes = await fetch(`/api/fotorank/contests/${contestId}/entries/me`);
        const me = (await meRes.json()) as { entry: EntryView | null };
        const current = me.entry;
        setEntry(current);
        if (
          current &&
          (current.status === "READY_TO_CONFIRM" || current.status === "REQUIRES_REVIEW")
        ) {
          await confirmEntry(current.status === "REQUIRES_REVIEW", current.id);
        } else if (current?.status === "CONFIRMED") {
          setUploadPhase("done");
          setDirty(false);
          setStep("confirmation");
          setInfo("Envío recibido. Enviar no implica admisión ni aprobación.");
        } else {
          setUploadPhase("done");
          setInfo("Archivo recibido. Revisá el estado técnico antes de confirmar.");
        }
      } catch {
        setError("Error de red al subir. Conservamos tus datos: reintentá el envío.");
        setUploadPhase("idle");
      }
    });
  }

  async function confirmEntry(acknowledgeWarnings: boolean, entryId?: string) {
    const id = entryId ?? entry?.id;
    if (!id || isFixture) return;
    const res = await fetch(`/api/fotorank/contests/${contestId}/entries/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledgeWarnings }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      entryNumber?: string;
      error?: { code?: string; message?: string };
      message?: string;
    };
    if (!res.ok || !data.ok) {
      setError(translateUploadError(data.error?.code, data.error?.message));
      setUploadPhase("idle");
      return;
    }
    await refreshEntry();
    setUploadPhase("done");
    setDirty(false);
    setStep("confirmation");
    setInfo(
      data.message ??
        "Envío recibido. Enviar no implica admisión ni aprobación del concurso.",
    );
  }

  const openLabel = formatParticipantDate(requirements.uploadWindow.opensAt, {
    includeTime: true,
  });

  const previewSrc = previewObjectUrl ?? entry?.previewUrl ?? null;

  const accept = useMemo(
    () =>
      [
        ...requirements.policy.allowedMimeTypes,
        ...requirements.policy.allowedExtensions.map((e) => `.${e}`),
      ].join(","),
    [requirements.policy],
  );

  if (!requirements.uploadWindow.isOpen && !isFixture && !replacementAllowed) {
    return (
      <section className="fr-upload-wizard" data-testid="participant-upload-wizard">
        <div className="fr-upload-wizard__closed" data-testid="upload-closed-notice">
          <h2 className="fr-upload-wizard__title">Carga no habilitada</h2>
          <p className="fr-upload-wizard__lead">
            Tu inscripción está confirmada. La carga de fotografías todavía no está habilitada.
            Podés revisar tus datos; cuando abra la ventana de carga vas a poder continuar desde acá.
          </p>
          <dl className="fr-upload-wizard__facts">
            <div>
              <dt>Máximo de obras</dt>
              <dd>
                {requirements.maxFiles === 1
                  ? "1 fotografía"
                  : `${requirements.maxFiles} fotografías`}
              </dd>
            </div>
            {openLabel ? (
              <div>
                <dt>Apertura prevista</dt>
                <dd>{openLabel}</dd>
              </div>
            ) : null}
          </dl>
          <div className="fr-upload-wizard__actions">
            <Link href={detailHref} className="fr-public-btn fr-public-btn--primary">
              Volver al detalle
            </Link>
            <Link href={requirements.basesHref} className="fr-public-btn fr-public-btn--secondary">
              Consultar bases
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="fr-upload-wizard" data-testid="entry-upload-panel">
      {isFixture ? (
        <p className="fr-upload-wizard__fixture-banner" role="status">
          FIXTURE DE VALIDACIÓN VISUAL — no es carga real ni contenido del concurso. No publicar.
        </p>
      ) : null}

      <header className="fr-upload-wizard__header">
        <p className="fr-public-eyebrow">Carga de fotografía</p>
        <h2 className="fr-upload-wizard__title">Participación guiada</h2>
        <p className="fr-upload-wizard__lead">
          {requirements.categoryName} · {registrationNumber}
        </p>
        <UploadStepper current={step} />
      </header>

      {entry?.admissionPublic?.replacementAllowed ||
      entry?.manualReviewStatus === "REPLACEMENT_REQUESTED" ? (
        <div className="fr-upload-wizard__alert fr-upload-wizard__alert--warning" role="status">
          <p className="font-semibold">Requiere corrección</p>
          <p>{entry.publicRejectionReason || entry.admissionPublic?.publicMessage}</p>
        </div>
      ) : null}

      {error ? (
        <p
          ref={errorRef}
          id={fileErrorId}
          className="fr-upload-wizard__error"
          role="alert"
          tabIndex={-1}
        >
          {error}
        </p>
      ) : null}
      {info && step !== "confirmation" ? (
        <p className="fr-upload-wizard__info" role="status">
          {info}
        </p>
      ) : null}

      {step === "requirements" ? (
        <div className="fr-upload-wizard__panel" data-testid="upload-step-requirements">
          <h3 className="fr-upload-wizard__panel-title">Requisitos de carga</h3>
          <ul className="fr-upload-wizard__badge-row">
            <li className="fr-contest-info-badge fr-contest-info-badge--limit">
              Máx. {requirements.maxFiles === 1 ? "1 fotografía" : `${requirements.maxFiles} fotografías`}
            </li>
            <li className="fr-contest-info-badge fr-contest-info-badge--device">
              {requirements.formatsLabel}
            </li>
            <li className="fr-contest-info-badge fr-contest-info-badge--modality">
              Hasta {requirements.maxSizeLabel}
            </li>
            <li className="fr-contest-info-badge fr-contest-info-badge--docs">
              Mín. {requirements.minDimensionsLabel}
            </li>
            {requirements.specialBadges.map((b) => (
              <li key={b} className="fr-contest-info-badge fr-contest-info-badge--special">
                {b}
              </li>
            ))}
          </ul>
          <dl className="fr-upload-wizard__facts">
            <div>
              <dt>Categoría</dt>
              <dd>{requirements.categoryName}</dd>
            </div>
            <div>
              <dt>Resolución mínima</dt>
              <dd>{requirements.minMegapixelsLabel}</dd>
            </div>
            <div>
              <dt>Dimensiones máximas</dt>
              <dd>{requirements.maxDimensionsLabel}</dd>
            </div>
            <div>
              <dt>Reemplazo</dt>
              <dd>
                {requirements.allowReplace
                  ? "Permitido hasta el cierre de carga, según bases"
                  : "No permitido tras el envío"}
              </dd>
            </div>
            {requirements.capturePeriodLabel ? (
              <div>
                <dt>Período de captura</dt>
                <dd>{requirements.capturePeriodLabel}</dd>
              </div>
            ) : null}
            {requirements.uploadWindow.closesAt ? (
              <div>
                <dt>Cierre de carga</dt>
                <dd>
                  {formatParticipantDate(requirements.uploadWindow.closesAt, { includeTime: true })}
                </dd>
              </div>
            ) : null}
          </dl>
          {requirements.requirementNotes.map((n) => (
            <p key={n} className="fr-upload-wizard__note">
              {n}
            </p>
          ))}
          <p className="fr-upload-wizard__note">
            El GPS no es obligatorio y nunca se publica. El original se guarda de forma privada.
          </p>
          <div className="fr-upload-wizard__actions">
            <button
              type="button"
              className="fr-public-btn fr-public-btn--primary"
              data-testid="upload-start"
              disabled={!startGate.allowed && !replacementAllowed}
              onClick={goNext}
            >
              Comenzar carga
            </button>
            <Link href={requirements.basesHref} className="fr-public-btn fr-public-btn--secondary">
              Consultar bases
            </Link>
          </div>
        </div>
      ) : null}

      {step === "photo" ? (
        <div className="fr-upload-wizard__panel" data-testid="upload-step-photo">
          <h3 className="fr-upload-wizard__panel-title">Seleccioná tu fotografía</h3>
          <p className="fr-upload-wizard__lead">
            {requirements.formatsLabel} · hasta {requirements.maxSizeLabel} · mín.{" "}
            {requirements.minDimensionsLabel}
          </p>

          <div className="fr-upload-dropzone">
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="sr-only"
              data-testid="entry-file-input"
              aria-describedby={error ? fileErrorId : undefined}
              disabled={pending || uploadPhase === "uploading" || uploadPhase === "processing"}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                void onPickFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="fr-public-btn fr-public-btn--secondary fr-upload-dropzone__btn"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {fileMeta || entry?.previewUrl ? "Cambiar fotografía" : "Elegir archivo"}
            </button>
            <p className="fr-upload-dropzone__hint">
              Una fotografía por slot. La selección no envía la obra.
            </p>
          </div>

          {(previewSrc || fileMeta) && (
            <div className="fr-upload-preview" data-testid="entry-preview-wrap">
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewSrc}
                  alt="Vista previa de la fotografía seleccionada"
                  className="fr-upload-preview__img"
                  data-testid="entry-preview"
                />
              ) : (
                <div className="fr-upload-preview__placeholder">Preview disponible tras seleccionar</div>
              )}
              {fileMeta ? (
                <dl className="fr-upload-preview__meta">
                  <div>
                    <dt>Archivo</dt>
                    <dd>{fileMeta.name}</dd>
                  </div>
                  <div>
                    <dt>Peso</dt>
                    <dd>{formatBytes(fileMeta.sizeBytes)}</dd>
                  </div>
                  <div>
                    <dt>Dimensiones</dt>
                    <dd>{formatDimensions(fileMeta.width, fileMeta.height)}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{fileStatusUi.label}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          )}

          <div className="fr-upload-wizard__actions">
            <button type="button" className="fr-public-btn fr-public-btn--secondary" onClick={goBack}>
              Atrás
            </button>
            <button
              type="button"
              className="fr-public-btn fr-public-btn--primary"
              data-testid="upload-photo-next"
              onClick={goNext}
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {step === "data" ? (
        <div className="fr-upload-wizard__panel" data-testid="upload-step-data">
          <h3 className="fr-upload-wizard__panel-title">Datos de la obra</h3>
          <p className="fr-upload-wizard__lead">
            Completá la información requerida para tu categoría. El número ARGRA no se vuelve a pedir ni se
            publica aquí.
          </p>

          <div className="fr-upload-form">
            <label className="fr-upload-field">
              <span>Título (opcional — aún no se guarda en el servidor)</span>
              <input
                value={workData.title}
                onChange={(e) => updateWorkData("title", e.target.value)}
                className="fr-upload-input"
                data-testid="entry-title"
              />
            </label>

            {requirements.requiresSantaFeEligibility ? (
              <>
                <label className="fr-upload-field">
                  <span>Instagram</span>
                  <input
                    value={workData.instagramHandle}
                    onChange={(e) => updateWorkData("instagramHandle", e.target.value)}
                    className="fr-upload-input"
                    placeholder="@tu_usuario"
                    data-testid="entry-instagram"
                  />
                </label>
                <label className="fr-upload-field">
                  <span>Localidad o paraje de captura</span>
                  <input
                    value={workData.captureLocality}
                    onChange={(e) => updateWorkData("captureLocality", e.target.value)}
                    className="fr-upload-input"
                    data-testid="entry-capture-locality"
                    required
                  />
                </label>
                <label className="fr-upload-field">
                  <span>Departamento (opcional)</span>
                  <input
                    value={workData.captureDepartment}
                    onChange={(e) => updateWorkData("captureDepartment", e.target.value)}
                    className="fr-upload-input"
                    data-testid="entry-capture-department"
                  />
                </label>
                <label className="fr-upload-check">
                  <input
                    type="checkbox"
                    checked={workData.territoryConfirmed}
                    onChange={(e) => updateWorkData("territoryConfirmed", e.target.checked)}
                    data-testid="entry-territory-confirm"
                  />
                  <span>La fotografía fue tomada dentro de la Provincia de Santa Fe.</span>
                </label>
                <label className="fr-upload-check">
                  <input
                    type="checkbox"
                    checked={workData.captureWithinPeriod}
                    onChange={(e) => updateWorkData("captureWithinPeriod", e.target.checked)}
                    data-testid="entry-period-confirm"
                  />
                  <span>Declaro que la fotografía fue tomada durante el período oficial del concurso.</span>
                </label>
                <label className="fr-upload-field">
                  <span>Dispositivo utilizado</span>
                  <select
                    className="fr-upload-input"
                    value={workData.declaredDeviceKind}
                    onChange={(e) => updateWorkData("declaredDeviceKind", e.target.value)}
                    data-testid="entry-device-kind"
                  >
                    <option value="UNKNOWN">Seleccioná…</option>
                    <option value="SMARTPHONE">Teléfono celular</option>
                    <option value="DSLR">Cámara DSLR</option>
                    <option value="MIRRORLESS">Cámara mirrorless</option>
                    <option value="COMPACT_CAMERA">Cámara compacta</option>
                    <option value="BRIDGE_CAMERA">Cámara bridge</option>
                    <option value="OTHER_CAMERA">Otra cámara</option>
                    <option value="DRONE">Dron</option>
                  </select>
                </label>
                <div className="fr-upload-form__row">
                  <label className="fr-upload-field">
                    <span>Marca (si falta en EXIF)</span>
                    <input
                      className="fr-upload-input"
                      value={workData.declaredDeviceMake}
                      onChange={(e) => updateWorkData("declaredDeviceMake", e.target.value)}
                      data-testid="entry-device-make"
                    />
                  </label>
                  <label className="fr-upload-field">
                    <span>Modelo (si falta en EXIF)</span>
                    <input
                      className="fr-upload-input"
                      value={workData.declaredDeviceModel}
                      onChange={(e) => updateWorkData("declaredDeviceModel", e.target.value)}
                      data-testid="entry-device-model"
                    />
                  </label>
                </div>
                {workData.declaredDeviceKind === "DRONE" ? (
                  <label className="fr-upload-check">
                    <input
                      type="checkbox"
                      checked={workData.droneAck}
                      onChange={(e) => updateWorkData("droneAck", e.target.checked)}
                      data-testid="entry-drone-ack"
                    />
                    <span>
                      Declaro haber cumplido la normativa aplicable a la operación del dron. No implica
                      verificación automática.
                    </span>
                  </label>
                ) : null}
                <fieldset className="fr-upload-fieldset">
                  <legend>Declaraciones</legend>
                  <label className="fr-upload-check">
                    <input
                      type="checkbox"
                      checked={workData.authorshipDeclared}
                      onChange={(e) => updateWorkData("authorshipDeclared", e.target.checked)}
                      data-testid="entry-authorship-declare"
                    />
                    <span>
                      Declaro ser el autor de la fotografía y contar con las autorizaciones de imagen
                      necesarias.
                    </span>
                  </label>
                  <label className="fr-upload-check">
                    <input
                      type="checkbox"
                      checked={workData.editingPolicyDeclared}
                      onChange={(e) => updateWorkData("editingPolicyDeclared", e.target.checked)}
                      data-testid="entry-editing-declare"
                    />
                    <span>
                      Declaro que, de existir edición, se limita a revelado fotográfico básico sin
                      fotomontaje ni alteración sustancial.
                    </span>
                  </label>
                  <label className="fr-upload-check">
                    <input
                      type="checkbox"
                      checked={workData.noGenerativeAiDeclared}
                      onChange={(e) => updateWorkData("noGenerativeAiDeclared", e.target.checked)}
                      data-testid="entry-no-ai-declare"
                    />
                    <span>
                      Declaro que la fotografía no fue generada ni alterada con inteligencia artificial
                      generativa.
                    </span>
                  </label>
                </fieldset>
              </>
            ) : (
              <p className="fr-upload-wizard__note">
                Este concurso no requiere declaraciones adicionales en la carga.
              </p>
            )}
          </div>

          <p className="fr-upload-wizard__note">
            No hay autoguardado en servidor sin archivo. Los datos se conservan en esta sesión hasta enviar o
            abandonar.
          </p>

          <div className="fr-upload-wizard__actions">
            <button type="button" className="fr-public-btn fr-public-btn--secondary" onClick={goBack}>
              Atrás
            </button>
            <button
              type="button"
              className="fr-public-btn fr-public-btn--primary"
              data-testid="upload-data-next"
              onClick={goNext}
            >
              Revisar
            </button>
          </div>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="fr-upload-wizard__panel" data-testid="upload-step-review">
          <h3 className="fr-upload-wizard__panel-title">Revisión antes de enviar</h3>
          <div className="fr-upload-review">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt="" className="fr-upload-preview__img" aria-hidden />
            ) : null}
            <dl className="fr-upload-wizard__facts">
              <div>
                <dt>Categoría</dt>
                <dd>{requirements.categoryName}</dd>
              </div>
              <div>
                <dt>Archivo</dt>
                <dd>{fileMeta?.name ?? "Archivo en servidor"}</dd>
              </div>
              {fileMeta ? (
                <div>
                  <dt>Dimensiones / peso</dt>
                  <dd>
                    {formatDimensions(fileMeta.width, fileMeta.height)} ·{" "}
                    {formatBytes(fileMeta.sizeBytes)}
                  </dd>
                </div>
              ) : null}
              {workData.title ? (
                <div>
                  <dt>Título</dt>
                  <dd>{workData.title}</dd>
                </div>
              ) : null}
              {workData.captureLocality ? (
                <div>
                  <dt>Lugar</dt>
                  <dd>{workData.captureLocality}</dd>
                </div>
              ) : null}
              <div>
                <dt>Dispositivo</dt>
                <dd>{workData.declaredDeviceKind}</dd>
              </div>
              <div>
                <dt>Declaraciones</dt>
                <dd>
                  {workData.authorshipDeclared &&
                  workData.editingPolicyDeclared &&
                  workData.noGenerativeAiDeclared
                    ? "Confirmadas"
                    : "Incompletas"}
                </dd>
              </div>
            </dl>
          </div>
          <p className="fr-upload-wizard__note">
            Al enviar, la obra queda registrada. Según las bases y el estado de admisión, podría no poder
            modificarse después. Enviar no implica admisión.
          </p>
          <div className="fr-upload-wizard__actions fr-upload-wizard__actions--split">
            <button type="button" className="fr-public-btn fr-public-btn--secondary" onClick={goBack}>
              Editar datos
            </button>
            <button
              type="button"
              className="fr-public-btn fr-public-btn--secondary"
              onClick={() => setStep("photo")}
            >
              Cambiar fotografía
            </button>
            <button
              type="button"
              className="fr-public-btn fr-public-btn--primary"
              data-testid="entry-confirm"
              disabled={pending || uploadPhase === "uploading" || uploadPhase === "processing"}
              onClick={() => setConfirmOpen(true)}
            >
              Enviar participación
            </button>
          </div>
          {(uploadPhase === "uploading" || uploadPhase === "processing") && (
            <p className="text-gold" data-testid="entry-processing" aria-live="polite">
              {uploadPhase === "uploading" ? "Subiendo…" : "Estamos verificando el archivo…"}
            </p>
          )}
        </div>
      ) : null}

      {step === "confirmation" ? (
        <div className="fr-upload-wizard__panel" data-testid="upload-step-confirmation">
          <h3 className="fr-upload-wizard__panel-title">Envío recibido</h3>
          <p className="fr-upload-wizard__lead">
            {info ?? "Tu fotografía fue enviada. Enviar no implica admisión ni aprobación."}
          </p>
          <dl className="fr-upload-wizard__facts">
            <div>
              <dt>Número de participación</dt>
              <dd className="text-gold font-semibold">{registrationNumber}</dd>
            </div>
            <div>
              <dt>Categoría</dt>
              <dd>{requirements.categoryName}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{presentUploadFileStatus("submitted").label}</dd>
            </div>
            {entry?.entryNumber ? (
              <div>
                <dt>Número de obra</dt>
                <dd>{entry.entryNumber}</dd>
              </div>
            ) : null}
          </dl>
          <div className="fr-upload-wizard__actions">
            <Link href={detailHref} className="fr-public-btn fr-public-btn--primary">
              Ver detalle
            </Link>
            <Link href={participacionesHref} className="fr-public-btn fr-public-btn--secondary">
              Mis participaciones
            </Link>
          </div>
        </div>
      ) : null}

      <UploadConfirmModal
        open={confirmOpen}
        title="¿Enviar la participación?"
        message="Vas a enviar la fotografía de forma definitiva. Enviar no implica que la obra quede admitida. Si el concurso congela obras, podría no permitir cambios posteriores."
        confirmLabel="Confirmar envío"
        busy={pending || uploadPhase === "uploading" || uploadPhase === "processing"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void performUploadAndConfirm();
        }}
      />

      {/* silence unused */}
      <span className="sr-only">{contestSlug} {registrationId}</span>
    </section>
  );
}
