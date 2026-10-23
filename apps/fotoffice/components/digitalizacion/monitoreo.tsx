"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MonitorDeAudio } from "@/lib/digitalizacion/cliente/monitor-audio";
import {
  AYUDA_MONITOREO,
  botonMonitoreoHabilitado,
  estadoMonitoreo,
  MedidorDeNivel,
  textoBotonMonitoreo,
  VOLUMEN_POR_DEFECTO,
  type EstadoMonitoreo,
} from "@/lib/digitalizacion/cliente/monitoreo";

const LEER_CADA_MS = 80;

/** Lo que necesitan la estación y la ventanita para mostrar y manejar el monitoreo. */
export type ControlMonitoreo = {
  estado: EstadoMonitoreo;
  nivel: number;
  sinAudio: boolean;
  volumen: number;
  /** Llamar dentro del clic (crea el `AudioContext`). */
  alternar: () => void;
  cambiarVolumen: (porcentaje: number) => void;
  /** Apaga y limpia (al terminar la grabación). Se puede llamar aunque no esté activo. */
  apagar: () => void;
};

function pistasVivas(stream: MediaStream | null): number {
  return stream ? stream.getAudioTracks().filter((t) => t.readyState === "live").length : 0;
}

/**
 * Un único monitoreo por estación: la ventanita usa este mismo estado (no abre otro AudioContext).
 * Se apaga solo si cambia el stream (otro dispositivo, o se cerró al terminar), si termina la pista
 * de audio, al salir de la pantalla, o cuando la estación llama a `apagar` (terminó la grabación).
 */
export function useMonitoreo(stream: MediaStream | null): ControlMonitoreo {
  const [activo, setActivo] = useState(false);
  const [nivel, setNivel] = useState(0);
  const [sinAudio, setSinAudio] = useState(false);
  const [volumen, setVolumen] = useState(VOLUMEN_POR_DEFECTO);
  // Cambia cuando las pistas de audio del stream cambian (terminó una, se agregó otra).
  const [, setCambioDePistas] = useState(0);
  const monitorRef = useRef<MonitorDeAudio | null>(null);
  const relojRef = useRef<number | null>(null);
  const volumenRef = useRef(volumen);
  const streamRef = useRef(stream);
  useEffect(() => { streamRef.current = stream; }, [stream]);

  const desactivar = useCallback(() => {
    if (relojRef.current !== null) { window.clearInterval(relojRef.current); relojRef.current = null; }
    monitorRef.current?.cerrar();
    monitorRef.current = null;
    setActivo(false);
    setNivel(0);
    setSinAudio(false);
  }, []);

  const activar = useCallback(() => {
    const s = streamRef.current;
    if (monitorRef.current || !s || pistasVivas(s) === 0) return;
    let monitor: MonitorDeAudio;
    try {
      monitor = MonitorDeAudio.abrir(s, volumenRef.current);
    } catch {
      return;
    }
    monitorRef.current = monitor;
    const medidor = new MedidorDeNivel();
    // Mientras suena audio, el navegador no frena los temporizadores de la pestaña en segundo plano.
    relojRef.current = window.setInterval(() => {
      const l = medidor.agregar(monitor.picoActual(), performance.now());
      setNivel(l.nivel);
      setSinAudio(l.sinAudio);
    }, LEER_CADA_MS);
    setActivo(true);
  }, []);

  const alternar = useCallback(() => {
    if (monitorRef.current) desactivar();
    else activar();
  }, [activar, desactivar]);

  const cambiarVolumen = useCallback((porcentaje: number) => {
    const v = Math.min(100, Math.max(0, Math.round(porcentaje)));
    volumenRef.current = v;
    setVolumen(v);
    monitorRef.current?.cambiarVolumen(v);
  }, []);

  // Stream nuevo (otro dispositivo) o ninguno (terminó): se apaga el monitoreo del anterior.
  // También se siguen las pistas de audio: si la de la capturadora termina, se apaga y el botón lo dice.
  useEffect(() => {
    if (!stream) return () => desactivar();
    const actualizar = () => {
      setCambioDePistas((n) => n + 1);
      if (pistasVivas(stream) === 0) desactivar();
    };
    const pistasAudio = stream.getAudioTracks();
    pistasAudio.forEach((t) => t.addEventListener("ended", actualizar));
    stream.addEventListener("addtrack", actualizar);
    stream.addEventListener("removetrack", actualizar);
    return () => {
      pistasAudio.forEach((t) => t.removeEventListener("ended", actualizar));
      stream.removeEventListener("addtrack", actualizar);
      stream.removeEventListener("removetrack", actualizar);
      desactivar();
    };
  }, [stream, desactivar]);

  const estado = estadoMonitoreo({ hayStream: Boolean(stream), pistasDeAudio: pistasVivas(stream), activo });
  return { estado, nivel, sinAudio, volumen, alternar, cambiarVolumen, apagar: desactivar };
}

/** Botón, volumen y medidor del monitoreo en la página de la estación. */
export function PanelMonitoreo({ control }: { control: ControlMonitoreo }) {
  const { estado, nivel, sinAudio, volumen, alternar, cambiarVolumen } = control;
  const activo = estado === "ACTIVO";
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={`fo-btn text-sm ${activo ? "fo-btn-primary" : "fo-btn-secondary"}`} disabled={!botonMonitoreoHabilitado(estado)} aria-pressed={activo} onClick={alternar}>
          {textoBotonMonitoreo(estado)}
        </button>
        {activo ? (
          <label className="flex items-center gap-2">
            Volumen del monitoreo
            <input type="range" min={0} max={100} step={1} value={volumen} onChange={(e) => cambiarVolumen(Number(e.target.value))} aria-valuetext={`${volumen} %`} />
            <span className="w-10 tabular-nums">{volumen} %</span>
          </label>
        ) : null}
      </div>
      {activo ? (
        <div className="flex max-w-2xl items-center gap-3">
          <div className="h-2 flex-1 rounded bg-gray-200" role="meter" aria-label="Nivel del monitoreo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={nivel}>
            <div className="h-2 rounded bg-green-500" style={{ width: `${nivel}%` }} />
          </div>
          {sinAudio ? <span className="font-semibold text-amber-700">Sin audio</span> : null}
        </div>
      ) : null}
      <p className="text-xs text-gray-500">{AYUDA_MONITOREO}</p>
    </div>
  );
}
