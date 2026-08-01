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

function humanizeConnectError(raw: string | undefined): string {
  if (!raw) return "No pudimos completar la acción. Intentá nuevamente.";
  if (/invalid_grant|token_expired|refresh_token|oauth|pkce/i.test(raw)) {
    return "La conexión con Mercado Pago necesita actualizarse. Volvé a conectar la cuenta.";
  }
  if (/network|fetch|failed to fetch/i.test(raw)) {
    return "No pudimos contactar a Mercado Pago. Revisá la conexión e intentá nuevamente.";
  }
  return raw.slice(0, 200);
}

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
      [
        "¿Desconectar esta cuenta?",
        "",
        "Mientras esté desconectada, no se podrán iniciar nuevos cobros con esta cuenta receptora.",
        "Los pagos ya registrados no se eliminan.",
        "Podés volver a conectar la misma cuenta después.",
      ].join("\n"),
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/clickaton/payments/mercadopago/revoke", {
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
      {connected ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-ck-text">
          <p className="font-medium text-emerald-300">Conectado con Mercado Pago</p>
          {accountMasked ? (
            <p className="mt-1 text-xs text-ck-text-muted">Cuenta: {accountMasked}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ck-text-secondary">
          Serás redirigido a Mercado Pago para autorizar la conexión. Clickatón no pide ni
          guarda tu contraseña de Mercado Pago.
        </p>
      )}

      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {!connected && canConnect && connectEnabled ? (
          <a
            href="/api/clickaton/payments/mercadopago/connect"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#009EE3] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0088cc] sm:w-auto"
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
                    setError(humanizeConnectError(data.error || data.message));
                    return;
                  }
                  window.location.href = data.authorizeUrl;
                } catch {
                  setError("No pudimos iniciar la reconexión. Intentá nuevamente.");
                }
              });
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[#009EE3] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0088cc] disabled:opacity-50 sm:w-auto"
          >
            <MpGlyph />
            {pending ? "Redirigiendo…" : "Volver a conectar"}
          </button>
        ) : null}

        {connected && canRevoke ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={pending}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-ck-border bg-transparent px-5 text-sm font-semibold text-ck-text transition-colors hover:border-red-400/50 hover:text-red-300 disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Desconectando…" : "Desconectar cuenta"}
          </button>
        ) : null}

        {!connected && !connectEnabled ? (
          <p className="w-full rounded-md border border-ck-border bg-ck-surface px-4 py-3 text-ck-text-secondary">
            La conexión está bloqueada hasta completar la configuración de la aplicación y
            la autorización manual del responsable.
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
