"use client";

import { useCallback, useEffect, useState } from "react";

type Estado = { pendientes: number; canjeados: number; ultimoAvisoAt: string | null };

const FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * Botón para avisarles a las familias de la preventa que ya están las fotos. Manda a cada
 * una su link personal al canje guiado. Es a mano a propósito: las fotos se suben en tandas
 * y conviene avisar cuando estén todas.
 */
export default function PreventaAvisoFamiliasCard({
  albumId,
  hasPhotos,
}: {
  albumId: number;
  hasPhotos: boolean;
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-aviso`, { cache: "no-store" });
    if (res.ok) setEstado(await res.json());
  }, [albumId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!estado || estado.pendientes + estado.canjeados === 0) return null;

  async function avisar() {
    if (!estado) return;
    const ya = estado.ultimoAvisoAt ? " Ya les avisaste antes: les va a llegar otro correo." : "";
    if (
      !window.confirm(
        `Vamos a mandarle un correo a ${estado.pendientes} ${estado.pendientes === 1 ? "familia" : "familias"} con su link para elegir las fotos del pack.${ya} ¿Seguimos?`
      )
    ) {
      return;
    }
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-aviso`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo mandar el aviso.");
      setMensaje(
        `Listo: ${data.enviados} ${data.enviados === 1 ? "correo" : "correos"} en camino.` +
          (data.sinEmail ? ` ${data.sinEmail} sin email válido.` : "")
      );
      await cargar();
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo mandar el aviso.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="w-full max-w-3xl rounded-xl border border-[#e5e7eb] bg-white p-5 space-y-3">
      <h3 className="m-0 text-base font-semibold text-[#1a1a1a]">Avisar a las familias que ya están las fotos</h3>
      <p className="m-0 text-sm text-[#4b5563]">
        {estado.pendientes === 0
          ? `Las ${estado.canjeados} familias ya eligieron sus fotos.`
          : `${estado.pendientes} ${estado.pendientes === 1 ? "familia todavía no eligió" : "familias todavía no eligieron"} las fotos de su pack` +
            (estado.canjeados ? ` (${estado.canjeados} ya lo hicieron).` : ".")}{" "}
        A cada una le llega un correo con su link personal para elegirlas sin pagar nada.
      </p>
      {estado.ultimoAvisoAt ? (
        <p className="m-0 text-xs text-[#6b7280]">Último aviso: {FECHA.format(new Date(estado.ultimoAvisoAt))}</p>
      ) : null}
      {!hasPhotos ? (
        <p className="m-0 text-sm text-amber-700">Subí las fotos antes de avisar: si no, las familias entran y no encuentran nada.</p>
      ) : null}
      <button
        type="button"
        onClick={() => void avisar()}
        disabled={enviando || !hasPhotos || estado.pendientes === 0}
        className="min-h-11 rounded-lg bg-[#c27b3d] px-4 text-sm font-semibold text-white hover:bg-[#a8652e] disabled:bg-[#d1d5db]"
      >
        {enviando ? "Mandando…" : estado.ultimoAvisoAt ? "Volver a avisar" : "Avisar a las familias"}
      </button>
      {mensaje ? <p className="m-0 text-sm text-[#1f2937]">{mensaje}</p> : null}
    </section>
  );
}
