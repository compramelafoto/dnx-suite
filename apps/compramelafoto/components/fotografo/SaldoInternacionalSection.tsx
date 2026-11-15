"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsField } from "@/components/ui/DsField";
import { formatUsdCents, movementLabel, type MovementForLabel } from "@/lib/international/wallet-labels";

const API = "/api/fotografo/saldo-internacional";
const AR_TZ = "America/Argentina/Buenos_Aires";
const MIN_TOPUP = 1000;
const LOW_BALANCE = 500;

type Wallet = {
  balanceUsdCents: number;
  advanceDebtUsdCents: number;
  suggestion: { options: number[]; recommended: number };
  movements: Array<MovementForLabel & { id: string; createdAt: string }>;
};

/** Saldo en dólares del piloto internacional. No se dibuja para quien no está en el piloto. */
export default function SaldoInternacionalSection({ resultadoRecarga }: { resultadoRecarga?: string | null }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Wallet;
        if (!cancelled) {
          setWallet(data);
          setChosen(data.suggestion.recommended);
        }
      } catch {
        /* sin saldo internacional: no se muestra nada */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!wallet) return null;

  const otherCents = other.trim() ? Math.round(Number(other.replace(",", ".")) * 100) : null;
  const chosenCents = otherCents ?? chosen ?? 0;
  const validChoice = Number.isInteger(chosenCents) && chosenCents >= MIN_TOPUP;
  const toPay = chosenCents + wallet.advanceDebtUsdCents;

  async function recargar() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/recargar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chosenUsdCents: chosenCents }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data?.approveUrl !== "string") {
        setError(typeof data?.error === "string" ? data.error : "No pudimos iniciar la recarga. Probá de nuevo.");
        return;
      }
      window.location.href = data.approveUrl;
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-6">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Saldo para comisiones</h2>

      {resultadoRecarga === "ok" ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          ¡Listo! Tu recarga se acreditó.
        </p>
      ) : resultadoRecarga === "error" ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          No pudimos confirmar la recarga. Si PayPal te cobró, escribinos y lo revisamos.
        </p>
      ) : null}

      <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 text-[#1a1a1a]">
        <p className="text-3xl font-semibold">{formatUsdCents(wallet.balanceUsdCents)}</p>
        <p className="text-sm text-[#6b7280]">
          Cobrás el total de cada venta en tu Mercado Pago. De este saldo descontamos el 15 % de comisión, pasado a dólares.
        </p>
        {wallet.advanceDebtUsdCents > 0 ? (
          <p className="text-sm">
            Adelanto a devolver: {formatUsdCents(wallet.advanceDebtUsdCents)} (se cobra en tu próxima recarga).
          </p>
        ) : null}
      </div>

      {wallet.balanceUsdCents <= 0 ? (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Tus ventas están pausadas hasta que recargues saldo.
        </p>
      ) : wallet.balanceUsdCents < LOW_BALANCE ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Te queda poco saldo. Cuando llegue a cero, tus álbumes dejan de aceptar compras nuevas.
        </p>
      ) : null}

      <div className="space-y-4">
        <h3 className="font-medium text-[#1a1a1a]">Recargar</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {wallet.suggestion.options.map((o) => (
            <Button
              key={o}
              variant={otherCents == null && chosen === o ? "primary" : "outline"}
              size="sm"
              onClick={() => {
                setChosen(o);
                setOther("");
              }}
            >
              {formatUsdCents(o)}
              {o === wallet.suggestion.recommended ? " · Recomendado" : ""}
            </Button>
          ))}
        </div>
        <DsField label="Otro monto en USD (mínimo 10)" htmlFor="saldo-otro-monto">
          <Input
            id="saldo-otro-monto"
            type="number"
            inputMode="decimal"
            min={10}
            step="1"
            value={other}
            onChange={(e) => setOther(e.target.value)}
          />
        </DsField>
        {validChoice ? (
          <p className="text-sm text-[#1a1a1a]">
            Vas a pagar {formatUsdCents(toPay)}
            {wallet.advanceDebtUsdCents > 0
              ? ` (${formatUsdCents(chosenCents)} de saldo + ${formatUsdCents(wallet.advanceDebtUsdCents)} del adelanto).`
              : "."}
          </p>
        ) : (
          <p className="text-sm text-[#6b7280]">La recarga mínima es de 10 USD.</p>
        )}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <Button variant="primary" onClick={recargar} disabled={busy || !validChoice}>
          {busy ? "Abriendo PayPal…" : "Recargar con PayPal"}
        </Button>
      </div>

      {wallet.movements.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-medium text-[#1a1a1a]">Movimientos</h3>
          <ul className="divide-y divide-[#e5e7eb] text-sm">
            {wallet.movements.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between">
                <span className="break-words text-[#1a1a1a]">{movementLabel(m)}</span>
                <span className="text-[#6b7280]">
                  {new Date(m.createdAt).toLocaleString("es-AR", { timeZone: AR_TZ })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
