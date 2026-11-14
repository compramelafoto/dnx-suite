"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";

/**
 * Interruptor de novedades por correo y publicidad personalizada.
 * Lo decide el fotógrafo: el sistema nunca lo activa solo.
 */
export default function PreferenciaNovedadesCard({
  marketingOptIn,
  onChange,
}: {
  marketingOptIn: boolean;
  onChange: (valor: boolean) => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(valor: boolean) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me/marketing-opt-in", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingOptIn: valor, source: "profile" }),
      });
      if (!res.ok) throw new Error();
      onChange(valor);
    } catch {
      setError("No pudimos guardar tu preferencia. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card className="mt-6 space-y-3">
      <h2 className="text-xl font-medium text-[#1a1a1a]">Novedades y publicidad</h2>
      <label className="flex items-start gap-3 text-sm text-[#1a1a1a]">
        <input
          type="checkbox"
          checked={marketingOptIn}
          disabled={guardando}
          onChange={(e) => cambiar(e.target.checked)}
          className="mt-1"
        />
        <span>
          Quiero recibir por correo novedades y consejos para vender más con ComprameLaFoto.
        </span>
      </label>
      <p className="text-xs text-[#6b7280]">
        Si lo desactivás, además dejamos de usar tu correo para mostrarte publicidad personalizada en
        redes sociales. Más detalle en la{" "}
        <Link href="/privacidad#uso" className="text-[#9a5c2a] hover:underline">
          Política de Privacidad
        </Link>
        .
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </Card>
  );
}
