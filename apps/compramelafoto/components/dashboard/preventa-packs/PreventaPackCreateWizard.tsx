"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppModal from "@/components/ui/AppModal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import FilePickerButton from "@/components/ui/FilePickerButton";
import { clientTotalArsFromPhotographerBaseArs } from "@/lib/preventa-canjeable/pack-client-price";
import { PACK_EMPTY_ACTIVATION_MESSAGE } from "@/lib/preventa-canjeable/pack-activation";
import PreventaPackBenefitsEditor from "./PreventaPackBenefitsEditor";
import PreventaPackCatalogImportStep, {
  type PreventaPackCatalogImportStepHandle,
} from "./PreventaPackCatalogImportStep";
import PreventaPackCompositionSummary from "./PreventaPackCompositionSummary";
import { preventaSelectClassName } from "./preventa-form-controls";
import type { BenefitRow, PackRow } from "./types";

type WizardStep = "method" | "details" | "benefits" | "review";
type CreateMethod = "catalog" | "manual";

const STEP_LABELS: Record<WizardStep, string> = {
  method: "Cómo crear",
  details: "Datos del pack",
  benefits: "Productos incluidos",
  review: "Revisar y activar",
};

function phaseLabel(phase: "PRE_UPLOAD" | "POST_UPLOAD" | null | undefined): string {
  return phase === "POST_UPLOAD" ? "Después de subir fotos" : "Antes de subir fotos";
}

