"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Comando, EstadoPantalla } from "@/lib/control-remoto/protocolo";
import { usePantallaRemota } from "@/components/control-remoto/usePantallaRemota";
import { BotonControlRemoto } from "@/components/control-remoto/BotonControlRemoto";
import { PLACAS, type Placa } from "./placas";
import { VisualDePlaca } from "./Visuales";

/** «3 · Preparar la venta» → número y nombre; las etapas sin número no cuentan en la barra. */
function partirEtapa(etapa: string): { numero: number | null; nombre: string } {
  const m = /^(\d+)\s*·\s*(.+)$/.exec(etapa);
  return m ? { numero: Number(m[1]), nombre: m[2] } : { numero: null, nombre: etapa };
}

const ETAPAS = [...new Set(PLACAS.map((p) => p.etapa))].map(partirEtapa).filter((e) => e.numero != null);

function columnas(n: number, ancha: boolean): string {
  if (!ancha) return n >= 4 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  if (n <= 3) return "sm:grid-cols-3";
  if (n === 4) return "sm:grid-cols-2 xl:grid-cols-4";
  if (n <= 6) return "sm:grid-cols-2 lg:grid-cols-3";
  return "sm:grid-cols-2 lg:grid-cols-4";
}

function leerHash(): number {
  if (typeof window === "undefined") return 0;
  const n = Number(window.location.hash.replace("#", ""));
  return Number.isInteger(n) && n >= 1 && n <= PLACAS.length ? n - 1 : 0;
}

