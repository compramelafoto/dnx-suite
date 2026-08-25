"use client";

import { useActionState } from "react";
import {
  refreshSplitConsentAction,
  requestSplitConsentAction,
  type ConsentState,
} from "@/app/actions/split-consent";

const initial: ConsentState = { error: null, ok: null };

/**
 * Autorización de cobro dividido.
 *
 * El consentimiento se otorga **en MercadoPago**, no acá: es el receptor autorizando que le
 * manden dinero en operaciones que cobra otro. Lo que hacemos es enviarle la solicitud y
 * darle el enlace, para que no tenga que ir a buscar nada por su cuenta.
 */
export function SplitConsentPanel({
  consent,
  savedInviteUrl,
}: {
  consent: string;
  savedInviteUrl: string | null;
}) {
  const [reqState, request, requesting] = useActionState(requestSplitConsentAction, initial);
  const [refState, refresh, refreshing] = useActionState(refreshSplitConsentAction, initial);

  const state = reqState.error || reqState.ok ? reqState : refState;
  const inviteUrl = reqState.inviteUrl ?? savedInviteUrl;
  const yaPedido = consent !== "NONE";

  if (consent === "ACTIVE") {
    return (
      <p className="text-xs text-[var(--fo-success)]">
        ✓ Cobro dividido autorizado en MercadoPago.
      </p>
    );
  }

  return (
    <div className="space-y-3 border-t border-[var(--fo-border)] pt-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Autorizar el cobro dividido</h3>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          MercadoPago necesita que autorices recibir tu parte cuando el cobro lo procesa la
          plataforma. Es <strong>una sola vez</strong>, y se hace en MercadoPago.
        </p>
      </div>

      {!yaPedido ? (
        <form action={request} className="space-y-2">
          <label className="fo-label" htmlFor="sellerEmail">
            Email de tu cuenta de MercadoPago
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="sellerEmail"
              name="sellerEmail"
              type="email"
              required
              className="fo-input flex-1 text-sm"
              placeholder="cuenta@ejemplo.com"
            />
            <button
              type="submit"
              disabled={requesting}
              className="fo-btn fo-btn-primary text-sm min-h-10"
            >
              {requesting ? "Enviando…" : "Solicitar autorización"}
            </button>
          </div>
          <p className="fo-helper">
            Tiene que ser el correo de la cuenta de MercadoPago que conectaste, que puede ser
            distinto al de tu institución.
          </p>
        </form>
      ) : null}

      {inviteUrl ? (
        <a
          href={inviteUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="fo-btn fo-btn-primary inline-flex text-sm"
        >
          Autorizar en MercadoPago →
        </a>
      ) : null}

      {yaPedido ? (
        <form action={refresh}>
          <button
            type="submit"
            disabled={refreshing}
            className="fo-btn fo-btn-secondary text-sm min-h-9"
          >
            {refreshing ? "Consultando…" : "Ya autoricé, verificar"}
          </button>
        </form>
      ) : null}

      {state.error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="text-xs text-[var(--fo-success)]">{state.ok}</p> : null}
    </div>
  );
}
