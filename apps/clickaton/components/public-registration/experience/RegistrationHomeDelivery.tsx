"use client";

import type { HomeDeliveryOfferDto } from "@/lib/home-delivery/domain";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";

export type HomeDeliveryFieldKey =
  | "recipientName"
  | "documentNumber"
  | "phone"
  | "street"
  | "streetNumber"
  | "floor"
  | "city"
  | "province"
  | "postalCode"
  | "reference";

const CAMPOS: Array<{
  key: HomeDeliveryFieldKey;
  label: string;
  wide?: boolean;
  inputMode?: "numeric" | "tel";
}> = [
  { key: "recipientName", label: "Quién recibe *", wide: true },
  { key: "documentNumber", label: "DNI de quien recibe *", inputMode: "numeric" },
  { key: "phone", label: "Teléfono para el correo *", inputMode: "tel" },
  { key: "street", label: "Calle *" },
  { key: "streetNumber", label: "Altura *" },
  { key: "floor", label: "Piso / depto." },
  { key: "postalCode", label: "Código postal *" },
  { key: "city", label: "Localidad *" },
  { key: "province", label: "Provincia *" },
  { key: "reference", label: "Referencias para encontrar la casa", wide: true },
];

function fechaCorta(value: Date | string | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/**
 * Envío del kit a domicilio, para quien vive fuera de la ciudad de la edición.
 * El costo es fijo y no tiene descuento; el servidor lo vuelve a calcular.
 */
export function RegistrationHomeDelivery(props: {
  offer: HomeDeliveryOfferDto;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  values: Record<HomeDeliveryFieldKey, string>;
  onChange: (key: HomeDeliveryFieldKey, v: string) => void;
  errors: Record<string, string>;
  currency: string;
}) {
  const { offer } = props;
  const fee = formatPublicPrice(offer.feeAmount, props.currency);
  const hasta = fechaCorta(offer.guaranteedUntil);
  const fuera = offer.excludedCity ? `fuera de ${offer.excludedCity}` : "lejos de la sede";

  return (
    <section className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface-strong p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={props.enabled}
          onChange={(e) => props.onEnabledChange(e.target.checked)}
          className="mt-1 h-5 w-5 accent-[var(--ck-yellow)]"
        />
        <span>
          <span className="block font-semibold text-ck-text">
            Vivo {fuera}: quiero recibir el kit en mi casa (+{fee})
          </span>
          <span className="mt-1 block text-sm text-ck-text-secondary">
            Te lo mandamos por correo a cualquier punto de Argentina. Adentro viene un
            instructivo con un QR para acreditarte cuando te llegue.
          </span>
        </span>
      </label>

      {props.enabled ? (
        <div className="mt-4 space-y-4">
          {offer.guaranteedNow ? (
            hasta ? (
              <p className="text-sm text-ck-text-secondary">
                Inscribiéndote hasta el {hasta}, el kit te llega antes de la maratón.
              </p>
            ) : null
          ) : (
            <p
              className="rounded-[var(--ck-radius-control)] border border-amber-400/50 bg-amber-400/10 p-3 text-sm text-ck-text"
              role="note"
            >
              {hasta
                ? `Las inscripciones con envío posteriores al ${hasta} no tienen garantía de que el kit llegue antes de la maratón.`
                : "No podemos garantizar que el kit llegue antes de la maratón."}{" "}
              Podés participar igual aunque todavía no lo hayas recibido.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS.map((c) => {
              const id = `delivery-${c.key}`;
              const error = props.errors[`delivery.${c.key}`];
              return (
                <div key={c.key} className={c.wide ? "sm:col-span-2" : undefined}>
                  <label htmlFor={id} className="ck-label text-ck-text">
                    {c.label}
                  </label>
                  <input
                    id={id}
                    type="text"
                    inputMode={c.inputMode}
                    value={props.values[c.key]}
                    onChange={(e) => props.onChange(c.key, e.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className="mt-2 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3"
                  />
                  {error ? (
                    <p id={`${id}-error`} className="mt-1 text-xs text-[var(--ck-danger)]" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export const EMPTY_HOME_DELIVERY_VALUES: Record<HomeDeliveryFieldKey, string> = {
  recipientName: "",
  documentNumber: "",
  phone: "",
  street: "",
  streetNumber: "",
  floor: "",
  city: "",
  province: "",
  postalCode: "",
  reference: "",
};
