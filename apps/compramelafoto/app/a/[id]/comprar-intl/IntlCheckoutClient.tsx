"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsField } from "@/components/ui/DsField";
import CheckoutTermsAcceptance from "@/components/checkout/CheckoutTermsAcceptance";

export default function IntlCheckoutClient(props: {
  albumId: number;
  albumTitle: string;
  photoIds: number[];
  unitLabel: string;
  totalLabel: string;
  canBuy: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = props.photoIds.length;
  const ready = props.canBuy && email.trim() !== "" && phone.replace(/\D/g, "").length >= 8 && terms;

  async function pagar() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/a/${props.albumId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerEmail: email.trim(),
          buyerPhone: phone.trim(),
          buyerName: name.trim() || null,
          termsAccepted: true,
          items: props.photoIds.map((id) => ({
            fileKey: `photo:${id}`,
            tipo: "digital",
            size: "DIGITAL",
            quantity: 1,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data?.initPoint === "string") {
        window.location.href = data.initPoint;
        return;
      }
      setError(typeof data?.error === "string" ? data.error : "No pudimos iniciar el pago. Probá de nuevo.");
    } catch {
      setError("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold text-[#1a1a1a]">Comprar fotos digitales</h1>
      <Card className="space-y-2">
        <p className="font-medium text-[#1a1a1a] break-words">{props.albumTitle}</p>
        {n > 0 ? (
          <>
            <p className="text-sm text-[#374151]">
              {n} foto{n === 1 ? "" : "s"} · {props.unitLabel} cada una
            </p>
            <p className="text-xl font-semibold text-[#1a1a1a]">Total: {props.totalLabel}</p>
          </>
        ) : (
          <p className="text-sm text-[#374151]">No elegiste fotos. Volvé al álbum y seleccioná las que quieras.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <DsField label="Nombre" htmlFor="intl-nombre">
          <Input id="intl-nombre" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </DsField>
        <DsField label="Email (te mandamos las fotos acá)" htmlFor="intl-email">
          <Input id="intl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </DsField>
        <DsField label="WhatsApp (con código de país)" htmlFor="intl-telefono">
          <Input id="intl-telefono" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </DsField>
        <CheckoutTermsAcceptance checked={terms} onChange={setTerms} disabled={busy} error={null} />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="secondary" onClick={() => window.history.back()} disabled={busy}>
            ← Volver al álbum
          </Button>
          <Button variant="primary" onClick={pagar} disabled={busy || !ready}>
            {busy ? "Abriendo Mercado Pago…" : "Pagar con Mercado Pago"}
          </Button>
        </div>
      </Card>
    </main>
  );
}
