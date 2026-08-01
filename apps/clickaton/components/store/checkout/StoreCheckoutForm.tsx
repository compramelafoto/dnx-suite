"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStoreCart } from "@/components/store/cart/StoreCartProvider";
import { StoreCartIssues } from "@/components/store/cart/StoreCartIssues";
import { StoreCheckoutSummary } from "@/components/store/checkout/StoreCheckoutSummary";
import { StoreCustomerFields } from "@/components/store/checkout/StoreCustomerFields";
import { StoreDeliverySelector } from "@/components/store/checkout/StoreDeliverySelector";
import { StoreLegalAcceptances } from "@/components/store/checkout/StoreLegalAcceptances";
import { StoreCheckoutIssues } from "@/components/store/checkout/StoreCheckoutIssues";
import { Button } from "@/components/ui/Button";
import { routes } from "@/config/navigation";
import { STORE_LEGAL_VERSION } from "@/lib/public-store/checkout/legal";
import { STORE_PICKUP_POINTS } from "@/lib/public-store/checkout/pickup";

type StoreCheckoutFormProps = {
  checkoutEnabled: boolean;
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `store_${crypto.randomUUID()}`;
  }
  return `store_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function StoreCheckoutForm({ checkoutEnabled }: StoreCheckoutFormProps) {
  const router = useRouter();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const {
    items,
    itemCount,
    hydrationState,
    validatedCart,
    validationState,
    refreshValidation,
  } = useStoreCart();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupPointId, setPickupPointId] = useState(
    STORE_PICKUP_POINTS[0]?.id ?? "clickaton-default",
  );
  const [pickupPersonName, setPickupPersonName] = useState("");
  const [acceptPurchase, setAcceptPurchase] = useState(false);
  const [acceptReturns, setAcceptReturns] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey] = useState(newIdempotencyKey);

  useEffect(() => {
    if (hydrationState === "ready" && itemCount > 0) {
      void refreshValidation();
    }
  }, [hydrationState, itemCount, refreshValidation]);

  const canSubmit = useMemo(() => {
    if (!checkoutEnabled) return false;
    if (!validatedCart?.checkoutReady) return false;
    if (!acceptPurchase || !acceptReturns || !acceptPrivacy) return false;
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      return false;
    }
    if (!pickupPersonName.trim()) return false;
    return !submitting;
  }, [
    checkoutEnabled,
    validatedCart?.checkoutReady,
    acceptPurchase,
    acceptReturns,
    acceptPrivacy,
    firstName,
    lastName,
    email,
    phone,
    pickupPersonName,
    submitting,
  ]);

  if (!checkoutEnabled) {
    return (
      <div className="space-y-6 rounded-[var(--ck-radius-md)] border border-ck-border bg-ck-surface p-6 md:p-8">
        <h2 className="ck-heading-md">Checkout no disponible</h2>
        <p className="ck-body text-ck-text-secondary">
          El checkout de la Tienda está deshabilitado. Podés seguir explorando productos y
          armando el carrito.
        </p>
        <p className="ck-caption text-ck-text-muted">
          Acción legal requerida antes de producción.
        </p>
        <Button href={routes.storeCart} variant="secondary">
          Volver al carrito
        </Button>
      </div>
    );
  }

  if (hydrationState === "loading") {
    return <p className="ck-body-sm text-ck-text-muted">Cargando carrito…</p>;
  }

  if (itemCount === 0) {
    return (
      <div className="space-y-6">
        <p className="ck-body text-ck-text-secondary">Tu carrito está vacío.</p>
        <Button href={routes.store} variant="primary">
          Ir a la tienda
        </Button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/store/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
          customer: { firstName, lastName, email, phone },
          deliveryMethod: "PICKUP",
          delivery: {
            kind: "PICKUP",
            pickupPointId,
            pickupPersonName: pickupPersonName.trim() || `${firstName} ${lastName}`.trim(),
          },
          legal: {
            acceptedPurchaseTerms: true,
            acceptedReturnsPolicy: true,
            acceptedPrivacy: true,
            legalVersion: STORE_LEGAL_VERSION,
          },
          idempotencyKey,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        checkoutUrl?: string | null;
        orderPath?: string;
        publicId?: string;
      };
      if (!res.ok || !data.ok) {
        setFormError(data.error ?? "No se pudo crear el pedido.");
        errorRef.current?.focus();
        return;
      }
      try {
        const body = data as {
          commercialFingerprint?: string;
          purchasedItems?: Array<{ productId: string; variantId: string | null }>;
        };
        if (body.commercialFingerprint) {
          sessionStorage.setItem(
            "ck_store_pending_clear",
            JSON.stringify({
              commercialFingerprint: body.commercialFingerprint,
              items: body.purchasedItems ?? [],
            }),
          );
        }
      } catch {
        /* ignore */
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (data.orderPath) {
        router.push(data.orderPath);
        return;
      }
      setFormError("Pedido creado, pero no hay URL de pago. Revisá el detalle del pedido.");
    } catch {
      setFormError("Error de red. Reintentá en unos segundos.");
      errorRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
      noValidate
    >
      <div className="min-w-0 space-y-10">
        <div
          ref={errorRef}
          tabIndex={-1}
          aria-live="polite"
          className="outline-none"
        >
          <StoreCheckoutIssues message={formError} />
        </div>

        {validationState === "loading" && !validatedCart ? (
          <p className="ck-body-sm text-ck-text-muted">Validando carrito…</p>
        ) : null}

        <StoreCartIssues
          issues={validatedCart?.issues}
          lines={validatedCart?.lines}
        />

        {!validatedCart?.checkoutReady ? (
          <div className="space-y-4 rounded-[var(--ck-radius-md)] border border-[var(--ck-warning)]/40 bg-[var(--ck-warning-soft)] p-6">
            <p className="ck-body-sm text-ck-text" role="alert">
              Corregí el carrito antes de confirmar la compra.
            </p>
            <Button href={routes.storeCart} variant="secondary" size="sm">
              Volver al carrito
            </Button>
          </div>
        ) : null}

        <StoreCustomerFields
          firstName={firstName}
          lastName={lastName}
          email={email}
          phone={phone}
          onChange={{
            firstName: setFirstName,
            lastName: setLastName,
            email: setEmail,
            phone: setPhone,
          }}
          disabled={submitting}
        />

        <StoreDeliverySelector
          pickupPointId={pickupPointId}
          pickupPersonName={pickupPersonName}
          onPickupPointChange={setPickupPointId}
          onPickupPersonNameChange={setPickupPersonName}
          disabled={submitting}
        />

        <StoreLegalAcceptances
          acceptPurchase={acceptPurchase}
          acceptReturns={acceptReturns}
          acceptPrivacy={acceptPrivacy}
          onChange={{
            purchase: setAcceptPurchase,
            returns: setAcceptReturns,
            privacy: setAcceptPrivacy,
          }}
          disabled={submitting}
        />

        <div className="border-t border-ck-border pt-8">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            className="w-full sm:w-auto"
            data-testid="store-checkout-submit"
          >
            {submitting ? "Creando pedido…" : "Confirmar y pagar"}
          </Button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-28">
        <StoreCheckoutSummary
          totals={
            validatedCart?.totals ?? {
              currency: "ARS",
              subtotalMinor: 0,
              validUnitCount: 0,
              requestedUnitCount: itemCount,
              validLineCount: 0,
              issueCount: 0,
            }
          }
          deliveryAmount={0}
        />
      </aside>
    </form>
  );
}
