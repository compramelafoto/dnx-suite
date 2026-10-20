"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { pedirVentanaFlotante } from "@/lib/digitalizacion/cliente/apis-navegador";

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

function Panel({ e, alDetener }: { e: EstadoVentanita; alDetener: () => void }) {
  const restan = e.sinImagenHaceSeg === null ? null : Math.max(0, e.minutosSinSenal * 60 - e.sinImagenHaceSeg);
  return (
    <div style={{ font: "13px system-ui, sans-serif", color: "#fff", background: "#111", minHeight: "100vh", overflow: "auto", display: "flex", flexDirection: "column" }}>
      {e.stream ? <Vista stream={e.stream} /> : null}
      <div style={{ padding: 8, display: "grid", gap: 4 }}>
        <strong style={{ color: e.terminando ? "#fbbf24" : "#ef4444" }}>
          {e.terminando ? "Terminando de subir…" : `● ${e.modo === "DVD" ? "SUBIENDO DVD" : "GRABANDO"}`} {e.modo === "VHS" ? reloj(e.segundos) : ""}
        </strong>
        {e.avanceDvd ? <span>Parte {e.avanceDvd.hechos} de {e.avanceDvd.total}</span> : null}
        <span>{e.bytesPendientes > 0 ? `Pendiente: ${mb(e.bytesPendientes)}` : "Subida al día ✓"}</span>
        {e.ultimoError ? <span style={{ color: "#fbbf24" }}>Reintentando: {e.ultimoError}</span> : null}
        {e.modo === "VHS" ? (
          <span>{restan === null ? "Señal: OK" : `Sin imagen hace ${reloj(e.sinImagenHaceSeg ?? 0)} — se corta en ${reloj(restan)}`}</span>
        ) : null}
        <button type="button" onClick={alDetener} disabled={e.terminando} style={{ marginTop: 4, padding: "6px 10px", borderRadius: 6, border: 0, background: "#ef4444", color: "#fff", cursor: "pointer" }}>
          ⏹ Detener
        </button>
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
