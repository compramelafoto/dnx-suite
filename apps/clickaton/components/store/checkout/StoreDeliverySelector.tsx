"use client";

import { STORE_PICKUP_POINTS, STORE_SHIPPING_ENABLED } from "@/lib/public-store/checkout/pickup";

type Props = {
  pickupPointId: string;
  pickupPersonName: string;
  onPickupPointChange: (v: string) => void;
  onPickupPersonNameChange: (v: string) => void;
  disabled?: boolean;
};

const fieldClass =
  "mt-2 w-full min-h-11 rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-bg px-4 py-3 text-ck-text focus:border-ck-yellow focus:outline-none focus:ring-2 focus:ring-ck-yellow/20";

export function StoreDeliverySelector({
  pickupPointId,
  pickupPersonName,
  onPickupPointChange,
  onPickupPersonNameChange,
  disabled,
}: Props) {
  const point = STORE_PICKUP_POINTS.find((p) => p.id === pickupPointId) ?? STORE_PICKUP_POINTS[0];

  return (
    <fieldset className="space-y-8" disabled={disabled}>
      <legend className="ck-heading-md">Entrega</legend>
      <div
        role="radiogroup"
        aria-label="Modalidad de entrega"
        className="space-y-4"
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-[var(--ck-radius-md)] border border-ck-yellow/50 bg-ck-surface p-4">
          <input
            type="radio"
            name="deliveryMethod"
            value="PICKUP"
            checked
            readOnly
            className="mt-1"
          />
          <span>
            <span className="block font-semibold text-ck-text">Retiro en punto Clickatón</span>
            <span className="ck-body-sm text-ck-text-muted">
              Sin costo de envío. Coordinamos el retiro cuando el pedido esté listo.
            </span>
          </span>
        </label>
        <label
          className={`flex items-start gap-3 rounded-[var(--ck-radius-md)] border border-ck-border p-4 ${
            STORE_SHIPPING_ENABLED ? "cursor-pointer" : "opacity-60"
          }`}
        >
          <input
            type="radio"
            name="deliveryMethod"
            value="SHIPPING"
            disabled
            aria-disabled="true"
            className="mt-1"
          />
          <span>
            <span className="block font-semibold text-ck-text">Envío a domicilio</span>
            <span className="ck-body-sm text-ck-text-muted">
              No disponible todavía (sin proveedor logístico / tarifario).
            </span>
          </span>
        </label>
      </div>

      <div>
        <label htmlFor="store-pickup-point" className="text-sm font-semibold text-ck-text">
          Punto de retiro <span className="text-ck-yellow">*</span>
        </label>
        <select
          id="store-pickup-point"
          className={fieldClass}
          value={pickupPointId}
          onChange={(e) => onPickupPointChange(e.target.value)}
        >
          {STORE_PICKUP_POINTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {point ? (
          <p className="mt-3 ck-body-sm text-ck-text-muted">
            {point.instructions} {point.scheduleNote}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="store-pickup-person" className="text-sm font-semibold text-ck-text">
          Nombre de quien retira <span className="text-ck-yellow">*</span>
        </label>
        <input
          id="store-pickup-person"
          className={fieldClass}
          value={pickupPersonName}
          maxLength={80}
          onChange={(e) => onPickupPersonNameChange(e.target.value)}
          required
        />
      </div>
    </fieldset>
  );
}
