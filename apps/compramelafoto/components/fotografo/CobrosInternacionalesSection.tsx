"use client";

import { useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsField } from "@/components/ui/DsField";
import type { CollectionAccountView } from "@/lib/international/collection-access";
import { getCountry } from "@/lib/international/countries";
import IntlCollectionInstructions from "@/components/fotografo/IntlCollectionInstructions";

type Provider = "MERCADOPAGO_OWN" | "PAYPAL_OWN";

const API = "/api/fotografo/cobros-internacionales";
const AR_TZ = "America/Argentina/Buenos_Aires";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", { timeZone: AR_TZ });
}

export default function CobrosInternacionalesSection({
  onAvailability,
}: {
  onAvailability: (available: boolean) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [provider, setProvider] = useState<Provider>("MERCADOPAGO_OWN");
  const [account, setAccount] = useState<CollectionAccountView | null>(null);
  const [editing, setEditing] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState<null | "save" | "test" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const onAvailabilityRef = useRef(onAvailability);
  onAvailabilityRef.current = onAvailability;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.available === true && (data.provider === "MERCADOPAGO_OWN" || data.provider === "PAYPAL_OWN")) {
          setProvider(data.provider);
          setAccount(data.account ?? null);
          setAvailable(true);
          onAvailabilityRef.current(true);
        } else {
          onAvailabilityRef.current(false);
        }
      } catch {
        if (!cancelled) onAvailabilityRef.current(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  const providerName = provider === "PAYPAL_OWN" ? "PayPal" : "Mercado Pago";
  const showForm = !account || editing;
  const canSave =
    provider === "PAYPAL_OWN" ? clientId.trim() !== "" && clientSecret.trim() !== "" : accessToken.trim() !== "";

  async function request(url: string, init: RequestInit, kind: "save" | "test" | "delete") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "No pudimos completar la operación. Probá de nuevo.");
        return null;
      }
      return data;
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    const body =
      provider === "PAYPAL_OWN"
        ? { provider, clientId: clientId.trim(), clientSecret: clientSecret.trim() }
        : { provider, accessToken: accessToken.trim() };
    const data = await request(
      API,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      "save",
    );
    if (data?.account) {
      setAccount(data.account);
      setAccessToken("");
      setClientId("");
      setClientSecret("");
      setEditing(false);
    }
  }

  async function handleTest() {
    const data = await request(`${API}/probar`, { method: "POST" }, "test");
    if (data?.account) setAccount(data.account);
  }

  async function handleDelete() {
    if (!confirm("¿Desconectar esta cuenta? Tus álbumes no van a poder vender hasta que conectes otra.")) return;
    const data = await request(API, { method: "DELETE" }, "delete");
    if (data?.ok) {
      setAccount(null);
      setEditing(false);
    }
  }

  return (
    <Card className="space-y-6">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Cobros con {providerName}</h2>

      {account ? (
        <div className="space-y-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 text-[#1a1a1a]">
          {account.accountLabel ? <p className="break-words font-medium">{account.accountLabel}</p> : null}
          <p className="text-sm">Termina en ···{account.secretLast4}</p>
          {account.accountCountryCode ? (
            <p className="text-sm">
              País de la cuenta: {getCountry(account.accountCountryCode)?.name ?? account.accountCountryCode}
            </p>
          ) : null}
          <p className="text-sm text-[#6b7280]">Conectada el {formatDate(account.connectedAt)}</p>
          {account.lastCheckedAt ? (
            <p className="text-sm text-[#6b7280]">Última comprobación {formatDate(account.lastCheckedAt)}</p>
          ) : null}
          {account.warning ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{account.warning}</p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="secondary" size="sm" onClick={handleTest} disabled={busy !== null}>
              {busy === "test" ? "Probando conexión…" : "Probar conexión"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={busy !== null || editing}>
              Cambiar credenciales
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete} disabled={busy !== null}>
              {busy === "delete" ? "Desconectando…" : "Desconectar"}
            </Button>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-[#6b7280]">
            Tus clientes te pagan directo a tu cuenta. Pegá las credenciales de tu propia aplicación; las guardamos cifradas y
            nunca se vuelven a mostrar completas.
          </p>
          {provider === "PAYPAL_OWN" ? (
            <>
              <DsField label="Client ID" htmlFor="intl-client-id">
                <Input
                  id="intl-client-id"
                  type="text"
                  autoComplete="off"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </DsField>
              <DsField label="Secret" htmlFor="intl-client-secret">
                <Input
                  id="intl-client-secret"
                  type="password"
                  autoComplete="new-password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </DsField>
            </>
          ) : (
            <DsField label="Access Token de producción" htmlFor="intl-access-token">
              <Input
                id="intl-access-token"
                type="password"
                autoComplete="new-password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </DsField>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleSave} disabled={busy !== null || !canSave} className="w-full sm:w-auto">
              {busy === "save" ? "Probando conexión…" : "Guardar y probar conexión"}
            </Button>
            {account ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setAccessToken("");
                  setClientId("");
                  setClientSecret("");
                }}
                disabled={busy !== null}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="break-words text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <IntlCollectionInstructions provider={provider} />
    </Card>
  );
}
