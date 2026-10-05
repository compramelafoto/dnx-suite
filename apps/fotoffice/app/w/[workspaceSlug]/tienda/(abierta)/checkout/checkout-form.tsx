"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { checkoutKeyFor, checkoutLinesSignature, lineKey, renewCheckoutKey } from "@/lib/store/cart";
import { STORE_HOLD_MINUTES } from "@/lib/store/constants";
import type { CartProblem } from "@/lib/store/storefront";
import { useCart } from "@/components/store/cart-provider";
import { useCartRevalidation } from "@/components/store/use-cart-revalidation";
import { Price } from "@/components/store/price";
import type { CheckoutDelivery } from "@/lib/store/checkout-input";
import type { DeliveryOptions } from "@/lib/store/shipping/checkout";
import { placeOrderAction } from "./actions";
import { DeliverySection, firstMethod, useShippingQuote, type DeliveryState } from "./delivery-section";

type Props = {
  storeHref: string;
  cartHref: string;
  termsHref: string;
  pickupLine: string | null;
  pickupInstructions: string | null;
  deliveryOptions: DeliveryOptions;
};

function texto(datos: FormData, nombre: string): string {
  return String(datos.get(nombre) ?? "");
}

/**
 * El checkout: datos de quien compra, cómo recibe la compra (retiro, domicilio o sucursal, con el
 * envío cotizado en vivo), aceptación de los términos y el resumen del carrito revalidado en el
 * servidor. Con envío, no se puede pagar sin una cotización buena. "Pagar con Mercado Pago" crea el pedido (que retiene el
 * stock 15 minutos) y lleva a pagar.
 *
 * La clave de compra se genera una vez por carrito (`checkoutKeyFor`): apretar dos veces, o
 * reintentar después de un error, no crea dos pedidos.
 */
