"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  connected: boolean;
  canConnect: boolean;
  canRevoke: boolean;
  canReconnect: boolean;
  connectEnabled: boolean;
  accountMasked: string | null;
  statusLabel: string;
};

function humanizeConnectError(raw: string | undefined): string {
  if (!raw) return "No pudimos completar la acción. Intentá nuevamente.";
  if (/invalid_grant|token_expired|refresh_token|oauth|pkce/i.test(raw)) {
    return "La conexión con Mercado Pago necesita actualizarse. Volvé a conectar la cuenta.";
  }
  return raw.slice(0, 200);
}

export function PartnerMpConnectActions({
  connected,
  canConnect,
  canRevoke,
  canReconnect,
  connectEnabled,
  accountMasked,
  statusLabel,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setError(null);
    const ok = window.confirm(
      [
        "¿Desconectar tu Mercado Pago?",
        "",
        "Mientras esté desconectada, no podrás recibir nuevos pagos asignados a esta cuenta.",
        "El historial financiero no se elimina.",
        "Podés volver a conectar después.",
      ].join("\n"),
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/dnx-payments/partner/mercadopago/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reinforcedConfirm: true }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          message?: string;
        };
        if (!res.ok || !data.ok) {
          setError(humanizeConnectError(data.error || data.message));
          return;
        }
        router.refresh();
      } catch {
        setError("No pudimos desconectar la cuenta. Intentá nuevamente.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-ck-border bg-ck-bg-elevated px-4 py-3 text-sm">
        <p className="font-medium text-ck-text-primary">Estado: {statusLabel}</p>
        {accountMasked ? (
          <p className="mt-1 text-xs text-ck-text-muted">Cuenta: {accountMasked}</p>
        ) : null}
      </div>

      {connected ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-ck-text">
          <p className="font-medium text-emerald-300">Tu Mercado Pago está conectado</p>
          <p className="mt-1 text-xs text-ck-text-muted">
            No se muestran tokens. Conectar no asigna porcentajes.
          </p>
        </div>
      ) : (
        <p className="text-sm text-ck-text-secondary">
          Conectá tu cuenta personal de Mercado Pago para poder recibir fondos cuando un
          acuerdo te asigne como receptor. Esto no modifica la cuenta principal de la
          plataforma.
        </p>
      )}

      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {!connected && canConnect && connectEnabled ? (
          <a
            href="/api/dnx-payments/partner/mercadopago/connect"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#009EE3] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0088cc] sm:w-auto"
          >
            Conectar Mercado Pago
          </a>
        ) : null}

        {connected && canReconnect && connectEnabled ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  const res = await fetch(
                    "/api/dnx-payments/partner/mercadopago/reconnect?format=json",
                    { method: "POST" },
                  );
                  const data = (await res.json().catch(() => ({}))) as {
                    ok?: boolean;
                    authorizeUrl?: string;
                    error?: string;
                  };
                  if (!res.ok || !data.ok || !data.authorizeUrl) {
                    setError(humanizeConnectError(data.error));
                    return;
                  }
                  window.location.href = data.authorizeUrl;
                } catch {
                  setError("No pudimos iniciar la reconexión. Intentá nuevamente.");
                }
              });
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-ck-border px-5 text-sm font-semibold text-ck-text-primary hover:border-[#009EE3] sm:w-auto"
          >
            {pending ? "Redirigiendo…" : "Volver a conectar"}
          </button>
        ) : null}

        {canRevoke ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleDisconnect}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-red-500/40 px-5 text-sm font-semibold text-red-300 hover:bg-red-500/10 sm:w-auto"
          >
            {pending ? "Desconectando…" : "Desconectar cuenta"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
