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
      "¿Desconectar tu Mercado Pago?\n\nSe revoca el token guardado. No elimina historial financiero.",
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
          setError(data.error || data.message || "No se pudo desconectar");
          return;
        }
        router.refresh();
      } catch {
        setError("Error de red al desconectar");
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
          Conectá tu cuenta personal de Mercado Pago para poder recibir fondos cuando
          un acuerdo te asigne como receptor. Esto no modifica la cuenta owner de la
          plataforma.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!connected && canConnect && connectEnabled ? (
          <a
            href="/api/dnx-payments/partner/mercadopago/connect"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#009EE3] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0088cc]"
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
                    setError(data.error || "No se pudo iniciar reconexión");
                    return;
                  }
                  window.location.href = data.authorizeUrl;
                } catch {
                  setError("Error de red al reconectar");
                }
              });
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-ck-border px-5 text-sm font-semibold text-ck-text-primary hover:border-[#009EE3]"
          >
            Reconectar mi Mercado Pago
          </button>
        ) : null}

        {canRevoke ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleDisconnect}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-500/40 px-5 text-sm font-semibold text-red-300 hover:bg-red-500/10"
          >
            Desconectar mi Mercado Pago
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