export function CheckoutForm({
  storeHref,
  cartHref,
  termsHref,
  pickupLine,
  pickupInstructions,
  deliveryOptions,
}: Props) {
  const { workspaceSlug, state, hydrated, itemsCount, subtotalMinor } = useCart();
  const revision = useCartRevalidation();
  const [enviando, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [frenos, setFrenos] = useState<CartProblem[]>([]);
  const [delivery, setDelivery] = useState<DeliveryState>(() => ({
    method: firstMethod(deliveryOptions),
    homeProvince: "",
    homePostalCode: "",
    branchProvince: "",
    agency: null,
  }));
  const quoteLines = useMemo(
    () => state.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty })),
    [state.lines],
  );
  const {
    view: quote,
    replace: reemplazarCotizacion,
    retry: reintentarCotizacion,
  } = useShippingQuote(workspaceSlug, delivery, quoteLines, deliveryOptions.pickup);

  if (!hydrated) return <p className="text-sm text-[var(--fo-muted)]">Cargando el carrito…</p>;

  if (state.lines.length === 0) {
    return (
      <div className="fo-card space-y-4 p-6 text-center">
        <p className="text-sm text-[var(--fo-muted)]">Tu carrito está vacío.</p>
        <Link href={storeHref} className="fo-btn fo-btn-primary">
          Ver productos
        </Link>
      </div>
    );
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const lines = state.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty }));
    const sig = checkoutLinesSignature(lines);
    const clientIdempotencyKey = checkoutKeyFor(workspaceSlug, sig);
    let entrega: CheckoutDelivery | Record<string, unknown>;
    if (delivery.method === "HOME") {
      entrega = {
        method: "HOME",
        address: {
          street: texto(datos, "street"),
          number: texto(datos, "number"),
          floorApt: texto(datos, "floorApt"),
          city: texto(datos, "city"),
          provinceCode: delivery.homeProvince,
          postalCode: delivery.homePostalCode,
          recipientPhone: texto(datos, "recipientPhone"),
        },
      };
    } else if (delivery.method === "BRANCH") {
      entrega = {
        method: "BRANCH",
        provinceCode: delivery.branchProvince,
        agency: delivery.agency
          ? { id: delivery.agency.id, name: delivery.agency.name, address: delivery.agency.address }
          : null,
      };
    } else {
      entrega = { method: "PICKUP" };
    }

    setError(null);
    setFieldErrors({});
    setFrenos([]);
    startTransition(async () => {
      // Si sale bien, la acción no vuelve: redirige a Mercado Pago.
      const r = await placeOrderAction(workspaceSlug, {
        buyerName: String(datos.get("buyerName") ?? ""),
        buyerEmail: String(datos.get("buyerEmail") ?? ""),
        buyerPhone: String(datos.get("buyerPhone") ?? ""),
        acceptsTerms: datos.get("acceptsTerms") === "on",
        clientIdempotencyKey,
        lines,
        delivery: entrega,
        // Sólo para comparar: el servidor vuelve a cotizar y cobra lo suyo.
        shownShippingMinor: delivery.method !== "PICKUP" && quote.status === "ok" ? quote.totalMinor : null,
      });
      if (!r) return;
      if (r.renewKey) renewCheckoutKey(workspaceSlug, sig);
      setError(r.error);
      setFieldErrors(r.fieldErrors ?? {});
      // El envío subió desde que lo vio: se muestra el precio nuevo y vuelve a confirmar.
      if (r.shippingChanged) reemplazarCotizacion(r.shippingChanged);
      if (r.problems && r.problems.length > 0) {
        setFrenos(r.problems);
        // Algo se agotó o cambió mientras completaba los datos: se corrige el carrito a la vista.
        revision.revalidate();
      }
    });
  }

  const avisos = [...frenos, ...revision.problems];
  // Retiro no se cotiza; con envío hace falta una cotización buena para pagar.
  const faltaEnvio = delivery.method !== "PICKUP" && quote.status !== "ok";
  const envioMinor = quote.status === "ok" ? quote.totalMinor : 0;
  const bloqueado = enviando || revision.validando || revision.error !== null || faltaEnvio;
  const campo = (name: string) =>
    fieldErrors[name] ? (
      <span id={`${name}-error`} className="text-sm text-[var(--fo-danger)]">
        {fieldErrors[name]}
      </span>
    ) : null;

  return (
    <form onSubmit={enviar} className="grid gap-8 md:grid-cols-[1fr_minmax(0,22rem)]" noValidate>
      <div className="space-y-6">
        <fieldset className="space-y-4" disabled={enviando}>
          <legend className="mb-2 text-lg font-semibold">Tus datos</legend>
          <label className="fo-field-stack">
            <span className="fo-label">Nombre y apellido</span>
            <input
              name="buyerName"
              autoComplete="name"
              required
              minLength={2}
              className="fo-input text-base"
              aria-invalid={fieldErrors.buyerName ? true : undefined}
              aria-describedby={fieldErrors.buyerName ? "buyerName-error" : undefined}
            />
            {campo("buyerName")}
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Email</span>
            <input
              name="buyerEmail"
              type="email"
              autoComplete="email"
              required
              className="fo-input text-base"
              aria-invalid={fieldErrors.buyerEmail ? true : undefined}
              aria-describedby={fieldErrors.buyerEmail ? "buyerEmail-error" : undefined}
            />
            <span className="text-xs text-[var(--fo-muted)]">Ahí te mandamos la confirmación y los avisos de tu pedido.</span>
            {campo("buyerEmail")}
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Teléfono (opcional)</span>
            <input
              name="buyerPhone"
              type="tel"
              autoComplete="tel"
              className="fo-input text-base"
              aria-invalid={fieldErrors.buyerPhone ? true : undefined}
              aria-describedby={fieldErrors.buyerPhone ? "buyerPhone-error" : undefined}
            />
            {campo("buyerPhone")}
          </label>
        </fieldset>

        <DeliverySection
          workspaceSlug={workspaceSlug}
          options={deliveryOptions}
          delivery={delivery}
          onChange={setDelivery}
          quote={quote}
          onRetryQuote={reintentarCotizacion}
          disabled={enviando}
          pickupLine={pickupLine}
          pickupInstructions={pickupInstructions}
          fieldErrors={fieldErrors}
        />

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acceptsTerms" required className="mt-1 h-4 w-4 shrink-0" disabled={enviando} />
          <span>
            Acepto los{" "}
            <Link href={termsHref} target="_blank" className="underline underline-offset-4">
              términos y la política de cambios y devoluciones
            </Link>
            .
          </span>
        </label>
        {campo("acceptsTerms")}
      </div>

      <aside className="space-y-4">
        <div className="fo-card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Tu compra</h2>
          <ul className="space-y-3">
            {state.lines.map((l) => (
              <li key={lineKey(l)} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{l.name}</span>
                  <span className="text-xs text-[var(--fo-muted)]">
                    {l.variantName ? `Talle ${l.variantName} · ` : ""}
                    {l.qty} × <Price minor={l.unitPriceMinor} />
                  </span>
                </span>
                <Price minor={l.unitPriceMinor * l.qty} className="shrink-0 font-medium" />
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-[var(--fo-border)] pt-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[var(--fo-muted)]">
                Productos ({itemsCount} {itemsCount === 1 ? "unidad" : "unidades"})
              </span>
              <Price minor={subtotalMinor} />
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[var(--fo-muted)]">Envío</span>
              {delivery.method === "PICKUP" ? (
                <span>Sin costo (retiro)</span>
              ) : quote.status === "ok" ? (
                <Price minor={quote.totalMinor} />
              ) : quote.status === "loading" ? (
                <span className="text-[var(--fo-muted)]">Calculando envío…</span>
              ) : (
                <span className="text-[var(--fo-muted)]">A calcular</span>
              )}
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-[var(--fo-border)] pt-3">
            <span className="text-sm text-[var(--fo-muted)]">Total</span>
            <Price minor={subtotalMinor + envioMinor} className="text-xl font-semibold" />
          </div>

          {avisos.length > 0 || revision.error ? (
            <div className="space-y-1 text-sm" role="status">
              {revision.error ? <p className="text-[var(--fo-danger)]">{revision.error}</p> : null}
              {avisos.length > 0 ? (
                <>
                  <p className="font-medium">Actualizamos tu carrito:</p>
                  <ul className="list-disc space-y-1 pl-5 text-[var(--fo-muted)]">
                    {avisos.map((p, i) => (
                      <li key={`${p.key}-${i}`}>{p.message}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">
              {error}
            </p>
          ) : null}

          <button type="submit" className="fo-btn fo-btn-primary w-full" disabled={bloqueado}>
            {enviando
              ? "Abriendo el pago…"
              : revision.validando
                ? "Revisando el carrito…"
                : quote.status === "loading"
                  ? "Calculando envío…"
                  : "Pagar con Mercado Pago"}
          </button>
          <p className="text-xs text-[var(--fo-muted)]">
            Al confirmar te reservamos los productos durante {STORE_HOLD_MINUTES} minutos mientras pagás.
          </p>
          <Link href={cartHref} className="block text-center text-sm underline underline-offset-4 opacity-80 hover:opacity-100">
            Volver al carrito
          </Link>
        </div>
      </aside>
    </form>
  );
}
