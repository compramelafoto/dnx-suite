"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { pedirVentanaFlotante } from "@/lib/digitalizacion/cliente/apis-navegador";
import { botonMonitoreoHabilitado, textoBotonMonitoreo, type EstadoMonitoreo } from "@/lib/digitalizacion/cliente/monitoreo";
import type { AvisoApagado } from "./apagado";

/** El monitoreo de la estación visto desde la ventanita: mismo estado, mismas acciones (un solo AudioContext). */
export type MonitoreoVentanita = {
  estado: EstadoMonitoreo;
  nivel: number;
  sinAudio: boolean;
  volumen: number;
  alAlternar: () => void;
  alCambiarVolumen: (porcentaje: number) => void;
};

export type EstadoVentanita = {
  modo: "VHS" | "DVD";
  stream: MediaStream | null;
  segundos: number;
  bytesPendientes: number;
  ultimoError: string | null;
  sinImagenHaceSeg: number | null;
  minutosSinSenal: number;
  avanceDvd: { hechos: number; total: number } | null;
  terminando: boolean;
  /** La grabación ya se cerró: la ventanita sigue abierta sólo para el aviso de apagado. */
  terminada?: boolean;
  apagado?: { aviso: AvisoApagado; alCancelar: () => void } | null;
  /** Sólo en la estación de VHS. */
  monitoreo?: MonitoreoVentanita | null;
};

const reloj = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(x).padStart(2, "0")}`;
};
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(0)} MB`;

function Vista({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline style={{ width: "100%", background: "#000", aspectRatio: "16/9" }} />;
}

function Monitoreo({ m }: { m: MonitoreoVentanita }) {
  const activo = m.estado === "ACTIVO";
  const habilitado = botonMonitoreoHabilitado(m.estado);
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <button type="button" onClick={m.alAlternar} disabled={!habilitado} aria-pressed={activo} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #444", background: activo ? "#166534" : "#222", color: habilitado ? "#fff" : "#888", cursor: habilitado ? "pointer" : "default" }}>
        {textoBotonMonitoreo(m.estado)}
      </button>
      {activo ? (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Volumen
            <input type="range" min={0} max={100} step={1} value={m.volumen} onChange={(ev) => m.alCambiarVolumen(Number(ev.target.value))} style={{ flex: 1 }} />
            <span style={{ width: 36, textAlign: "right" }}>{m.volumen} %</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div role="meter" aria-label="Nivel del monitoreo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.nivel} style={{ flex: 1, height: 6, borderRadius: 3, background: "#333" }}>
              <div style={{ width: `${m.nivel}%`, height: 6, borderRadius: 3, background: "#22c55e" }} />
            </div>
            {m.sinAudio ? <span style={{ color: "#fbbf24" }}>Sin audio</span> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Panel({ e, alDetener }: { e: EstadoVentanita; alDetener: () => void }) {
  const restan = e.sinImagenHaceSeg === null ? null : Math.max(0, e.minutosSinSenal * 60 - e.sinImagenHaceSeg);
  return (
    <div style={{ font: "13px system-ui, sans-serif", color: "#fff", background: "#111", minHeight: "100vh", overflow: "auto", display: "flex", flexDirection: "column" }}>
      {e.stream ? <Vista stream={e.stream} /> : null}
      <div style={{ padding: 8, display: "grid", gap: 4 }}>
        {e.apagado ? (
          <div role="alert" style={{ padding: 10, borderRadius: 8, background: e.apagado.aviso.error ? "#7f1d1d" : "#92400e", display: "grid", gap: 6, textAlign: "center" }}>
            <strong style={{ fontSize: 18 }}>{e.apagado.aviso.titulo}</strong>
            {e.apagado.aviso.detalle ? <span>{e.apagado.aviso.detalle}</span> : null}
            {e.apagado.aviso.puedeCancelar ? (
              <button type="button" onClick={e.apagado.alCancelar} style={{ padding: "8px 12px", borderRadius: 6, border: 0, background: "#fff", color: "#111", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
            ) : null}
          </div>
        ) : null}
        <strong style={{ color: e.terminada ? "#4ade80" : e.terminando ? "#fbbf24" : "#ef4444" }}>
          {e.terminada ? "✓ Grabación subida" : e.terminando ? "Terminando de subir…" : `● ${e.modo === "DVD" ? "SUBIENDO DVD" : "GRABANDO"}`} {e.modo === "VHS" ? reloj(e.segundos) : ""}
        </strong>
        {e.avanceDvd ? <span>Parte {e.avanceDvd.hechos} de {e.avanceDvd.total}</span> : null}
        <span>{e.bytesPendientes > 0 ? `Pendiente: ${mb(e.bytesPendientes)}` : "Subida al día ✓"}</span>
        {e.ultimoError ? <span style={{ color: "#fbbf24" }}>Reintentando: {e.ultimoError}</span> : null}
        {e.modo === "VHS" ? (
          <span>{restan === null ? "Señal: OK" : `Sin imagen hace ${reloj(e.sinImagenHaceSeg ?? 0)} — se corta en ${reloj(restan)}`}</span>
        ) : null}
        {e.monitoreo && !e.terminando && !e.terminada ? <Monitoreo m={e.monitoreo} /> : null}
        {e.terminada ? null : <button type="button" onClick={alDetener} disabled={e.terminando} style={{ marginTop: 4, padding: "6px 10px", borderRadius: 6, border: 0, background: "#ef4444", color: "#fff", cursor: "pointer" }}>
          ⏹ Detener
        </button>}
      </div>
    </div>
  );
}

export class Ventanita {
  private constructor(private readonly win: Window, private readonly raiz: Root, private readonly alDetener: () => void) {}

  /** Llamar dentro del clic de "Grabar": el navegador sólo abre la ventanita con un gesto del usuario. */
  static async abrir(alDetener: () => void): Promise<Ventanita> {
    const win = await pedirVentanaFlotante(320, 330);
    win.document.body.style.margin = "0";
    const div = win.document.createElement("div");
    win.document.body.appendChild(div);
    return new Ventanita(win, createRoot(div), alDetener);
  }

  mostrar(e: EstadoVentanita): void {
    if (!this.cerrada()) this.raiz.render(<Panel e={e} alDetener={this.alDetener} />);
  }

  cerrada(): boolean {
    return this.win.closed;
  }

  private cerradaYa = false;

  /** Se puede llamar más de una vez (al detener, al desmontar la pantalla, al cerrar la ventana). */
  cerrar(): void {
    if (this.cerradaYa) return;
    this.cerradaYa = true;
    try { this.raiz.unmount(); } catch { /* ya estaba desmontada */ }
    try { if (!this.win.closed) this.win.close(); } catch { /* la ventana ya no está */ }
  }
}
