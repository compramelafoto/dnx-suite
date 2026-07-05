"use client";

import { useCallback, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import type { CatalogProductType } from "@/lib/prisma";
import type { CatalogDeliveryType } from "@/lib/prisma";
import {
  CATALOG_DELIVERY_TYPE_LABELS,
  CATALOG_DELIVERY_TYPES,
} from "@/lib/catalog-products/components";
import type { CatalogDigitalQuantityMode } from "@/lib/catalog-products/digital-quantity-mode";
import { normalizeDigitalQuantityForStorage } from "@/lib/catalog-products/digital-quantity-mode";
import type { CatalogProductComponentItem } from "@/lib/catalog-products/serialize";
import CatalogComponentQuantityField from "@/components/dashboard/catalog-products/CatalogComponentQuantityField";

export type CatalogComponentDraft = {
  clientId: string;
  name: string;
  quantity: string;
  digitalQuantityMode: CatalogDigitalQuantityMode;
  deliveryType: CatalogDeliveryType;
  notes: string;
};

function newDraft(partial?: Partial<CatalogComponentDraft>): CatalogComponentDraft {
  return {
    clientId: partial?.clientId ?? `c-${Math.random().toString(36).slice(2, 9)}`,
    name: partial?.name ?? "",
    quantity: partial?.quantity ?? "1",
    digitalQuantityMode: partial?.digitalQuantityMode ?? "FIXED",
    deliveryType: partial?.deliveryType ?? "DIGITAL",
    notes: partial?.notes ?? "",
  };
}

function draftsFromInitial(items?: CatalogProductComponentItem[]): CatalogComponentDraft[] {
  if (!items?.length) return [];
  return items.map((c) =>
    newDraft({
      clientId: `id-${c.id}`,
      name: c.name,
      quantity: String(c.quantity),
      digitalQuantityMode: c.digitalQuantityMode,
      deliveryType: c.deliveryType,
      notes: c.notes,
    })
  );
}

function defaultDraftsForType(type: CatalogProductType): CatalogComponentDraft[] {
  if (type === "PACK") return [newDraft({ name: "", quantity: "10", deliveryType: "DIGITAL" })];
  if (type === "COMBO") {
    return [
      newDraft({ name: "Fotos digitales", quantity: "2", deliveryType: "DIGITAL" }),
      newDraft({ name: "Impresiones", quantity: "2", deliveryType: "IMPRESO" }),
    ];
  }
  return [];
}

export function buildComponentsPayload(drafts: CatalogComponentDraft[]) {
  return drafts.map((d, i) => {
    const mode = d.deliveryType === "DIGITAL" ? d.digitalQuantityMode : "FIXED";
    const quantity = normalizeDigitalQuantityForStorage(parseInt(d.quantity, 10) || 1, mode);
    return {
      name: d.name.trim(),
      quantity,
      deliveryType: d.deliveryType,
      sortOrder: i,
      notes: d.notes.trim() || null,
      digitalQuantityMode: mode,
    };
  });
}

export function validateComponentDrafts(
  type: CatalogProductType,
  drafts: CatalogComponentDraft[]
): string | null {
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    if (!d.name.trim()) return `Componente ${i + 1}: el nombre es obligatorio.`;
    const mode = d.deliveryType === "DIGITAL" ? d.digitalQuantityMode : "FIXED";
    if (mode === "FIXED") {
      const qty = parseInt(d.quantity, 10);
      if (!Number.isFinite(qty) || qty < 1) {
        return `Componente ${i + 1}: la cantidad debe ser mayor a cero.`;
      }
    }
  }
  if (type === "PACK" && drafts.length < 1) {
    return "Un pack debe incluir al menos un componente.";
  }
  if (type === "COMBO" && drafts.length < 2) {
    return "Un combo debe incluir al menos dos componentes.";
  }
  if (type === "SIMPLE" && drafts.length > 1) {
    return "Un producto simple puede tener como máximo un componente.";
  }
  return null;
}

type Props = {
  productType: CatalogProductType;
  initialComponents?: CatalogProductComponentItem[];
  onChange?: (drafts: CatalogComponentDraft[]) => void;
};

