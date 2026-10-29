"use client";

import Image from "next/image";
import { CUADROS_MASCOTA, DURACION_FOTO_MASCOTA_MS, keyframesFotoMascota } from "@repo/dnx-bot/ui";
import type { PasoGuion } from "@/lib/demos/guiones/tipos";

/** La mascota de DNX Bot sacando una foto, en bucle (la misma tira que usa la burbuja del bot). */
function MascotaBot() {
  return (
    <span className="relative block aspect-[291/400] w-[clamp(6rem,min(11vw,17vh),9.5rem)] shrink-0" aria-hidden>
      <style>{`${keyframesFotoMascota()}
.placa-mascota { animation: dnxbot-foto ${DURACION_FOTO_MASCOTA_MS}ms steps(1, end) infinite; }
@media (prefers-reduced-motion: reduce) { .placa-mascota { animation: none; } }`}</style>
      <span
        className="placa-mascota absolute inset-0 bg-no-repeat"
        style={{ backgroundImage: 'url("/dnx-bot/mascota-foto.webp")', backgroundSize: `${CUADROS_MASCOTA * 100}% 100%` }}
      />
    </span>
  );
}

/** «3 · Preparar la venta» → número y nombre; las etapas sin número (Introducción, Cierre) no cuentan. */
function partirEtapa(etapa: string): { numero: number | null; nombre: string } {
  const m = /^(\d+)\s*·\s*(.+)$/.exec(etapa);
  return m ? { numero: Number(m[1]), nombre: m[2] } : { numero: null, nombre: etapa };
}

function columnas(n: number): string {
  if (n <= 1) return "grid-cols-1";
  if (n === 2) return "sm:grid-cols-2";
  if (n === 3) return "sm:grid-cols-3";
  if (n === 4) return "sm:grid-cols-2 xl:grid-cols-4";
  if (n <= 6) return "sm:grid-cols-2 lg:grid-cols-3";
  return "sm:grid-cols-2 lg:grid-cols-4";
}

/**
 * Placa para el público, con aspecto de diapositiva. Se apoya a la izquierda y deja libre la
 * esquina de abajo a la derecha, donde el Meet muestra la cámara del presentador.
 */
export default function PlacaPublico({
  paso,
  pasos,
  onSeguir,
}: {
  paso: PasoGuion;
  pasos: PasoGuion[];
  onSeguir: () => void;
}) {
  const placa = paso.aclaracion;
  if (!placa) return null;
  const etapas = [...new Set(pasos.map((p) => p.etapa))].map(partirEtapa).filter((e) => e.numero != null);
  const actual = partirEtapa(paso.etapa);
  const puntos = placa.puntos ?? [];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center bg-slate-950/75 py-6 pl-[clamp(1rem,4vw,4rem)] pr-[clamp(1rem,24vw,22rem)] backdrop-blur-sm"
      onClick={onSeguir}
      role="dialog"
      aria-modal="true"
      aria-label={placa.titulo}
    >
      <div
        className="placa-entra relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src="/demos/isotipo-clf.png"
          alt=""
          width={290}
          height={290}
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 w-80 opacity-[0.07]"
        />
        <div className="h-2 shrink-0 bg-gradient-to-r from-[#c27b3d] via-[#e0a15f] to-[#5cb46a]" />

        <div className="relative min-h-0 overflow-y-auto px-[clamp(1.5rem,4vw,3.5rem)] pb-[clamp(1rem,3.5vh,2.5rem)] pt-[clamp(1rem,3vh,2rem)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Image src="/demos/isotipo-clf.png" alt="" width={290} height={290} className="h-11 w-11" />
              <span className="text-lg font-bold tracking-tight text-[#c27b3d]">ComprameLaFoto</span>
            </div>
            <span className="rounded-full bg-[#c27b3d]/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-[#a0652d]">
              {actual.numero != null ? `Etapa ${actual.numero} · ${actual.nombre}` : actual.nombre}
            </span>
          </div>

          {etapas.length > 1 ? (
            <ol className="mt-[clamp(0.75rem,2vh,1.25rem)] flex gap-1.5" aria-label="Etapas del recorrido">
              {etapas.map((e) => {
                const hecha = actual.numero != null ? e.numero! < actual.numero : actual.nombre === "Cierre";
                const esta = e.numero === actual.numero;
                return (
                  <li key={e.numero} className="min-w-0 flex-1">
                    <div
                      className={`h-1.5 rounded-full ${esta ? "bg-[#c27b3d]" : hecha ? "bg-[#c27b3d]/45" : "bg-slate-200"}`}
                    />
                    <p
                      className={`mt-1.5 hidden truncate text-[11px] font-medium lg:block ${esta ? "text-[#a0652d]" : "text-slate-400"}`}
                    >
                      {e.numero}. {e.nombre}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <div className="mt-[clamp(1rem,3.5vh,2rem)] flex items-end justify-between gap-6">
            <div className="min-w-0">
              <h2 className="text-[clamp(1.75rem,min(4.2vw,6.2vh),3.5rem)] font-extrabold leading-[1.05] tracking-tight text-slate-900">
                {placa.titulo}
              </h2>
              <p className="mt-3 max-w-3xl text-[clamp(1.05rem,min(1.7vw,2.6vh),1.5rem)] leading-snug text-slate-600">{placa.texto}</p>
              {placa.chat ? (
                <p className="mt-4 inline-block max-w-2xl rounded-2xl rounded-br-md bg-slate-900 px-5 py-3 text-[clamp(1rem,min(1.5vw,2.4vh),1.3rem)] font-medium leading-snug text-white shadow-lg">
                  {placa.chat}
                </p>
              ) : null}
            </div>
            {placa.bot ? <MascotaBot /> : null}
          </div>

          {puntos.length ? (
            <ul className={`mt-[clamp(1rem,3vh,1.75rem)] grid grid-cols-1 gap-3 ${columnas(puntos.length)}`}>
              {puntos.map((p, i) => (
                <li key={p.titulo} className="rounded-2xl border border-[#c27b3d]/15 bg-[#fbf6f1] p-[clamp(0.75rem,min(1.5vw,2.2vh),1.25rem)]">
                  {placa.numerados ? (
                    <span className="block text-[clamp(1.25rem,min(2.4vw,3.6vh),2rem)] font-black leading-none text-[#c27b3d]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  ) : (
                    <span className="block h-1.5 w-8 rounded-full bg-[#5cb46a]" aria-hidden />
                  )}
                  <p className="mt-2 text-[clamp(1rem,min(1.5vw,2.3vh),1.3rem)] font-bold leading-tight text-slate-900">{p.titulo}</p>
                  {p.texto ? (
                    <p className="mt-1 text-[clamp(0.9rem,1.15vw,1.05rem)] leading-snug text-slate-600">{p.texto}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-[clamp(1rem,3.5vh,2.25rem)] flex items-center gap-4">
            <button
              type="button"
              onClick={onSeguir}
              className="rounded-full bg-[#c27b3d] px-7 py-3 text-lg font-semibold text-white shadow-lg shadow-[#c27b3d]/30 hover:bg-[#a0652d]"
            >
              Seguir →
            </button>
            <span className="text-sm text-slate-400">o Avance de página</span>
          </div>
        </div>
      </div>
    </div>
  );
}
