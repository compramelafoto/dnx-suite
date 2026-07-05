"use client";

import CameraShutterWearPanel from "@/components/cuantocobro/CameraShutterWearPanel";
import CuantoCobroPriceInput from "@/components/cuantocobro/CuantoCobroPriceInput";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { DsField } from "@/components/ui/DsField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  DEFAULT_CAMERA_SHUTTER_RATING,
  DEFAULT_COMPUTER_LIFESPAN_YEARS,
  DEFAULT_LENS_LIFESPAN_YEARS,
  DEFAULT_MONITOR_LIFESPAN_YEARS,
  DEFAULT_SPEEDLIGHT_LIFESPAN_YEARS,
  DEFAULT_STUDIO_FLASH_LIFESPAN_YEARS,
  MEMORY_CARD_REPLACEMENT_MONTHS,
} from "@/lib/cuantocobro/equipment/constants";
import { createEquipmentItemId } from "@/lib/cuantocobro/equipment/id";
import { INITIAL_EQUIPMENT_RENEWAL } from "@/lib/cuantocobro/equipment/normalize";
import type {
  CuantoCobroEquipmentRenewal,
  EquipmentRenewalCategoryId,
  RenewalLensItem,
} from "@/lib/cuantocobro/equipment/types";
import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";

type Props = {
  categoryId: EquipmentRenewalCategoryId;
  profile: CuantoCobroProfileInput;
  renewal: CuantoCobroEquipmentRenewal;
  compact?: boolean;
  onProfileChange: <K extends keyof CuantoCobroProfileInput>(
    key: K,
    value: CuantoCobroProfileInput[K],
  ) => void;
  onRenewalChange: (renewal: CuantoCobroEquipmentRenewal) => void;
};

function emptyLens(): RenewalLensItem {
  return {
    id: createEquipmentItemId("lens"),
    model: "",
    replacementValue: "",
    yearsOwned: "",
    resaleValue: "",
  };
}

