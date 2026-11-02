"use client";

import { useState } from "react";
import type { usePantallaRemota } from "./usePantallaRemota";

/**
 * Botón «Control remoto» de una pantalla que se proyecta y su ventana con el QR. El QR se muestra
 * sólo cuando el presentador lo pide, y se esconde solo en cuanto el celular se conecta.
 * Copia idéntica en FOTOFFICE (`apps/fotoffice/components/control-remoto/BotonControlRemoto.tsx`).
 */
export function BotonControlRemoto({
  remoto,
  className,
}: {
  remoto: ReturnType<typeof usePantallaRemota>;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const { sesion, celular, error, trabajando } = remoto;
  const conectado = Boolean(sesion) && celular === "conectado";

  // Cuando el celular se conecta, la ventana se cierra sola: el QR ya no sirve y tapa la pantalla.
  const [celularVisto, setCelularVisto] = useState(celular);
  if (celularVisto !== celular) {
    setCelularVisto(celular);
    if (celular === "conectado") setAbierto(false);
  }

  const vence = sesion
    ? new Date(sesion.vence).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })
    : "";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
          if (!sesion) void remoto.abrir();
        }}
        className={className}
        title="Manejar esta pantalla desde el celular"
      >
        <span aria-hidden>📱</span> {conectado ? "Celular conectado" : "Control remoto"}
        {sesion ? (
          <span
            aria-hidden
            className={`ml-1.5 inline-block h-2 w-2 rounded-full align-middle ${conectado ? "bg-emerald-400" : "bg-amber-400"}`}
          />
        ) : null}
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setAbierto(false)}
          role="dialog"
          aria-label="Control remoto"
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xl font-bold">Control remoto</p>

            {!sesion ? (
              <p className="text-slate-600">{trabajando ? "Preparando el código…" : (error ?? "")}</p>
            ) : conectado ? (
              <p className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                <strong className="block text-lg">✓ Celular conectado</strong>
                Ya podés manejar esta pantalla desde el teléfono.
              </p>
            ) : celular === "desconectado" ? (
              <p className="rounded-2xl bg-amber-50 p-4 text-amber-900">
                El celular no responde. Abrí de nuevo la página del control en el teléfono, o conectá otro.
              </p>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- QR generado en el servidor */}
                <img src={sesion.qr} alt="QR del control remoto" className="mx-auto w-full max-w-[280px]" />
                <p className="text-sm text-slate-600">
                  Escanealo con la cámara del celular. El código sirve <strong>una sola vez</strong>: después de
                  escanearlo, sólo ese teléfono maneja la pantalla.
                </p>
              </>
            )}

            {sesion ? (
              <div className="flex flex-col gap-2 pt-1">
                {celular !== "esperando" ? (
                  <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => void remoto.nuevoCodigo()}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Conectar otro celular
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void remoto.apagar();
                    setAbierto(false);
                  }}
                  className="rounded-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  Apagar el control remoto
                </button>
                <p className="text-xs text-slate-400">Se apaga solo a las {vence}.</p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="w-full rounded-full bg-slate-900 px-4 py-2.5 font-semibold text-white"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
