"use client";

import type { CatalogDeliveryType } from "@/lib/prisma";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  CATALOG_DIGITAL_QUANTITY_MODE_HELP,
  CATALOG_DIGITAL_QUANTITY_MODE_LABELS,
  CATALOG_DIGITAL_QUANTITY_MODES,
  type CatalogDigitalQuantityMode,
  isDigitalDeliveryType,
} from "@/lib/catalog-products/digital-quantity-mode";

type Props = {
  deliveryType: CatalogDeliveryType;
  quantity: number | string;
  digitalQuantityMode: CatalogDigitalQuantityMode;
  onQuantityChange: (value: string) => void;
  onModeChange: (mode: CatalogDigitalQuantityMode) => void;
  idPrefix?: string;
  compact?: boolean;
};

export default function CatalogComponentQuantityField({
  deliveryType,
  quantity,
  digitalQuantityMode,
  onQuantityChange,
  onModeChange,
  idPrefix = "qty",
  compact = false,
}: Props) {
  const digital = isDigitalDeliveryType(deliveryType);
  const mode = digital ? digitalQuantityMode : "FIXED";
  const showFixedInput = !digital || mode === "FIXED";

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[#6b7280] mb-1" htmlFor={`${idPrefix}-mode`}>
        {compact ? "Cant." : "Cantidad de archivos"}
      </label>
      {digital ? (
        <>
          <Select
            id={`${idPrefix}-mode`}
            value={mode}
            onChange={(e) => onModeChange(e.target.value as CatalogDigitalQuantityMode)}
            className="w-full min-w-0"
          >
            {CATALOG_DIGITAL_QUANTITY_MODES.map((m) => (
              <option key={m} value={m}>
                {CATALOG_DIGITAL_QUANTITY_MODE_LABELS[m]}
              </option>
            ))}
          </Select>
          {mode !== "FIXED" ? (
            <p className="text-xs text-[#6b7280] m-0 leading-snug">
              {CATALOG_DIGITAL_QUANTITY_MODE_HELP[mode]}
            </p>
          ) : null}
        </>
      ) : null}

      {showFixedInput ? (
        <Input
          id={`${idPrefix}-fixed`}
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(e) => onQuantityChange(e.target.value)}
          className="w-full min-w-0"
          placeholder="Ej. 10"
        />
      ) : null}

      {!digital ? (
        <p className="text-xs text-[#9ca3af] m-0">
          Las opciones &quot;Todas las fotos&quot; y &quot;Todas mis fotos&quot; aplican solo a
          entrega digital.
        </p>
      ) : null}
    </div>
  );
}
