"use client";

import CuantoCobroPriceInput from "@/components/cuantocobro/CuantoCobroPriceInput";
import { DsField } from "@/components/ui/DsField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  analyzeCameraWear,
  CAMERA_BODY_PRESETS,
  formatActuationCount,
  getCameraPreset,
} from "@/lib/cuantocobro/camera-equipment";
import { formatCuantoCobroCurrency } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";

type Props = {
  profile: CuantoCobroProfileInput;
  onProfileChange: <K extends keyof CuantoCobroProfileInput>(
    key: K,
    value: CuantoCobroProfileInput[K],
  ) => void;
  /** Oculta intro duplicada cuando el formulario va dentro de un modal. */
  compact?: boolean;
  resaleValue?: string;
  onResaleValueChange?: (value: string) => void;
};

const MODAL_FORM_GRID = "ds-form-grid grid grid-cols-2 gap-3";

export default function CameraShutterWearPanel({
  profile,
  onProfileChange,
  compact = false,
  resaleValue = "",
  onResaleValueChange,
}: Props) {
  const wear = analyzeCameraWear(profile);
  const fmt = (amount: number) => formatCuantoCobroCurrency(amount, profile.currency || "ARS");

  const handlePresetChange = (presetId: string) => {
    onProfileChange("primaryCameraPresetId", presetId);
    const preset = getCameraPreset(presetId);
    if (preset && preset.id !== "custom" && preset.shutterRating > 0) {
      onProfileChange("primaryCameraShutterRating", String(preset.shutterRating));
    }
  };

  const formFields = (
    <>
      <DsField label={compact ? "Modelo" : "Modelo de cámara principal"} htmlFor="cc-camera-preset">
        <Select
          id="cc-camera-preset"
          value={profile.primaryCameraPresetId}
          onChange={(e) => handlePresetChange(e.target.value)}
        >
          <option value="">Seleccioná un modelo</option>
          {CAMERA_BODY_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
              {preset.shutterRating > 0 ? ` — ${formatActuationCount(preset.shutterRating)} disparos` : ""}
            </option>
          ))}
        </Select>
      </DsField>

      {profile.primaryCameraPresetId === "custom" && (
        <DsField label="Nombre del modelo" htmlFor="cc-camera-custom-name">
          <Input
            id="cc-camera-custom-name"
            placeholder="Ej: Canon EOS 90D"
            value={profile.primaryCameraCustomName}
            onChange={(e) => onProfileChange("primaryCameraCustomName", e.target.value)}
          />
        </DsField>
      )}

      <div className={compact ? MODAL_FORM_GRID : "ds-form-grid grid grid-cols-1 gap-4 sm:grid-cols-2"}>
        <DsField
          label={compact ? "Vida útil (disparos)" : "Vida útil del obturador (disparos)"}
          htmlFor="cc-camera-shutter-rating"
          hint={compact ? undefined : "Sugerido: 300.000 disparos."}
        >
          <Input
            id="cc-camera-shutter-rating"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Ej: 200000"
            value={profile.primaryCameraShutterRating}
            onChange={(e) => onProfileChange("primaryCameraShutterRating", e.target.value)}
          />
        </DsField>
        <DsField
          label={compact ? "Disparos actuales" : "Disparos actuales (opcional)"}
          htmlFor="cc-camera-current-shutter"
          hint={compact ? undefined : "Si no lo sabés, dejalo en 0."}
        >
          <Input
            id="cc-camera-current-shutter"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Ej: 45000"
            value={profile.primaryCameraCurrentShutterCount}
            onChange={(e) => onProfileChange("primaryCameraCurrentShutterCount", e.target.value)}
          />
        </DsField>
      </div>

      <div className={compact ? MODAL_FORM_GRID : "ds-form-grid grid grid-cols-1 gap-4 sm:grid-cols-2"}>
        <DsField
          label={compact ? "Valor de reemplazo" : "Valor de reemplazo del cuerpo"}
          htmlFor="cc-camera-replacement-value"
          hint={compact ? undefined : "Precio actual de reposición."}
        >
          <CuantoCobroPriceInput
            id="cc-camera-replacement-value"
            placeholder="Ej: 2.500.000"
            value={profile.primaryCameraReplacementValue}
            onValueChange={(value) => onProfileChange("primaryCameraReplacementValue", value)}
          />
        </DsField>
        {compact && onResaleValueChange ? (
          <DsField label={compact ? "Reventa (opcional)" : "Reventa estimada (opcional)"} htmlFor="cc-camera-resale-value">
            <CuantoCobroPriceInput
              id="cc-camera-resale-value"
              value={resaleValue}
              onValueChange={onResaleValueChange}
            />
          </DsField>
        ) : (
          <DsField
            label="Disparos anuales estimados (opcional)"
            htmlFor="cc-camera-annual-shots"
            hint="Para calcular el aporte mensual."
          >
            <Input
              id="cc-camera-annual-shots"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Ej: 80000"
              value={profile.estimatedAnnualShots}
              onChange={(e) => onProfileChange("estimatedAnnualShots", e.target.value)}
            />
          </DsField>
        )}
      </div>

      {compact && onResaleValueChange ? (
        <DsField label={compact ? "Disparos anuales" : "Disparos anuales estimados (opcional)"} htmlFor="cc-camera-annual-shots-compact">
          <Input
            id="cc-camera-annual-shots-compact"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Ej: 80000"
            value={profile.estimatedAnnualShots}
            onChange={(e) => onProfileChange("estimatedAnnualShots", e.target.value)}
          />
        </DsField>
      ) : null}
    </>
  );

  const wearSummary = wear.isConfigured ? (
    compact ? (
      <div className="cc-camera-wear__summary cc-camera-wear__summary--compact" role="status">
        <dl className="cc-camera-wear__summary-compact-grid">
          <div className="cc-camera-wear__summary-compact-item">
            <dt>Disparos restantes</dt>
            <dd>
              {formatActuationCount(wear.remainingActuations)}
              <span className="cc-camera-wear__summary-compact-sub">
                {" "}
                ({wear.remainingLifePercent}%)
              </span>
            </dd>
          </div>
          {wear.costPerShot !== null ? (
            <div className="cc-camera-wear__summary-compact-item">
              <dt>Desgaste estimado</dt>
              <dd>{fmt(wear.costPerShot)}/disparo</dd>
            </div>
          ) : null}
          {wear.suggestedMonthlyRenewal !== null ? (
            <div className="cc-camera-wear__summary-compact-item cc-camera-wear__summary-compact-item--highlight">
              <dt>Aporte mensual sugerido</dt>
              <dd>{fmt(wear.suggestedMonthlyRenewal)}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    ) : (
      <div className="cc-camera-wear__summary" role="status">
        <h5 className="cc-camera-wear__summary-title m-0">{wear.cameraLabel}</h5>
        <dl className="cc-camera-wear__summary-list">
          <div className="cc-camera-wear__summary-row">
            <dt>Vida útil del obturador</dt>
            <dd>{formatActuationCount(wear.shutterRating)} disparos</dd>
          </div>
          <div className="cc-camera-wear__summary-row">
            <dt>Disparos usados</dt>
            <dd>
              {formatActuationCount(wear.currentShutterCount)} ({wear.usedLifePercent}%)
            </dd>
          </div>
          <div className="cc-camera-wear__summary-row cc-camera-wear__summary-row--highlight">
            <dt>Disparos restantes</dt>
            <dd>
              {formatActuationCount(wear.remainingActuations)} ({wear.remainingLifePercent}%)
            </dd>
          </div>
          {wear.costPerShot !== null ? (
            <div className="cc-camera-wear__summary-row">
              <dt>Costo por disparo (referencia)</dt>
              <dd>{fmt(wear.costPerShot)}</dd>
            </div>
          ) : null}
          {wear.suggestedMonthlyRenewal !== null ? (
            <div className="cc-camera-wear__summary-row">
              <dt>Aporte mensual sugerido</dt>
              <dd>{fmt(wear.suggestedMonthlyRenewal)}</dd>
            </div>
          ) : null}
        </dl>
        <p className="cc-camera-wear__formula m-0">
          Costo por disparo = valor de reemplazo ÷ vida útil del obturador
        </p>
      </div>
    )
  ) : compact ? null : (
    <div className="ds-info-panel cc-info-panel--accent" role="status">
      <p className="ds-info-panel__body m-0 text-sm">
        Completá el modelo, la vida útil del obturador y el valor de reemplazo para ver el desgaste estimado.
      </p>
    </div>
  );

  return (
    <div className={`cc-camera-wear${compact ? " cc-camera-wear--compact" : " ds-stack-section"}`}>
      {!compact ? (
        <div className="cc-camera-wear__intro">
          <h4 className="cc-camera-wear__title m-0">Vida útil del cuerpo de cámara</h4>
          <p className="cc-camera-wear__text m-0">
            El obturador tiene un límite de disparos. Con el modelo, el valor de reemplazo y tus disparos
            anuales estimados podés calcular cuánto reservar por mes.
          </p>
        </div>
      ) : null}

      {compact ? (
        <div className="ds-form-stack cc-camera-wear__form-fields">{formFields}</div>
      ) : (
        formFields
      )}

      {wearSummary}
    </div>
  );
}
