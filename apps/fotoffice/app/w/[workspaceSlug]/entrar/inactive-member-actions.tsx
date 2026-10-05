"use client";

import { useState, useTransition } from "react";
import {
  requestReactivationContactAction,
  startReactivationPaymentAction,
} from "./reactivar-actions";

/**
 * Los dos botones del socio de baja. Pagar lleva a Mercado Pago (una URL externa: va el
 * navegador, no un `redirect` del servidor); pedir contacto se queda acá y confirma.
 */
export function InactiveMemberActions({
  workspaceSlug,
  payLabel,
}: {
  workspaceSlug: string;
  /** `null` si no debe nada: sólo queda pedir contacto. */
  payLabel: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [accion, setAccion] = useState<"pagar" | "contacto" | null>(null);
  const [pendiente, startTransition] = useTransition();

  function pagar() {
    setError(null);
    setAccion("pagar");
    startTransition(async () => {
      const r = await startReactivationPaymentAction(workspaceSlug);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.checkoutUrl) window.location.href = r.checkoutUrl;
    });
  }

  function contacto() {
    setError(null);
    setAccion("contacto");
    startTransition(async () => {
      const r = await requestReactivationContactAction(workspaceSlug);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setAviso(r.message ?? "Listo.");
    });
  }

  if (aviso) {
    return (
      <p className="rounded-lg border border-[var(--fo-success-border)] bg-[var(--fo-success-soft)] p-3 text-sm leading-relaxed" role="status">
        {aviso}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2">
        {payLabel ? (
          <button
            type="button"
            onClick={pagar}
            disabled={pendiente}
            className="fo-btn fo-btn-primary w-full min-h-11 disabled:opacity-60"
          >
            {pendiente && accion === "pagar" ? "Abriendo el pago…" : payLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={contacto}
          disabled={pendiente}
          className={`fo-btn ${payLabel ? "fo-btn-secondary" : "fo-btn-primary"} w-full min-h-11 disabled:opacity-60`}
        >
          {pendiente && accion === "contacto" ? "Avisando…" : "Pedir que me contacten"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
