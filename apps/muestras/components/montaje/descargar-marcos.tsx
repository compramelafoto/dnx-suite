"use client";

import { useState } from "react";
import {
  FRAME_SIZES, ORIENTATIONS, ORIENTATION_LABELS, QUALITY_LABELS, expectedQuality, isFrameSize, isOrientation,
  type FrameSize, type Orientation,
} from "@repo/muestras";
import { urlDePieza } from "@/lib/piezas/opciones";
import { campo, enlace } from "./estilos";

/** Elegir medida, orientación, con o sin foto y una obra o todas; el enlace baja el PDF de marcos. */
export function DescargarMarcos({ id, obras }: { id: string; obras: { id: string; title: string }[] }) {
  const [tamano, setTamano] = useState<FrameSize>("A4");
  const [orientacion, setOrientacion] = useState<Orientation>("AUTO");
  const [conFoto, setConFoto] = useState(true);
  const [obra, setObra] = useState("");
  const calidad = expectedQuality(tamano);
  const href = urlDePieza(id, { pieza: "marcos", tamano, orientacion, conFoto, obra: obra || null });
  const etiqueta = "space-y-1 text-sm";
  const nombre = "block text-[var(--mf-muted)]";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={etiqueta}>
          <span className={nombre}>Medida</span>
          <select className={campo} value={tamano} onChange={(e) => { if (isFrameSize(e.target.value)) setTamano(e.target.value); }}>
            {(Object.keys(FRAME_SIZES) as FrameSize[]).map((k) => <option key={k} value={k}>{FRAME_SIZES[k].label}</option>)}
          </select>
        </label>
        <label className={etiqueta}>
          <span className={nombre}>Orientación</span>
          <select className={campo} value={orientacion} onChange={(e) => { if (isOrientation(e.target.value)) setOrientacion(e.target.value); }}>
            {ORIENTATIONS.map((o) => <option key={o} value={o}>{ORIENTATION_LABELS[o]}</option>)}
          </select>
        </label>
        <label className={etiqueta}>
          <span className={nombre}>Qué se imprime</span>
          <select className={campo} value={conFoto ? "si" : "no"} onChange={(e) => setConFoto(e.target.value === "si")}>
            <option value="si">Con la foto</option>
            <option value="no">Sólo el remarco</option>
          </select>
        </label>
        <label className={etiqueta}>
          <span className={nombre}>Obra</span>
          <select className={campo} value={obra} onChange={(e) => setObra(e.target.value)}>
            <option value="">Todas ({obras.length})</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </label>
      </div>
      <p className="text-[15px]"><a href={href} className={enlace}>Bajar los marcos (PDF)</a></p>
      <div className="space-y-1 text-sm text-[var(--mf-muted)]">
        {conFoto ? (
          <p>
            Con las fotos que guardamos, en {FRAME_SIZES[tamano].label}: {QUALITY_LABELS[calidad]}.
            {calidad === "LOW" ? " Para esta medida conviene «Sólo el remarco» con una copia impresa en un laboratorio." : null}
          </p>
        ) : (
          <p>Sale el margen con título y autor, y la ventana marcada con línea punteada a la medida de la foto: apoyá tu copia detrás o recortá la ventana.</p>
        )}
        <p>Con varias obras el PDF pesa mucho: puede tardar hasta un minuto.</p>
      </div>
    </div>
  );
}
