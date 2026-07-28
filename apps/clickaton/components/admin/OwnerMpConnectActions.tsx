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
};

export function OwnerMpConnectActions({
  connected,
  canConnect,
  canRevoke,
  canReconnect,
  connectEnabled,
  accountMasked,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setError(null);
    const ok = window.confirm(
      "¿Desconectar la cuenta owner de Mercado Pago?\n\nSe revoca el token guardado. No se pueden cobrar hasta reconectar.",
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch(
          "/api/clickaton/payments/mercadopago/revoke",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reinforcedConfirm: true }),
          },
        );
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
      {connected ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-ck-text">
          <p className="font-medium text-emerald-300">
            Conectado con Mercado Pago
          </p>
          {accountMasked ? (
            <p className="mt-1 text-xs text-ck-text-muted">
              Cuenta: {accountMasked}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-ck-text-secondary">
          Inicia el consentimiento OAuth LIVE en el dominio oficial de Mercado
          Pago. No se muestran tokens ni secretos en esta pantalla.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!connected && canConnect && connectEnabled ? (
          <a
            href="/api/clickaton/payments/mercadopago/connect"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#009EE3] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0088cc]"
          >
            <MpGlyph />
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
                    "/api/clickaton/payments/mercadopago/reconnect?format=json",
                    { method: "POST" },
                  );
                  const data = (await res.json().catch(() => ({}))) as {
                    ok?: boolean;
                    authorizeUrl?: string;
                    error?: string;
                    message?: string;
                  };
                  if (!res.ok || !data.ok || !data.authorizeUrl) {
                    setError(
                      data.error || data.message || "No se pudo reconectar",
                    );
                    return;
                  }
                  window.location.href = data.authorizeUrl;
                } catch {
                  setError("Error de red al reconectar");
                }
              });
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#009EE3] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0088cc] disabled:opacity-50"
          >
            <MpGlyph />
            {pending ? "Redirigiendo…" : "Reconectar Mercado Pago"}
          </button>
        ) : null}

        {connected && canRevoke ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-ck-border bg-transparent px-5 text-sm font-semibold text-ck-text transition-colors hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
          >
            {pending ? "Desconectando…" : "Desconectar Mercado Pago"}
          </button>
        ) : null}

        {!connected && !connectEnabled ? (
          <p className="rounded-md border border-ck-border bg-ck-surface px-4 py-3 text-ck-text-secondary">
            Botón de conexión bloqueado hasta completar credenciales de app MP y
            la autorización manual.
          </p>
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

function MpGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
        fill="white"
        opacity="0.35"
      />
      <rect x="7" y="9" width="10" height="6" rx="1" fill="white" />
      <path
        d="M9 11h6M9 13h4"
        stroke="#009EE3"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