export default function CatalogProductComponentsEditor({
  productType,
  initialComponents,
  onChange,
}: Props) {
  const [drafts, setDrafts] = useState<CatalogComponentDraft[]>(() => {
    const fromInitial = draftsFromInitial(initialComponents);
    if (fromInitial.length) return fromInitial;
    return defaultDraftsForType(productType);
  });

  const sync = useCallback(
    (next: CatalogComponentDraft[]) => {
      setDrafts(next);
      onChange?.(next);
    },
    [onChange]
  );

  if (productType === "SIMPLE") {
    return (
      <div className="rounded-xl border border-dashed border-[#e5e7eb] bg-[#fafafa] px-4 py-5 sm:px-6">
        <p className="text-sm font-medium text-[#1a1a1a] m-0">Una sola cosa</p>
        <p className="text-sm text-[#6b7280] mt-1 m-0 leading-relaxed">
          Los productos simples no requieren componentes. Si querés detallar qué incluye, podés
          usar la descripción.
        </p>
      </div>
    );
  }

  const title = productType === "PACK" ? "¿Qué incluye este pack?" : "Componentes del combo";

  function move(index: number, dir: -1 | 1) {
    const next = [...drafts];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    sync(next);
  }

  return (
    <div className="w-full min-w-0 rounded-xl border border-[#e5e7eb] bg-[#fafafa] p-4 sm:p-6 space-y-4">
      <div className="min-w-0">
        <h3 className="text-base font-medium text-[#1a1a1a] m-0">{title}</h3>
        <p className="text-sm text-[#6b7280] mt-1.5 m-0 leading-relaxed">
          Esto todavía <strong>no modifica el checkout</strong>. Sirve para ordenar tu catálogo y
          preparar la futura activación en álbumes.
        </p>
      </div>

      <ul className="w-full min-w-0 space-y-4 list-none m-0 p-0">
        {drafts.map((row, index) => (
          <li
            key={row.clientId}
            className="w-full min-w-0 rounded-lg border border-[#e5e7eb] bg-white p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
                Componente {index + 1}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="Subir"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="h-8 w-8 rounded-md border border-[#e5e7eb] text-[#6b7280] disabled:opacity-40 hover:bg-[#f9fafb]"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Bajar"
                  disabled={index === drafts.length - 1}
                  onClick={() => move(index, 1)}
                  className="h-8 w-8 rounded-md border border-[#e5e7eb] text-[#6b7280] disabled:opacity-40 hover:bg-[#f9fafb]"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Quitar componente"
                  disabled={productType === "PACK" && drafts.length <= 1}
                  onClick={() => sync(drafts.filter((d) => d.clientId !== row.clientId))}
                  className="h-8 px-2 rounded-md text-xs text-[#b91c1c] border border-[#fecaca] hover:bg-[#fef2f2] disabled:opacity-40"
                >
                  Quitar
                </button>
              </div>
            </div>

            <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-1">
                <CatalogComponentQuantityField
                  idPrefix={`${row.clientId}-qty`}
                  deliveryType={row.deliveryType}
                  quantity={row.quantity}
                  digitalQuantityMode={row.digitalQuantityMode}
                  onQuantityChange={(value) =>
                    sync(
                      drafts.map((d) =>
                        d.clientId === row.clientId ? { ...d, quantity: value } : d
                      )
                    )
                  }
                  onModeChange={(mode) =>
                    sync(
                      drafts.map((d) =>
                        d.clientId === row.clientId
                          ? { ...d, digitalQuantityMode: mode }
                          : d
                      )
                    )
                  }
                />
              </div>
              <div className="sm:col-span-1 lg:col-span-2">
                <label className="block text-xs font-medium text-[#6b7280] mb-1">Nombre</label>
                <Input
                  value={row.name}
                  onChange={(e) =>
                    sync(
                      drafts.map((d) =>
                        d.clientId === row.clientId ? { ...d, name: e.target.value } : d
                      )
                    )
                  }
                  placeholder="Ej: fotos digitales, díptico 20×30"
                  className="w-full min-w-0"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-[#6b7280] mb-1">
                  Tipo de entrega (futuro)
                </label>
                <Select
                  value={row.deliveryType}
                  onChange={(e) => {
                    const deliveryType = e.target.value as CatalogDeliveryType;
                    sync(
                      drafts.map((d) =>
                        d.clientId === row.clientId
                          ? {
                              ...d,
                              deliveryType,
                              digitalQuantityMode:
                                deliveryType === "DIGITAL" ? d.digitalQuantityMode : "FIXED",
                            }
                          : d
                      )
                    );
                  }}
                  className="w-full min-w-0"
                >
                  {CATALOG_DELIVERY_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {CATALOG_DELIVERY_TYPE_LABELS[dt]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {productType === "COMBO" ? (
              <div>
                <label className="block text-xs font-medium text-[#6b7280] mb-1">
                  Nota (opcional)
                </label>
                <Input
                  value={row.notes}
                  onChange={(e) =>
                    sync(
                      drafts.map((d) =>
                        d.clientId === row.clientId ? { ...d, notes: e.target.value } : d
                      )
                    )
                  }
                  placeholder="Ej: tamaño 15×21, acabado mate"
                  className="w-full min-w-0"
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {productType === "COMBO" ? (
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => sync([...drafts, newDraft()])}
        >
          + Agregar componente
        </Button>
      ) : null}
    </div>
  );
}