function Puntos({ placa }: { placa: Placa }) {
  const puntos = placa.puntos ?? [];
  if (!puntos.length) return null;
  return (
    <ul className={`mt-[clamp(1rem,3vh,1.75rem)] grid grid-cols-1 gap-3 ${columnas(puntos.length, Boolean(placa.ancha))}`}>
      {puntos.map((p, i) => (
        <li key={p.titulo} className="rounded-2xl border border-[#c27b3d]/15 bg-[#fbf6f1] p-[clamp(0.75rem,min(1.4vw,2vh),1.2rem)]">
          {placa.numerados ? (
            <span className="block text-[clamp(1.1rem,min(2vw,3vh),1.75rem)] font-black leading-none text-[#c27b3d]">
              {String(i + 1).padStart(2, "0")}
            </span>
          ) : (
            <span className="block h-1.5 w-8 rounded-full bg-[#5cb46a]" aria-hidden />
          )}
          <p className="mt-2 text-[clamp(0.95rem,min(1.35vw,2.1vh),1.2rem)] font-bold leading-tight text-slate-900">{p.titulo}</p>
          {p.texto ? <p className="mt-1 text-[clamp(0.85rem,1.05vw,1rem)] leading-snug text-slate-600">{p.texto}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Presentación de la foto escolar, una placa por funcionalidad. Se maneja con las flechas, la
 * barra espaciadora o un control de diapositivas (Avance/Retroceso de página); «F» la pone en
 * pantalla completa e «I» abre el índice. El número de placa queda en la dirección (#5).
 * «Control remoto» muestra un QR para manejarla desde el celular.
 */
export default function PresentacionEscolar() {
  const [actual, setActual] = useState(0);
  const [indice, setIndice] = useState(false);

  const ir = useCallback((n: number) => {
    const destino = Math.max(0, Math.min(PLACAS.length - 1, n));
    setActual(destino);
    window.history.replaceState(null, "", `#${destino + 1}`);
  }, []);

  useEffect(() => {
    setActual(leerHash());
  }, []);

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        ir(actual + 1);
      } else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        ir(actual - 1);
      } else if (e.key === "Home") {
        ir(0);
      } else if (e.key === "End") {
        ir(PLACAS.length - 1);
      } else if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => {});
      } else if (e.key === "i" || e.key === "I") {
        setIndice((v) => !v);
      } else if (e.key === "Escape") {
        setIndice(false);
      }
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [actual, ir]);

  const estadoRemoto = useMemo<EstadoPantalla>(
    () => ({
      titulo: "Foto escolar paso a paso",
      posicion: { actual: actual + 1, total: PLACAS.length, nombre: "Placa" },
      detalle: PLACAS[actual].titulo,
      nota: PLACAS[actual].bajada,
      navegacion: { anterior: actual > 0, siguiente: actual < PLACAS.length - 1 },
      botones: actual > 0 ? [{ id: "portada", etiqueta: "Volver a la portada" }] : [],
      lista: {
        titulo: "Todas las placas",
        actual: String(actual),
        items: PLACAS.map((p, i) => ({ id: String(i), etiqueta: p.titulo, grupo: p.etapa })),
      },
    }),
    [actual],
  );
  const alComando = useCallback(
    (c: Comando) => {
      if (c.tipo === "siguiente") ir(actual + 1);
      else if (c.tipo === "anterior") ir(actual - 1);
      else if (c.tipo === "ir") ir(Number(c.id));
      else if (c.tipo === "boton" && c.id === "portada") ir(0);
    },
    [actual, ir],
  );
  const remoto = usePantallaRemota({
    clave: "control-remoto:presentacion-escolar",
    pedido: { ambito: "presentacion-escolar" },
    estado: estadoRemoto,
    alComando,
  });

  const placa = PLACAS[actual];
  const etapa = partirEtapa(placa.etapa);
  const conVisual = Boolean(placa.visual) && !placa.ancha;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-gradient-to-br from-slate-900 via-slate-900 to-[#3a2614] p-[clamp(0.5rem,2vw,1.5rem)]">
      <div
        key={actual}
        className="placa-entra relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <Image
          src="/demos/isotipo-clf.png"
          alt=""
          width={290}
          height={290}
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 w-80 opacity-[0.06]"
        />
        <div className="h-2 shrink-0 bg-gradient-to-r from-[#c27b3d] via-[#e0a15f] to-[#5cb46a]" />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-[clamp(1.25rem,4vw,3.5rem)] pb-[clamp(1rem,3vh,2rem)] pt-[clamp(1rem,2.5vh,1.75rem)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Image src="/demos/isotipo-clf.png" alt="" width={290} height={290} className="h-10 w-10" />
              <span className="text-lg font-bold tracking-tight text-[#c27b3d]">ComprameLaFoto</span>
            </div>
            <span className="rounded-full bg-[#c27b3d]/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-[#a0652d]">
              {etapa.numero != null ? `Etapa ${etapa.numero} · ${etapa.nombre}` : etapa.nombre}
            </span>
          </div>

          {etapa.numero != null || placa.etapa === "Cierre" ? (
            <ol className="mt-[clamp(0.75rem,2vh,1.25rem)] flex gap-1.5" aria-label="Etapas del recorrido">
              {ETAPAS.map((e) => {
                const hecha = etapa.numero != null ? e.numero! < etapa.numero : true;
                const esta = e.numero === etapa.numero;
                return (
                  <li key={e.numero} className="min-w-0 flex-1">
                    <div className={`h-1.5 rounded-full ${esta ? "bg-[#c27b3d]" : hecha ? "bg-[#c27b3d]/45" : "bg-slate-200"}`} />
                    <p className={`mt-1.5 hidden truncate text-[11px] font-medium lg:block ${esta ? "text-[#a0652d]" : "text-slate-400"}`}>
                      {e.numero}. {e.nombre}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <div
            className={`mt-[clamp(1rem,3vh,2rem)] flex flex-1 flex-col gap-[clamp(1rem,3vw,3rem)] ${conVisual ? "lg:flex-row lg:items-center" : "justify-center"}`}
          >
            <div className={`min-w-0 ${conVisual ? "lg:w-[46%]" : ""}`}>
              <h1
                className={`font-extrabold leading-[1.05] tracking-tight text-slate-900 ${
                  actual === 0 ? "text-[clamp(2.25rem,min(5.5vw,8vh),4.75rem)]" : "text-[clamp(1.75rem,min(3.8vw,5.8vh),3.25rem)]"
                }`}
              >
                {placa.titulo}
              </h1>
              <p className="mt-3 max-w-3xl text-[clamp(1.05rem,min(1.6vw,2.5vh),1.45rem)] leading-snug text-slate-600">{placa.bajada}</p>
              <Puntos placa={placa} />
            </div>
            {conVisual && placa.visual ? (
              <div className="flex min-w-0 flex-1 items-center justify-center rounded-3xl bg-gradient-to-br from-[#fbf6f1] to-[#f3e6d8] p-[clamp(0.75rem,2vw,1.75rem)]">
                <div className="w-full max-w-[560px]">
                  <VisualDePlaca visual={placa.visual} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
        <div className="flex items-center gap-2">
          <Link href="/admin/demos" className="rounded-full px-3 py-1.5 hover:bg-white/10">
            ← Demos
          </Link>
          <button type="button" onClick={() => setIndice((v) => !v)} className="rounded-full px-3 py-1.5 hover:bg-white/10">
            Índice (I)
          </button>
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void document.documentElement.requestFullscreen?.().catch(() => {});
            }}
            className="rounded-full px-3 py-1.5 hover:bg-white/10"
          >
            Pantalla completa (F)
          </button>
          <BotonControlRemoto remoto={remoto} className="rounded-full px-3 py-1.5 hover:bg-white/10" />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-white/10 sm:block">
            <span className="block h-full rounded-full bg-[#c27b3d]" style={{ width: `${((actual + 1) / PLACAS.length) * 100}%` }} />
          </div>
          <span className="tabular-nums">
            {actual + 1} / {PLACAS.length}
          </span>
          <button
            type="button"
            onClick={() => ir(actual - 1)}
            disabled={actual === 0}
            className="rounded-full border border-white/20 px-4 py-1.5 hover:bg-white/10 disabled:opacity-30"
            aria-label="Placa anterior"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => ir(actual + 1)}
            disabled={actual === PLACAS.length - 1}
            className="rounded-full bg-[#c27b3d] px-5 py-1.5 font-semibold text-white hover:bg-[#a0652d] disabled:opacity-30"
          >
            Seguir →
          </button>
        </div>
      </div>

      {indice ? (
        <div className="fixed inset-0 z-[10001] flex justify-end bg-slate-950/60" onClick={() => setIndice(false)} role="dialog" aria-label="Índice de placas">
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-bold text-slate-900">Índice</p>
              <button type="button" onClick={() => setIndice(false)} className="rounded-full px-3 py-1 text-slate-500 hover:bg-slate-100">
                Cerrar
              </button>
            </div>
            <ol className="space-y-1">
              {PLACAS.map((p, i) => {
                const nuevaEtapa = i === 0 || PLACAS[i - 1].etapa !== p.etapa;
                return (
                  <li key={i}>
                    {nuevaEtapa ? <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-[#a0652d]">{p.etapa}</p> : null}
                    <button
                      type="button"
                      onClick={() => {
                        ir(i);
                        setIndice(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm ${i === actual ? "bg-[#c27b3d]/10 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      <span className="w-6 text-right tabular-nums text-slate-400">{i + 1}</span>
                      {p.titulo}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}
