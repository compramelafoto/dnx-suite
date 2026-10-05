"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Price } from "@/components/store/price";
import type { CheckoutLine } from "@/lib/store/checkout-input";
import type { DeliveryOptions, PublicAgency } from "@/lib/store/shipping/checkout";
import { normalizePostalCode } from "@/lib/store/shipping/package";
import { PROVINCES } from "@/lib/store/shipping/provinces";
import { listAgenciesAction, quoteShippingAction } from "./actions";

export type DeliveryMethod = "PICKUP" | "HOME" | "BRANCH";

/** Lo que el checkout necesita saber del envío elegido. */
export type DeliveryState = {
  method: DeliveryMethod;
  homeProvince: string;
  homePostalCode: string;
  branchProvince: string;
  agency: PublicAgency | null;
};

export type QuoteView =
  | { status: "none" }
  | { status: "missing" }
  | { status: "loading" }
  | { status: "ok"; totalMinor: number; serviceName: string }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 500;

export function firstMethod(options: DeliveryOptions): DeliveryMethod {
  if (options.pickup) return "PICKUP";
  if (options.home) return "HOME";
  return "BRANCH";
}

/** A dónde se cotiza, o `null` si todavía falta algo (o es retiro, que no se cotiza). */
function destino(d: DeliveryState): { method: "HOME" | "BRANCH"; postalCode: string; provinceCode: string } | null {
  if (d.method === "HOME") {
    const postalCode = normalizePostalCode(d.homePostalCode);
    return postalCode && d.homeProvince ? { method: "HOME", postalCode, provinceCode: d.homeProvince } : null;
  }
  if (d.method === "BRANCH" && d.agency && d.branchProvince) {
    return { method: "BRANCH", postalCode: d.agency.postalCode, provinceCode: d.branchProvince };
  }
  return null;
}

/**
 * Cotiza en vivo, medio segundo después del último cambio de CP, provincia, sucursal o carrito.
 * El resultado se guarda con la clave de lo que se cotizó: si la clave actual no coincide, se
 * está calculando (y una respuesta vieja nunca pisa a una nueva).
 *
 * `replace` pone a la vista la cotización que devolvió el servidor al confirmar (el envío cambió).
 * `retry` descarta el resultado de la clave actual (un error, típicamente) y vuelve a cotizar.
 */
