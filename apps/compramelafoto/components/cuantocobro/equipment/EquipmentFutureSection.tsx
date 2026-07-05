"use client";

import CuantoCobroPriceInput from "@/components/cuantocobro/CuantoCobroPriceInput";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { DsField } from "@/components/ui/DsField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import {
  CC_EQUIPMENT_CAMERA_EXPANSION_HINT,
  CC_EQUIPMENT_DUPLICATE_CAMERA_HINT,
  FUTURE_CATEGORY_LABELS,
  FUTURE_TIMELINE_OPTIONS,
} from "@/lib/cuantocobro/equipment/constants";
import { detectDuplicateCameraHint } from "@/lib/cuantocobro/equipment/calculations";
import { createEquipmentItemId } from "@/lib/cuantocobro/equipment/id";
import { scheduleScrollCuantoCobroSectionIntoView } from "@/lib/cuantocobro/scroll-section-into-view";
import type { CuantoCobroEquipmentInventory, FutureEquipmentItem } from "@/lib/cuantocobro/equipment/types";
import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  profile: CuantoCobroProfileInput;
  inventory: CuantoCobroEquipmentInventory;
  onInventoryChange: (inventory: CuantoCobroEquipmentInventory) => void;
};

function emptyFutureItem(): FutureEquipmentItem {
  return {
    id: createEquipmentItemId("future"),
    purpose: "FUTURE_EXPANSION_EQUIPMENT",
    category: "other",
    name: "",
    estimatedPrice: "",
    desiredTimeline: "",
    note: "",
  };
}

function futureItemLabel(item: FutureEquipmentItem, index: number): string {
  if (item.name.trim()) return item.name.trim();
  const categoryLabel = FUTURE_CATEGORY_LABELS[item.category] ?? "Equipo";
  return `${categoryLabel} ${index + 1}`;
}

export default function EquipmentFutureSection({ profile, inventory, onInventoryChange }: Props) {
  const items = inventory.futureEquipment;
  const duplicateHint = detectDuplicateCameraHint(profile) === "duplicate-camera";
  const [openItemId, setOpenItemId] = useState<string | null>(items[items.length - 1]?.id ?? null);
  const itemRefs = useRef(new Map<string, HTMLDetailsElement>());

  useEffect(() => {
    if (!openItemId) return;
    const element = itemRefs.current.get(openItemId);
    if (element?.open) {
      scheduleScrollCuantoCobroSectionIntoView(element);
    }
  }, [openItemId, items.length]);

  const updateItem = (id: string, patch: Partial<FutureEquipmentItem>) => {
    onInventoryChange({
      ...inventory,
      futureEquipment: inventory.futureEquipment.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  };

  const removeItem = (id: string) => {
    onInventoryChange({
      ...inventory,
      futureEquipment: inventory.futureEquipment.filter((item) => item.id !== id),
    });
    if (openItemId === id) {
      setOpenItemId(null);
    }
  };

  const addItem = () => {
    const next = emptyFutureItem();
    onInventoryChange({
      ...inventory,
      futureEquipment: [...inventory.futureEquipment, next],
    });
    setOpenItemId(next.id);
  };

  return (
    <div className="ds-form-stack cc-equipment-future">
      {duplicateHint ? (
        <div className="ds-info-panel cc-info-panel--accent" role="status">
          <p className="ds-info-panel__body m-0 text-sm">{CC_EQUIPMENT_DUPLICATE_CAMERA_HINT}</p>
        </div>
      ) : null}

      {items.length === 0 ? (
        <DsEmptyState title="Sin equipos planificados" variant="tight">
          <p className="m-0 ds-readable-text text-sm text-[var(--cc-color-muted)]">
            Agregá el equipo que querés comprar para estimar cuánto ahorrar por mes.
          </p>
          <div className="ds-empty-state__actions">
            <CuantoCobroButton
              type="button"
              variant="primary"


              className="w-full sm:w-auto"
              onClick={addItem}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Agregar equipo deseado
            </CuantoCobroButton>
          </div>
        </DsEmptyState>
      ) : (
        <>
          <div className="cc-equipment-future__list">
            {items.map((item, index) => {
              const isOpen = openItemId === item.id;
              return (
                <details
                  key={item.id}
                  ref={(node) => {
                    if (node) itemRefs.current.set(item.id, node);
                    else itemRefs.current.delete(item.id);
                  }}
                  className="cc-equipment-future-item"
                  open={isOpen}
                  onToggle={(e) => {
                    const el = e.currentTarget;
                    setOpenItemId(el.open ? item.id : null);
                  }}
                >
                  <summary className="cc-equipment-future-item__summary">
                    <span className="cc-equipment-future-item__title">
                      {futureItemLabel(item, index)}
                    </span>
                    <CuantoCobroButton
                      type="button"
                      variant="outline"

                      className="cc-equipment-future-item__remove"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                    >
                      Quitar
                    </CuantoCobroButton>
                  </summary>
                  <div className="cc-equipment-future-item__body ds-form-stack">
                    <DsField label="Categoría" htmlFor={`future-cat-${item.id}`}>
                      <Select
                        id={`future-cat-${item.id}`}
                        value={item.category}
                        onChange={(e) =>
                          updateItem(item.id, {
                            category: e.target.value as FutureEquipmentItem["category"],
                          })
                        }
                      >
                        {Object.entries(FUTURE_CATEGORY_LABELS)
                          .filter(([key]) => key !== "aa-batteries")
                          .map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                      </Select>
                    </DsField>
                    {item.category === "camera" ? (
                      <div className="ds-info-panel cc-info-panel--accent">
                        <p className="ds-info-panel__body m-0 text-xs sm:text-sm">
                          {CC_EQUIPMENT_CAMERA_EXPANSION_HINT}
                        </p>
                      </div>
                    ) : null}
                    <DsField label="Nombre del equipo" htmlFor={`future-name-${item.id}`}>
                      <Input
                        id={`future-name-${item.id}`}
                        value={item.name}
                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                        placeholder="Ej: Segunda cámara mirrorless"
                      />
                    </DsField>
                    <div className="ds-form-grid">
                      <DsField label="Precio estimado" htmlFor={`future-price-${item.id}`}>
                        <CuantoCobroPriceInput
                          id={`future-price-${item.id}`}
                          value={item.estimatedPrice}
                          onValueChange={(value) => updateItem(item.id, { estimatedPrice: value })}
                        />
                      </DsField>
                      <DsField label="Plazo deseado" htmlFor={`future-timeline-${item.id}`}>
                        <Select
                          id={`future-timeline-${item.id}`}
                          value={item.desiredTimeline}
                          onChange={(e) =>
                            updateItem(item.id, {
                              desiredTimeline: e.target.value as FutureEquipmentItem["desiredTimeline"],
                            })
                          }
                        >
                          {FUTURE_TIMELINE_OPTIONS.map((option) => (
                            <option key={option.value || "empty"} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </DsField>
                    </div>
                    <DsField label="Nota (opcional)" htmlFor={`future-note-${item.id}`}>
                      <Textarea
                        id={`future-note-${item.id}`}
                        compact
                        value={item.note}
                        onChange={(e) => updateItem(item.id, { note: e.target.value })}
                        placeholder="Ej: Para duplicar cobertura en bodas"
                      />
                    </DsField>
                  </div>
                </details>
              );
            })}
          </div>
          <CuantoCobroButton
            type="button"
            variant="outline"

            className="w-full sm:w-auto"
            onClick={addItem}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Agregar otro equipo
          </CuantoCobroButton>
        </>
      )}
    </div>
  );
}
