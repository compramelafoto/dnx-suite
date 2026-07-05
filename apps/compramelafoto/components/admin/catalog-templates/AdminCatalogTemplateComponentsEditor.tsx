"use client";

import type { CatalogDeliveryType, CatalogProductType } from "@/lib/prisma";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { DsField } from "@/components/ui/DsField";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import CatalogComponentQuantityField from "@/components/dashboard/catalog-products/CatalogComponentQuantityField";
import {
  CATALOG_DELIVERY_TYPE_LABELS,
  CATALOG_DELIVERY_TYPES,
} from "@/lib/catalog-products/components";
import type { CatalogDigitalQuantityMode } from "@/lib/catalog-products/digital-quantity-mode";
import { normalizeDigitalQuantityForStorage } from "@/lib/catalog-products/digital-quantity-mode";
import type { StoredTemplateComponent } from "@/lib/catalog-templates/template-components";

type Props = {
  components: StoredTemplateComponent[];
  productType: CatalogProductType;
  onChange: (next: StoredTemplateComponent[]) => void;
};

function emptyRow(index: number): StoredTemplateComponent {
  return {
    name: "",
    quantity: 1,
    deliveryType: "DIGITAL",
    sortOrder: index,
    notes: "",
    digitalQuantityMode: "FIXED",
  };
}

export default function AdminCatalogTemplateComponentsEditor({
  components,
  productType,
  onChange,
}: Props) {
  function updateRow(index: number, patch: Partial<StoredTemplateComponent>) {
    onChange(components.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(
      components.filter((_, i) => i !== index).map((row, i) => ({ ...row, sortOrder: i }))
    );
  }

  function addRow() {
    onChange([...components, emptyRow(components.length)]);
  }

  return (
    <div className="flex flex-col gap-3">
      {components.length === 0 ? (
        <DsEmptyState variant="tight" title="Sin componentes">
          <p className="text-sm text-[#6b7280] m-0">
            {productType === "SIMPLE"
              ? "Un producto simple puede no tener componentes."
              : "Agregá ítems para describir qué incluye el pack o combo."}
          </p>
          {productType !== "SIMPLE" ? (
            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={addRow}>
              Agregar componente
            </Button>
          ) : null}
        </DsEmptyState>
      ) : (
        <>
          {components.map((row, index) => {
            const mode = row.digitalQuantityMode ?? "FIXED";
            return (
              <div
                key={index}
                className="rounded-lg border border-[#eef0f3] bg-[#fafafa] p-3 sm:p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
                    Componente {index + 1}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => removeRow(index)}>
                    Quitar
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DsField label="Nombre">
                    <Input
                      value={row.name}
                      onChange={(e) => updateRow(index, { name: e.target.value })}
                      placeholder="Ej. 10 fotos digitales"
                    />
                  </DsField>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CatalogComponentQuantityField
                      idPrefix={`admin-tpl-${index}`}
                      compact
                      deliveryType={row.deliveryType}
                      quantity={row.quantity}
                      digitalQuantityMode={mode}
                      onQuantityChange={(value) =>
                        updateRow(index, {
                          quantity: Math.max(1, parseInt(value, 10) || 1),
                        })
                      }
                      onModeChange={(next: CatalogDigitalQuantityMode) =>
                        updateRow(index, {
                          digitalQuantityMode: next,
                          quantity: normalizeDigitalQuantityForStorage(row.quantity, next),
                        })
                      }
                    />
                    <DsField label="Entrega">
                      <Select
                        value={row.deliveryType}
                        onChange={(e) => {
                          const deliveryType = e.target.value as CatalogDeliveryType;
                          updateRow(index, {
                            deliveryType,
                            digitalQuantityMode:
                              deliveryType === "DIGITAL" ? mode : "FIXED",
                          });
                        }}
                      >
                        {CATALOG_DELIVERY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {CATALOG_DELIVERY_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </Select>
                    </DsField>
                  </div>
                </div>
                <DsField label="Notas (opcional)">
                  <Input
                    value={row.notes ?? ""}
                    onChange={(e) => updateRow(index, { notes: e.target.value })}
                    placeholder="Detalle interno o copy para el fotógrafo"
                  />
                </DsField>
              </div>
            );
          })}
          <Button type="button" variant="secondary" size="sm" onClick={addRow} className="self-start">
            + Agregar componente
          </Button>
        </>
      )}
    </div>
  );
}
