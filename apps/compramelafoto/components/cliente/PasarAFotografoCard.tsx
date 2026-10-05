"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/** Salida para el fotógrafo que se registró como cliente por error. */
export default function PasarAFotografoCard() {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cuenta/pasar-a-fotografo", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "No pudimos cambiar tu cuenta. Probá de nuevo.");
        setSubmitting(false);
        return;
      }
      window.location.href = data?.redirect || "/fotografo/dashboard";
    } catch {
      setError("No pudimos cambiar tu cuenta. Probá de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-4 border border-[#c27b3d]/40 bg-[#fdf8f3] space-y-3">
      <div>
        <p className="font-medium text-[#1a1a1a]">¿Sos fotógrafo/a y te registraste como cliente?</p>
        <p className="text-sm text-[#6b7280]">
          Pasá tu cuenta a fotógrafo para publicar y vender tus fotos. Seguís entrando con el mismo
          email y contraseña.
        </p>
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-[#1a1a1a]">¿Confirmás el cambio?</span>
          <Button variant="primary" size="md" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Cambiando…" : "Sí, soy fotógrafo/a"}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setConfirming(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="md" onClick={() => setConfirming(true)}>
          Pasar mi cuenta a fotógrafo
        </Button>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </Card>
  );
}