export function useShippingQuote(
  workspaceSlug: string,
  delivery: DeliveryState,
  lines: CheckoutLine[],
  pickupEnabled: boolean,
): {
  view: QuoteView;
  replace: (q: { totalMinor: number; serviceName: string }) => void;
  retry: () => void;
} {
  const dest = destino(delivery);
  const clave = dest ? JSON.stringify([dest.method, dest.postalCode, dest.provinceCode, lines]) : null;
  const [resultado, setResultado] = useState<{ clave: string; view: QuoteView } | null>(null);
  // Cada "Reintentar" suma uno: cambia las dependencias del efecto y vuelve a cotizar la misma clave.
  const [intento, setIntento] = useState(0);
  const ultima = useRef<string | null>(null);
  const mensajeDeFalla = pickupEnabled
    ? "No pudimos calcular el envío. Probá de nuevo o elegí retiro en la sede."
    : "No pudimos calcular el envío. Probá de nuevo en unos minutos.";

  useEffect(() => {
    if (!clave) return;
    ultima.current = clave;
    const [method, postalCode, provinceCode, lineas] = JSON.parse(clave) as [string, string, string, typeof lines];
    const t = setTimeout(() => {
      quoteShippingAction(workspaceSlug, { method, postalCode, provinceCode, lines: lineas })
        .then((r) => {
          if (ultima.current !== clave) return;
          setResultado({
            clave,
            view: r.ok
              ? { status: "ok", totalMinor: r.totalMinor, serviceName: r.serviceName }
              : { status: "error", message: r.message },
          });
        })
        .catch(() => {
          if (ultima.current !== clave) return;
          setResultado({
            clave,
            view: { status: "error", message: mensajeDeFalla },
          });
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [clave, workspaceSlug, intento, mensajeDeFalla]);

  const replace = (q: { totalMinor: number; serviceName: string }) => {
    if (clave) setResultado({ clave, view: { status: "ok", totalMinor: q.totalMinor, serviceName: q.serviceName } });
  };

  const retry = () => {
    if (!clave) return;
    setResultado((r) => (r && r.clave === clave ? null : r));
    setIntento((n) => n + 1);
  };

  let view: QuoteView;
  if (delivery.method === "PICKUP") view = { status: "none" };
  else if (!clave) view = { status: "missing" };
  else if (!resultado || resultado.clave !== clave) view = { status: "loading" };
  else view = resultado.view;
  return { view, replace, retry };
}

type Props = {
  workspaceSlug: string;
  options: DeliveryOptions;
  delivery: DeliveryState;
  onChange: (next: DeliveryState) => void;
  quote: QuoteView;
  onRetryQuote: () => void;
  disabled: boolean;
  pickupLine: string | null;
  pickupInstructions: string | null;
  fieldErrors: Record<string, string>;
};

const ETIQUETAS: Record<DeliveryMethod, { titulo: string; detalle: string }> = {
  PICKUP: { titulo: "Retiro en la sede", detalle: "Sin costo" },
  HOME: { titulo: "Envío a domicilio", detalle: "Te lo llevamos a tu casa" },
  BRANCH: { titulo: "Envío a sucursal de Correo Argentino", detalle: "Lo retirás en la sucursal que elijas" },
};

/**
 * Cómo recibir la compra: retiro, domicilio o sucursal (sólo las formas que la institución dejó
 * activas). La dirección se lee del formulario al enviar; CP, provincia y sucursal viven en el
 * estado porque de ellos depende la cotización.
 */
export function DeliverySection({
  workspaceSlug,
  options,
  delivery,
  onChange,
  quote,
  onRetryQuote,
  disabled,
  pickupLine,
  pickupInstructions,
  fieldErrors,
}: Props) {
  const metodos = (["PICKUP", "HOME", "BRANCH"] as const).filter((m) =>
    m === "PICKUP" ? options.pickup : m === "HOME" ? options.home : options.branch,
  );
  const [agencias, setAgencias] = useState<{ province: string; list: PublicAgency[]; error: string | null } | null>(null);
  const [buscando, startBuscar] = useTransition();
  const pedidoSucursales = useRef(0);

  const error = (name: string) =>
    fieldErrors[name] ? (
      <span id={`${name}-error`} className="text-sm text-[var(--fo-danger)]">
        {fieldErrors[name]}
      </span>
    ) : null;
  const aria = (name: string) => ({
    "aria-invalid": fieldErrors[name] ? true : undefined,
    "aria-describedby": fieldErrors[name] ? `${name}-error` : undefined,
  });

  function elegirProvinciaSucursal(province: string) {
    onChange({ ...delivery, branchProvince: province, agency: null });
    if (!province) {
      setAgencias(null);
      return;
    }
    const numero = ++pedidoSucursales.current;
    startBuscar(async () => {
      const r = await listAgenciesAction(workspaceSlug, province).catch(() => null);
      if (numero !== pedidoSucursales.current) return;
      if (!r) {
        setAgencias({
          province,
          list: [],
          error: options.pickup
            ? "No pudimos traer las sucursales. Probá de nuevo o elegí retiro en la sede."
            : "No pudimos traer las sucursales. Probá de nuevo en unos minutos.",
        });
      } else if (!r.ok) {
        setAgencias({ province, list: [], error: r.message });
      } else {
        setAgencias({ province, list: r.agencies, error: null });
      }
    });
  }

  const listaActual = agencias && agencias.province === delivery.branchProvince ? agencias : null;

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <legend className="mb-2 text-lg font-semibold">Cómo recibís tu compra</legend>

      {metodos.length > 1 ? (
        <div className="grid gap-2" role="radiogroup" aria-label="Forma de entrega">
          {metodos.map((m) => (
            <label
              key={m}
              className={`fo-card flex cursor-pointer items-start gap-3 p-4 text-sm ${
                delivery.method === m ? "border-[var(--fo-accent)] ring-2 ring-[var(--fo-accent-muted)]" : ""
              }`}
            >
              <input
                type="radio"
                name="deliveryMethod"
                value={m}
                checked={delivery.method === m}
                onChange={() => onChange({ ...delivery, method: m })}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>
                <span className="block font-medium">{ETIQUETAS[m].titulo}</span>
                <span className="text-[var(--fo-muted)]">{ETIQUETAS[m].detalle}</span>
              </span>
            </label>
          ))}
        </div>
      ) : null}
      {error("delivery.method")}

      {delivery.method === "PICKUP" ? (
        <section className="fo-card space-y-1 p-4 text-sm">
          <h3 className="font-semibold">Retiro en sede</h3>
          {pickupLine ? <p>{pickupLine}</p> : <p className="text-[var(--fo-muted)]">La institución te avisa dónde retirar.</p>}
          {pickupInstructions ? <p className="text-[var(--fo-muted)]">{pickupInstructions}</p> : null}
          <p className="text-[var(--fo-muted)]">Sin costo de envío. Te avisamos por email cuando esté listo.</p>
        </section>
      ) : null}

      {delivery.method === "HOME" ? (
        <div className="space-y-4">
          {metodos.length === 1 ? <h3 className="font-semibold">Envío a domicilio</h3> : null}
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <label className="fo-field-stack">
              <span className="fo-label">Calle</span>
              <input name="street" autoComplete="address-line1" maxLength={120} className="fo-input text-base" {...aria("delivery.street")} />
              {error("delivery.street")}
            </label>
            <label className="fo-field-stack">
              <span className="fo-label">Altura</span>
              <input name="number" inputMode="numeric" maxLength={20} className="fo-input text-base" {...aria("delivery.number")} />
              {error("delivery.number")}
            </label>
          </div>
          <label className="fo-field-stack">
            <span className="fo-label">Piso y departamento (opcional)</span>
            <input name="floorApt" autoComplete="address-line2" maxLength={40} className="fo-input text-base" {...aria("delivery.floorApt")} />
            {error("delivery.floorApt")}
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Localidad</span>
            <input name="city" autoComplete="address-level2" maxLength={80} className="fo-input text-base" {...aria("delivery.city")} />
            {error("delivery.city")}
          </label>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <label className="fo-field-stack">
              <span className="fo-label">Provincia</span>
              <select
                className="fo-input text-base"
                value={delivery.homeProvince}
                onChange={(e) => onChange({ ...delivery, homeProvince: e.target.value })}
                {...aria("delivery.provinceCode")}
              >
                <option value="">Elegí la provincia</option>
                {PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
              {error("delivery.provinceCode")}
            </label>
            <label className="fo-field-stack">
              <span className="fo-label">Código postal</span>
              <input
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={8}
                placeholder="Ej. 2000"
                className="fo-input text-base"
                value={delivery.homePostalCode}
                onChange={(e) => onChange({ ...delivery, homePostalCode: e.target.value })}
                {...aria("delivery.postalCode")}
              />
              {error("delivery.postalCode")}
            </label>
          </div>
          <label className="fo-field-stack">
            <span className="fo-label">Teléfono de quien recibe (opcional)</span>
            <input name="recipientPhone" type="tel" autoComplete="tel" className="fo-input text-base" {...aria("delivery.recipientPhone")} />
            <span className="text-xs text-[var(--fo-muted)]">Si lo dejás vacío, usamos el tuyo.</span>
            {error("delivery.recipientPhone")}
          </label>
        </div>
      ) : null}

      {delivery.method === "BRANCH" ? (
        <div className="space-y-4">
          {metodos.length === 1 ? <h3 className="font-semibold">Envío a sucursal de Correo Argentino</h3> : null}
          <label className="fo-field-stack">
            <span className="fo-label">Provincia</span>
            <select
              className="fo-input text-base"
              value={delivery.branchProvince}
              onChange={(e) => elegirProvinciaSucursal(e.target.value)}
              {...aria("delivery.provinceCode")}
            >
              <option value="">Elegí la provincia</option>
              {PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
            {error("delivery.provinceCode")}
          </label>
          {delivery.branchProvince ? (
            buscando || !listaActual ? (
              <p className="text-sm text-[var(--fo-muted)]" role="status">
                Buscando sucursales…
              </p>
            ) : listaActual.error ? (
              <p className="text-sm text-[var(--fo-danger)]" role="alert">
                {listaActual.error}
              </p>
            ) : listaActual.list.length === 0 ? (
              <p className="text-sm text-[var(--fo-muted)]">
                No encontramos sucursales en esa provincia. Probá con otra forma de entrega.
              </p>
            ) : (
              <label className="fo-field-stack">
                <span className="fo-label">Sucursal</span>
                <select
                  className="fo-input text-base"
                  value={delivery.agency?.id ?? ""}
                  onChange={(e) =>
                    onChange({ ...delivery, agency: listaActual.list.find((a) => a.id === e.target.value) ?? null })
                  }
                  {...aria("delivery.agency")}
                >
                  <option value="">Elegí la sucursal</option>
                  {listaActual.list.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.city ? `${a.city} — ` : ""}
                      {a.name} ({a.address})
                    </option>
                  ))}
                </select>
                {error("delivery.agency")}
              </label>
            )
          ) : null}
        </div>
      ) : null}

      {delivery.method !== "PICKUP" ? (
        <div className="space-y-1 text-sm" aria-live="polite">
          {quote.status === "loading" ? <p className="text-[var(--fo-muted)]">Calculando envío…</p> : null}
          {quote.status === "missing" ? (
            <p className="text-[var(--fo-muted)]">
              {delivery.method === "HOME"
                ? "Completá la provincia y el código postal para calcular el envío."
                : "Elegí la provincia y la sucursal para calcular el envío."}
            </p>
          ) : null}
          {quote.status === "ok" ? (
            <p>
              {quote.serviceName}: <Price minor={quote.totalMinor} className="font-medium" />
            </p>
          ) : null}
          {quote.status === "error" ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[var(--fo-danger)]" role="alert">
                {quote.message}
              </p>
              <button type="button" className="fo-btn fo-btn-secondary" onClick={onRetryQuote}>
                Reintentar
              </button>
            </div>
          ) : null}
          {options.handlingNote ? <p className="text-[var(--fo-muted)]">{options.handlingNote}</p> : null}
        </div>
      ) : null}
    </fieldset>
  );
}
