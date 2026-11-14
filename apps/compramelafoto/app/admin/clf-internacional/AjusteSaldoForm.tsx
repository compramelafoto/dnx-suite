"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { DsField } from "@/components/ui/DsField";

export default function AjusteSaldoForm({ users }: { users: Array<{ id: number; label: string }> }) {
  const router = useRouter();
  const [userId, setUserId] = useState<number | "">(users[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cents = Math.round(Number(amount.replace(",", ".")) * 100);
  const ready = userId !== "" && Number.isFinite(cents) && cents !== 0 && note.trim().length >= 3;

  async function guardar() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/clf-internacional/ajuste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amountUsdCents: cents, note: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data?.error === "string" ? data.error : "No se pudo guardar el ajuste.");
        return;
      }
      setAmount("");
      setNote("");
      setMsg("Ajuste guardado.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (users.length === 0) return <p className="text-sm text-[#6b7280]">No hay fotógrafos en el piloto.</p>;

  return (
    <div className="space-y-3">
      <DsField label="Fotógrafo" htmlFor="ajuste-usuario">
        <select
          id="ajuste-usuario"
          className="w-full rounded-lg border border-[#d1d5db] px-3 py-2"
          value={userId}
          onChange={(e) => setUserId(Number(e.target.value))}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </DsField>
      <DsField label="Monto en USD (negativo para descontar)" htmlFor="ajuste-monto">
        <Input id="ajuste-monto" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </DsField>
      <DsField label="Motivo" htmlFor="ajuste-motivo">
        <Input id="ajuste-motivo" value={note} onChange={(e) => setNote(e.target.value)} />
      </DsField>
      {msg ? <p className="text-sm">{msg}</p> : null}
      <Button variant="primary" onClick={guardar} disabled={busy || !ready}>
        {busy ? "Guardando…" : "Guardar ajuste"}
      </Button>
    </div>
  );
}