export default function PreventaPackCreateWizard({
  albumId,
  platformFeePercent,
  albumPublicSlug,
  onClose,
  onComplete,
  onError,
}: {
  albumId: number;
  platformFeePercent: number;
  albumPublicSlug?: string | null;
  onClose: () => void;
  onComplete: () => void;
  onError: (message: string | null) => void;
}) {
  const [step, setStep] = useState<WizardStep>("method");
  const [method, setMethod] = useState<CreateMethod | null>(null);
  const [pack, setPack] = useState<PackRow | null>(null);
  const [benefits, setBenefits] = useState<BenefitRow[]>([]);
  const [benefitsLoading, setBenefitsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [activateOnFinish, setActivateOnFinish] = useState(false);

  const catalogRef = useRef<PreventaPackCatalogImportStepHandle>(null);
  const [catalogState, setCatalogState] = useState({ canSubmit: false, busy: false });

  const [availabilityPhase, setAvailabilityPhase] = useState<"PRE_UPLOAD" | "POST_UPLOAD">(
    "PRE_UPLOAD"
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceClientArs, setPriceClientArs] = useState("0");
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);

  const coverPreviewUrl = useMemo(() => {
    if (!pendingCoverFile) return null;
    return URL.createObjectURL(pendingCoverFile);
  }, [pendingCoverFile]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  const reloadBenefits = useCallback(async () => {
    if (!pack) {
      setBenefits([]);
      return;
    }
    setBenefitsLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/albums/${albumId}/preventa-packs/${pack.id}/benefits`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      setBenefits(Array.isArray(data?.benefits) ? data.benefits : []);
    } finally {
      setBenefitsLoading(false);
    }
  }, [albumId, pack]);

  const reloadPack = useCallback(async () => {
    if (!pack) return;
    const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-packs`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data?.packs)) {
      const updated = (data.packs as PackRow[]).find((p) => p.id === pack.id);
      if (updated) setPack(updated);
    }
  }, [albumId, pack]);

  useEffect(() => {
    if (step === "review" || step === "benefits") {
      void reloadBenefits();
    }
  }, [step, reloadBenefits]);

  const clientPreviewArs = useMemo(() => {
    const base = Number(pack?.priceClientArs ?? priceClientArs);
    if (!Number.isFinite(base) || base < 0) return null;
    return clientTotalArsFromPhotographerBaseArs(base, platformFeePercent);
  }, [pack?.priceClientArs, priceClientArs, platformFeePercent]);

  const benefitCount = benefits.length;
  const cannotActivate = benefitCount === 0;

  async function createManualPack(): Promise<PackRow | null> {
    const nameTrim = name.trim();
    if (!nameTrim) {
      setLocalError("El nombre es obligatorio.");
      return null;
    }
    const price = Number(priceClientArs);
    if (!Number.isFinite(price) || price < 0) {
      setLocalError("El precio debe ser un número mayor o igual a 0.");
      return null;
    }

    setSaving(true);
    setLocalError(null);
    onError(null);

    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-packs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameTrim,
          description: description.trim() || null,
          priceClientArs: price,
          isActive: false,
          availabilityPhase,
          currency: "ARS",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.detail || "No se pudo crear el pack");
      }
      const packId = Number(data?.pack?.id);
      if (!Number.isInteger(packId)) {
        throw new Error("No se obtuvo el pack creado");
      }

      if (pendingCoverFile) {
        const fd = new FormData();
        fd.append("file", pendingCoverFile);
        const coverRes = await fetch(
          `/api/dashboard/albums/${albumId}/preventa-packs/${packId}/cover`,
          { method: "POST", body: fd }
        );
        const coverData = await coverRes.json().catch(() => ({}));
        if (!coverRes.ok) {
          throw new Error(coverData?.error || "No se pudo subir la imagen");
        }
        return coverData.pack as PackRow;
      }

      return data.pack as PackRow;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al crear";
      setLocalError(msg);
      onError(msg);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleDetailsContinue() {
    if (pack) {
      setStep("benefits");
      return;
    }
    if (method === "catalog") {
      const created = await catalogRef.current?.submit();
      if (!created) return;
      setPack(created);
      setStep("benefits");
      return;
    }
    if (method === "manual") {
      const created = await createManualPack();
      if (!created) return;
      setPack(created);
      setStep("benefits");
    }
  }

  async function handleFinish() {
    if (!pack) return;
    if (activateOnFinish && cannotActivate) {
      setLocalError(PACK_EMPTY_ACTIVATION_MESSAGE);
      return;
    }

    setSaving(true);
    setLocalError(null);
    onError(null);

    try {
      if (activateOnFinish) {
        const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-packs/${pack.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudo activar el pack");
        }
      }
      onComplete();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleMethodSelect(next: CreateMethod) {
    setMethod(next);
    setLocalError(null);
    onError(null);
    setStep("details");
  }

  function goBack() {
    setLocalError(null);
    if (step === "details") {
      setPack(null);
      setStep("method");
      setMethod(null);
      return;
    }
    if (step === "benefits") {
      setStep("details");
      return;
    }
    if (step === "review") {
      setStep("benefits");
    }
  }

  const stepIndex = ["method", "details", "benefits", "review"].indexOf(step);
  const busy = saving || catalogState.busy;

  const modalTitle = "Crear pack";
  const modalDescription = (
    <div className="space-y-2">
      <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-gray-600 m-0">
        Paso {stepIndex + 1} de 4 · {STEP_LABELS[step]}
      </p>
      <div className="flex gap-1" aria-hidden>
        {(["method", "details", "benefits", "review"] as WizardStep[]).map((s, i) => (
          <span
            key={s}
            className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-[#c27b3d]" : "bg-[#e5e7eb]"}`}
          />
        ))}
      </div>
    </div>
  );

  const previewHref =
    albumPublicSlug && pack
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/album/${albumPublicSlug}?pack=${pack.id}`
      : null;

  const showBackButton = step !== "method" && !(step === "benefits" && pack);

  return (
    <AppModal
      open
      onClose={() => !busy && onClose()}
      size="xl"
      title={modalTitle}
      description={modalDescription}
      titleId="preventa-pack-create-wizard-title"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      panelClassName="max-h-[min(92vh,900px)]"
    >
      <div className="min-h-0 flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 space-y-4">
          {localError ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 m-0">
              {localError}
            </p>
          ) : null}

          {step === "method" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="text-left rounded-xl border-2 border-[#e5e7eb] hover:border-[#c27b3d]/60 bg-white p-5 transition-colors"
                onClick={() => handleMethodSelect("catalog")}
              >
                <p className="text-base font-semibold text-[#1a1a1a] m-0">
                  Crear desde un producto existente
                </p>
                <p className="text-sm text-[#6b7280] mt-2 m-0">
                  Usá un pack o combo que ya tenés en Mis packs y combos. Los productos incluidos se
                  cargan solos.
                </p>
              </button>
              <button
                type="button"
                className="text-left rounded-xl border-2 border-[#e5e7eb] hover:border-[#c27b3d]/60 bg-white p-5 transition-colors"
                onClick={() => handleMethodSelect("manual")}
              >
                <p className="text-base font-semibold text-[#1a1a1a] m-0">Crear desde cero</p>
                <p className="text-sm text-[#6b7280] mt-2 m-0">
                  Definís nombre, precio y etapa, y después agregás cada producto incluido a mano.
                </p>
              </button>
            </div>
          )}

          {step === "details" && method === "catalog" && (
            <PreventaPackCatalogImportStep
              ref={catalogRef}
              albumId={albumId}
              availabilityPhase={availabilityPhase}
              onAvailabilityPhaseChange={setAvailabilityPhase}
              onStateChange={setCatalogState}
              onError={(msg) => {
                if (msg) setLocalError(msg);
                onError(msg);
              }}
            />
          )}

          {step === "details" && method === "manual" && (
            <div className="ds-form-stack w-full max-w-none">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Nombre del pack *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Cuándo se vende</label>
                <select
                  value={availabilityPhase}
                  onChange={(e) =>
                    setAvailabilityPhase(e.target.value as "PRE_UPLOAD" | "POST_UPLOAD")
                  }
                  disabled={saving}
                  className={preventaSelectClassName}
                >
                  <option value="PRE_UPLOAD">Antes de subir fotos</option>
                  <option value="POST_UPLOAD">Después de subir fotos</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
                  Descripción (opcional)
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={saving}
                  placeholder="Resumí en lenguaje simple lo que recibe quien compra."
                  className="text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
                  Tu precio del pack ($) *
                </label>
                <Input
                  type="number"
                  min={0}
                  value={priceClientArs}
                  onChange={(e) => setPriceClientArs(e.target.value)}
                  disabled={saving}
                />
                {clientPreviewArs != null ? (
                  <p className="text-xs text-[#6b7280] mt-1 m-0">
                    Precio en preventa pública: ${clientPreviewArs.toLocaleString("es-AR")} (incluye
                    comisión de plataforma {platformFeePercent}%)
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
                  Foto del pack (opcional)
                </label>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="w-24 h-24 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden flex items-center justify-center">
                    {coverPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverPreviewUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-[#9ca3af]">Sin imagen</span>
                    )}
                  </div>
                  <FilePickerButton
                    file={pendingCoverFile}
                    onSelect={(f) => {
                      if (f) setPendingCoverFile(f);
                    }}
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={saving}
                    label="Cargar imagen"
                    size="sm"
                    className="w-auto"
                  />
                </div>
              </div>
            </div>
          )}

          {step === "benefits" && pack && (
            <>
              <PreventaPackBenefitsEditor
                albumId={albumId}
                pack={pack}
                onPacksChanged={() => {
                  void reloadBenefits();
                  void reloadPack();
                }}
              />
            </>
          )}

          {step === "review" && pack && (
            <div className="space-y-4 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4">
              <h3 className="text-base font-semibold text-[#1a1a1a] m-0">Resumen del pack</h3>
              <dl className="grid gap-2 text-sm m-0">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6b7280]">Nombre</dt>
                  <dd className="text-[#1a1a1a] font-medium m-0 text-right">{pack.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6b7280]">Etapa</dt>
                  <dd className="text-[#1a1a1a] m-0 text-right">{phaseLabel(pack.availabilityPhase)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6b7280]">Tu precio</dt>
                  <dd className="text-[#1a1a1a] m-0 text-right">
                    ${pack.priceClientArs.toLocaleString("es-AR")}
                  </dd>
                </div>
                {clientPreviewArs != null ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#6b7280]">Precio para familias</dt>
                    <dd className="text-[#1a1a1a] m-0 text-right">
                      ${clientPreviewArs.toLocaleString("es-AR")}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6b7280]">Estado</dt>
                  <dd className="text-[#1a1a1a] m-0 text-right">
                    {activateOnFinish ? "Activo (visible en preventa)" : "Borrador (inactivo)"}
                  </dd>
                </div>
              </dl>
              <div>
                <p className="text-xs font-medium text-[#374151] mb-1">Productos incluidos</p>
                {benefitsLoading ? (
                  <p className="text-xs text-[#6b7280] m-0">Cargando…</p>
                ) : (
                  <PreventaPackCompositionSummary benefits={benefits} />
                )}
              </div>
              {previewHref ? (
                <a
                  href={previewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#c27b3d] hover:underline"
                >
                  Ver en la página de preventa →
                </a>
              ) : null}
              <label className="flex items-start gap-2 text-sm text-[#374151] cursor-pointer">
                <input
                  type="checkbox"
                  checked={activateOnFinish}
                  disabled={cannotActivate || saving}
                  onChange={(e) => setActivateOnFinish(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Activar pack al finalizar
                  {cannotActivate ? (
                    <span className="block text-xs text-amber-700 mt-0.5">
                      {PACK_EMPTY_ACTIVATION_MESSAGE}
                    </span>
                  ) : null}
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#e5e7eb] px-5 py-4 sm:px-6 bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-auto">
              {showBackButton ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={busy}
                  onClick={goBack}
                >
                  Atrás
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:justify-end sm:w-auto">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={onClose}
              >
                Cancelar
              </Button>
              {step === "details" ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={busy || (method === "catalog" && !catalogState.canSubmit)}
                  onClick={() => void handleDetailsContinue()}
                >
                  {busy ? "Guardando…" : "Continuar"}
                </Button>
              ) : null}
              {step === "benefits" ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={busy}
                  onClick={() => {
                    setLocalError(null);
                    void reloadBenefits().then(() => setStep("review"));
                  }}
                >
                  Revisar y activar
                </Button>
              ) : null}
              {step === "review" ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={busy}
                  onClick={() => void handleFinish()}
                >
                  {saving ? "Guardando…" : activateOnFinish ? "Activar y cerrar" : "Guardar borrador"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </AppModal>
  );
}
