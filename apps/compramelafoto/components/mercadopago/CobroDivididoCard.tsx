"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";

type Estado = "SIN_PEDIR" | "PENDING" | "ACTIVE" | "REJECTED" | "CANCELED" | "EXPIRED";

type Vista = {
  estado: Estado;
  correo: string | null;
  inviteUrl: string | null;
  actualizadoEn: string | null;
  correoSugerido?: string | null;
};

const TEXTO_ESTADO: Record<Exclude<Estado, "SIN_PEDIR" | "ACTIVE" | "PENDING">, string> = {
  REJECTED: "Rechazaste la invitación en Mercado Pago.",
  CANCELED: "El cobro dividido se canceló en Mercado Pago.",
  EXPIRED: "La invitación venció sin que la aceptaras.",
};

/**
 * Cobro dividido (Split 1:N): la persona pide la invitación de Mercado Pago y la acepta allá.
 * Con eso, en cada venta Mercado Pago le deposita su parte en el momento. Si la función está
 * apagada (la API responde 404), la tarjeta no se muestra.
 */
export default function CobroDivididoCard({ rol = "fotografo" }: { rol?: "fotografo" | "organizador" }) {
  const [vista, setVista] = useState<Vista | null>(null);
  const [visible, setVisible] = useState(false);
  const [correo, setCorreo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** En PENDING: quien escribió mal su correo puede pedir con otro. */
  const [otroCorreo, setOtroCorreo] = useState(false);

  const cargar = useCallback(async (refrescar: boolean) => {
    setError(null);
    try {
      const res = await fetch(`/api/split-1n/consentimiento${refrescar ? "?refrescar=1" : ""}`, {
        cache: "no-store",
      });
      if (res.status === 404 || res.status === 401) {
        setVisible(false);
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setVisible(true);
        setError(data?.error ?? "No pudimos consultar el estado. Probá de nuevo en unos minutos.");
        return;
      }
      setVisible(true);
      setVista(data as Vista);
      setCorreo((c) => c || (data as Vista).correo || (data as Vista).correoSugerido || "");
    } catch {
      /* sin red: no se muestra nada */
    }
  }, []);

  useEffect(() => {
    void cargar(false);
  }, [cargar]);

  async function pedir() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/split-1n/consentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error ?? "No pudimos pedir la invitación. Probá de nuevo en unos minutos.");
        return;
      }
      setVista((v) => ({ ...(data as Vista), correoSugerido: v?.correoSugerido ?? null }));
      setOtroCorreo(false);
    } finally {
      setCargando(false);
    }
  }

  async function revisar() {
    setCargando(true);
    try {
      await cargar(true);
    } finally {
      setCargando(false);
    }
  }

  if (!visible) return null;
  const estado = vista?.estado ?? "SIN_PEDIR";
  const quien = rol === "organizador" ? "tu comisión" : "tu parte";

  return (
    <div className="pt-6 border-t border-[#e5e7eb]" data-testid="cobro-dividido">
      <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Cobro dividido al instante</label>

      {estado === "ACTIVE" ? (
        <div className="p-4 bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg">
          <p className="text-sm text-[#10b981] font-medium">✅ Cobro dividido activo</p>
          <p className="text-xs text-[#6b7280] mt-1">
            En cada venta, Mercado Pago te deposita {quien} en el momento en la cuenta{" "}
            {vista?.correo ? <strong>{vista.correo}</strong> : "que aceptó la invitación"}.
          </p>
        </div>
      ) : (
        <div className="p-4 bg-[#f8f9fa] border border-[#e5e7eb] rounded-lg space-y-3">
          <p className="text-sm text-[#374151]">
            Con el cobro dividido, cuando alguien paga con tarjeta Mercado Pago reparte el dinero en el
            momento: {quien} va directo a tu cuenta, sin esperar liquidaciones. Para activarlo tenés que
            aceptar una invitación de Mercado Pago, una sola vez.
          </p>

          {estado === "PENDING" ? (
            <>
              <p className="text-sm text-amber-800">
                Falta un paso: aceptá la invitación en Mercado Pago
                {vista?.correo ? (
                  <>
                    {" "}con la cuenta <strong>{vista.correo}</strong>
                  </>
                ) : null}
                .
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {vista?.inviteUrl ? (
                  <a
                    href={vista.inviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex justify-center px-5 py-2.5 text-white font-semibold rounded-lg text-sm"
                    style={{ backgroundColor: "#009EE3" }}
                  >
                    Aceptar en Mercado Pago
                  </a>
                ) : (
                  <p className="text-xs text-[#6b7280]">Buscá el correo de Mercado Pago con la invitación.</p>
                )}
                <Button variant="secondary" onClick={revisar} disabled={cargando} className="text-sm">
                  {cargando ? "Revisando…" : "Ya acepté, revisar"}
                </Button>
                {!otroCorreo ? (
                  <button
                    type="button"
                    onClick={() => setOtroCorreo(true)}
                    className="text-xs text-[#6b7280] underline"
                  >
                    Usar otro correo
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {estado !== "PENDING" || otroCorreo ? (
            <>
              {estado !== "SIN_PEDIR" && estado !== "PENDING" ? (
                <p className="text-sm text-amber-800">{TEXTO_ESTADO[estado]} Podés pedir otra invitación.</p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="block text-xs text-[#6b7280] mb-1" htmlFor="cobro-dividido-correo">
                    Correo de tu cuenta de Mercado Pago
                  </label>
                  <input
                    id="cobro-dividido-correo"
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                    placeholder="tu-correo@ejemplo.com"
                    autoComplete="email"
                  />
                </div>
                <Button onClick={pedir} disabled={cargando || !correo.trim()} className="text-sm">
                  {cargando ? "Pidiendo…" : "Pedir invitación"}
                </Button>
              </div>
            </>
          ) : null}

          <p className="text-xs text-[#6b7280]">
            Si alguien paga con Mercado Pago (no con tarjeta), el cobro sigue como siempre.
          </p>
        </div>
      )}

      {error ? <p className="text-sm text-red-700 mt-2">{error}</p> : null}
    </div>
  );
}