export default function EquipmentRenewalCategoryForm({
  categoryId,
  profile,
  renewal,
  compact = false,
  onProfileChange,
  onRenewalChange,
}: Props) {
  switch (categoryId) {
    case "camera":
      return (
        <div className="cc-equipment-modal__form">
          <CameraShutterWearPanel
            profile={profile}
            onProfileChange={onProfileChange}
            compact={compact}
            resaleValue={renewal.camera?.resaleValue ?? ""}
            onResaleValueChange={(value) =>
              onRenewalChange({
                ...renewal,
                camera: {
                  presetId: profile.primaryCameraPresetId,
                  customName: profile.primaryCameraCustomName,
                  shutterRating:
                    profile.primaryCameraShutterRating ||
                    String(DEFAULT_CAMERA_SHUTTER_RATING),
                  currentShutterCount: profile.primaryCameraCurrentShutterCount,
                  replacementValue: profile.primaryCameraReplacementValue,
                  resaleValue: value,
                  estimatedAnnualShots: profile.estimatedAnnualShots,
                },
              })
            }
          />
        </div>
      );

    case "lenses": {
      const lenses = renewal.lenses.length > 0 ? renewal.lenses : [emptyLens()];
      return (
        <div className="cc-equipment-modal__form">
          {lenses.map((lens, index) => (
            <div key={lens.id} className="cc-equipment-modal__card cc-equipment-item-block">
              <div className="cc-equipment-item-block__head">
                <h5 className="m-0 text-sm font-semibold">
                  {lens.model.trim() || `Lente ${index + 1}`}
                </h5>
                {lenses.length > 1 ? (
                  <CuantoCobroButton
                    type="button"
                    variant="outline"

                    onClick={() =>
                      onRenewalChange({
                        ...renewal,
                        lenses: renewal.lenses.filter((item) => item.id !== lens.id),
                      })
                    }
                  >
                    Quitar
                  </CuantoCobroButton>
                ) : null}
              </div>
              <div className="ds-form-stack">
                <DsField label="Modelo" htmlFor={`lens-model-${lens.id}`}>
                  <Input
                    id={`lens-model-${lens.id}`}
                    value={lens.model}
                    onChange={(e) => {
                      const next = lenses.map((item) =>
                        item.id === lens.id ? { ...item, model: e.target.value } : item,
                      );
                      onRenewalChange({ ...renewal, lenses: next });
                    }}
                    placeholder="Ej: Sony 24-70mm f/2.8"
                  />
                </DsField>
                <div className="ds-form-grid">
                  <DsField label="Valor de reposición" htmlFor={`lens-value-${lens.id}`}>
                    <CuantoCobroPriceInput
                      id={`lens-value-${lens.id}`}
                      value={lens.replacementValue}
                      onValueChange={(value) => {
                        const next = lenses.map((item) =>
                          item.id === lens.id ? { ...item, replacementValue: value } : item,
                        );
                        onRenewalChange({ ...renewal, lenses: next });
                      }}
                    />
                  </DsField>
                  <DsField
                    label="Años de uso"
                    htmlFor={`lens-years-${lens.id}`}
                    hint={`Vida útil sugerida: ${DEFAULT_LENS_LIFESPAN_YEARS} años`}
                  >
                    <Input
                      id={`lens-years-${lens.id}`}
                      type="number"
                      min={0}
                      value={lens.yearsOwned}
                      onChange={(e) => {
                        const next = lenses.map((item) =>
                          item.id === lens.id ? { ...item, yearsOwned: e.target.value } : item,
                        );
                        onRenewalChange({ ...renewal, lenses: next });
                      }}
                    />
                  </DsField>
                </div>
                <DsField label="Valor de reventa estimado (opcional)" htmlFor={`lens-resale-${lens.id}`}>
                  <CuantoCobroPriceInput
                    id={`lens-resale-${lens.id}`}
                    value={lens.resaleValue}
                    onValueChange={(value) => {
                      const next = lenses.map((item) =>
                        item.id === lens.id ? { ...item, resaleValue: value } : item,
                      );
                      onRenewalChange({ ...renewal, lenses: next });
                    }}
                  />
                </DsField>
              </div>
            </div>
          ))}
          <CuantoCobroButton
            type="button"
            variant="outline"

            className="w-full sm:w-auto"
            onClick={() => onRenewalChange({ ...renewal, lenses: [...lenses, emptyLens()] })}
          >
            Agregar otro lente
          </CuantoCobroButton>
        </div>
      );
    }

    case "memory-cards": {
      const data = renewal.memoryCards ?? { quantity: "", averagePrice: "" };
      return (
        <div className="cc-equipment-modal__form">
          <div className="cc-equipment-modal__card">
            <div className="ds-form-grid">
            <DsField
              label="Cantidad actual"
              htmlFor="memory-cards-qty"
              hint="Solo referencia de stock."
            >
              <Input
                id="memory-cards-qty"
                type="number"
                min={0}
                value={data.quantity}
                onChange={(e) =>
                  onRenewalChange({ ...renewal, memoryCards: { ...data, quantity: e.target.value } })
                }
              />
            </DsField>
            <DsField
              label="Precio promedio por tarjeta"
              htmlFor="memory-cards-price"
              hint={`Sugerimos renovar 1 tarjeta cada ${MEMORY_CARD_REPLACEMENT_MONTHS} meses.`}
            >
              <CuantoCobroPriceInput
                id="memory-cards-price"
                value={data.averagePrice}
                onValueChange={(value) =>
                  onRenewalChange({ ...renewal, memoryCards: { ...data, averagePrice: value } })
                }
              />
            </DsField>
            </div>
          </div>
        </div>
      );
    }

    case "computer": {
      const data = renewal.computer ?? { replacementValue: "", yearsOwned: "" };
      return (
        <div className="cc-equipment-modal__form">
          <div className="cc-equipment-modal__card">
            <div className="ds-form-grid">
          <DsField
            label="Valor de reposición estimado"
            htmlFor="computer-value"
            hint={`Renovación sugerida cada ${DEFAULT_COMPUTER_LIFESPAN_YEARS} años.`}
          >
            <CuantoCobroPriceInput
              id="computer-value"
              value={data.replacementValue}
              onValueChange={(value) =>
                onRenewalChange({ ...renewal, computer: { ...data, replacementValue: value } })
              }
            />
          </DsField>
          <DsField label="Años de uso" htmlFor="computer-years">
            <Input
              id="computer-years"
              type="number"
              min={0}
              value={data.yearsOwned}
              onChange={(e) =>
                onRenewalChange({ ...renewal, computer: { ...data, yearsOwned: e.target.value } })
              }
            />
          </DsField>
            </div>
          </div>
        </div>
      );
    }

    case "monitor": {
      const data = renewal.monitor ?? { replacementValue: "", yearsOwned: "" };
      return (
        <div className="cc-equipment-modal__form">
          <div className="cc-equipment-modal__card">
            <div className="ds-form-grid">
          <DsField
            label="Valor de reposición estimado"
            htmlFor="monitor-value"
            hint={`Vida útil sugerida: ${DEFAULT_MONITOR_LIFESPAN_YEARS} años.`}
          >
            <CuantoCobroPriceInput
              id="monitor-value"
              value={data.replacementValue}
              onValueChange={(value) =>
                onRenewalChange({ ...renewal, monitor: { ...data, replacementValue: value } })
              }
            />
          </DsField>
          <DsField label="Años de uso" htmlFor="monitor-years">
            <Input
              id="monitor-years"
              type="number"
              min={0}
              value={data.yearsOwned}
              onChange={(e) =>
                onRenewalChange({ ...renewal, monitor: { ...data, yearsOwned: e.target.value } })
              }
            />
          </DsField>
            </div>
          </div>
        </div>
      );
    }

    case "storage-disks": {
      const data = renewal.storageDisks ?? { currentCapacityTb: "", replacementPrice: "" };
      return (
        <div className="cc-equipment-modal__form">
          <div className="cc-equipment-modal__card">
            <div className="ds-form-grid">
          <DsField label="Capacidad actual (TB)" htmlFor="storage-capacity">
            <Input
              id="storage-capacity"
              type="number"
              min={0}
              step="0.1"
              value={data.currentCapacityTb}
              onChange={(e) =>
                onRenewalChange({
                  ...renewal,
                  storageDisks: { ...data, currentCapacityTb: e.target.value },
                })
              }
            />
          </DsField>
          <DsField label="Precio estimado de reposición" htmlFor="storage-price">
            <CuantoCobroPriceInput
              id="storage-price"
              value={data.replacementPrice}
              onValueChange={(value) =>
                onRenewalChange({ ...renewal, storageDisks: { ...data, replacementPrice: value } })
              }
            />
          </DsField>
            </div>
          </div>
        </div>
      );
    }

    case "speedlight": {
      const data = renewal.speedlight ?? {
        quantity: "",
        averagePrice: "",
        lifespanYears: String(DEFAULT_SPEEDLIGHT_LIFESPAN_YEARS),
        usesAABatteries: "" as const,
      };
      return (
        <div className="cc-equipment-modal__form">
          <div className="cc-equipment-modal__card">
            <div className="ds-form-stack">
              <div className="ds-form-grid">
                <DsField label="Cantidad" htmlFor="speedlight-qty">
                  <Input
                    id="speedlight-qty"
                    type="number"
                    min={0}
                    value={data.quantity}
                    onChange={(e) =>
                      onRenewalChange({ ...renewal, speedlight: { ...data, quantity: e.target.value } })
                    }
                  />
                </DsField>
                <DsField label="Precio promedio por unidad" htmlFor="speedlight-price">
                  <CuantoCobroPriceInput
                    id="speedlight-price"
                    value={data.averagePrice}
                    onValueChange={(value) =>
                      onRenewalChange({ ...renewal, speedlight: { ...data, averagePrice: value } })
                    }
                  />
                </DsField>
              </div>
              <DsField label="Vida útil sugerida (años)" htmlFor="speedlight-life">
                <Input
                  id="speedlight-life"
                  type="number"
                  min={1}
                  value={data.lifespanYears}
                  onChange={(e) =>
                    onRenewalChange({ ...renewal, speedlight: { ...data, lifespanYears: e.target.value } })
                  }
                />
              </DsField>
              <DsField label="¿Usan pilas AA?" htmlFor="speedlight-aa">
                <Select
                  id="speedlight-aa"
                  value={data.usesAABatteries}
                  onChange={(e) =>
                    onRenewalChange({
                      ...renewal,
                      speedlight: { ...data, usesAABatteries: e.target.value as "" | "yes" | "no" },
                      aaBatteries:
                        e.target.value === "yes"
                          ? renewal.aaBatteries ?? { monthlyCost: "" }
                          : null,
                    })
                  }
                >
                  <option value="">Seleccioná una opción</option>
                  <option value="yes">Sí, usan pilas AA</option>
                  <option value="no">No, usan batería propia</option>
                </Select>
              </DsField>
            </div>
          </div>
        </div>
      );
    }

    case "studio-flash": {
      const data = renewal.studioFlash ?? {
        quantity: "",
        averagePrice: "",
        lifespanYears: String(DEFAULT_STUDIO_FLASH_LIFESPAN_YEARS),
      };
      return (
        <div className="cc-equipment-modal__form">
          <div className="cc-equipment-modal__card">
            <div className="ds-form-stack">
              <div className="ds-form-grid">
                <DsField label="Cantidad" htmlFor="studio-flash-qty">
                  <Input
                    id="studio-flash-qty"
                    type="number"
                    min={0}
                    value={data.quantity}
                    onChange={(e) =>
                      onRenewalChange({ ...renewal, studioFlash: { ...data, quantity: e.target.value } })
                    }
                  />
                </DsField>
                <DsField label="Precio promedio por unidad" htmlFor="studio-flash-price">
                  <CuantoCobroPriceInput
                    id="studio-flash-price"
                    value={data.averagePrice}
                    onValueChange={(value) =>
                      onRenewalChange({ ...renewal, studioFlash: { ...data, averagePrice: value } })
                    }
                  />
                </DsField>
              </div>
              <DsField label="Vida útil sugerida (años)" htmlFor="studio-flash-life">
                <Input
                  id="studio-flash-life"
                  type="number"
                  min={1}
                  value={data.lifespanYears}
                  onChange={(e) =>
                    onRenewalChange({ ...renewal, studioFlash: { ...data, lifespanYears: e.target.value } })
                  }
                />
              </DsField>
            </div>
          </div>
        </div>
      );
    }

    case "aa-batteries": {
      const data = renewal.aaBatteries ?? { monthlyCost: "" };
      const speedlightQty = renewal.speedlight?.quantity ?? "0";
      const batteryCount =
        (parseInt(speedlightQty, 10) || 0) > 0 ? (parseInt(speedlightQty, 10) || 0) * 4 : 0;
      return (
        <div className="cc-equipment-modal__form">
          <div className="cc-equipment-modal__card">
            <DsField
          label="Costo mensual estimado de pilas"
          htmlFor="aa-batteries-cost"
          hint={
            batteryCount > 0
              ? `${batteryCount} pilas en total (4 por speedlight). Sin cargadores.`
              : "4 pilas por speedlight. Sin cargadores."
          }
        >
          <CuantoCobroPriceInput
            id="aa-batteries-cost"
            value={data.monthlyCost}
            onValueChange={(value) => onRenewalChange({ ...renewal, aaBatteries: { monthlyCost: value } })}
            />
          </DsField>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

export function clearRenewalCategory(
  categoryId: EquipmentRenewalCategoryId,
  renewal: CuantoCobroEquipmentRenewal,
): CuantoCobroEquipmentRenewal {
  switch (categoryId) {
    case "camera":
      return { ...renewal, camera: null };
    case "lenses":
      return { ...renewal, lenses: [] };
    case "memory-cards":
      return { ...renewal, memoryCards: null };
    case "computer":
      return { ...renewal, computer: null };
    case "monitor":
      return { ...renewal, monitor: null };
    case "storage-disks":
      return { ...renewal, storageDisks: null };
    case "speedlight":
      return { ...renewal, speedlight: null, aaBatteries: null };
    case "studio-flash":
      return { ...renewal, studioFlash: null };
    case "aa-batteries":
      return { ...renewal, aaBatteries: null };
    default:
      return renewal;
  }
}

export { INITIAL_EQUIPMENT_RENEWAL };
