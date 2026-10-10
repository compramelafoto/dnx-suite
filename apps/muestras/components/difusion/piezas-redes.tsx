"use client";

import { useState } from "react";
import { botonFino, campo, nota } from "./estilos";

export type OpcionVariante = { param: string; etiqueta: string };
export type OpcionObra = { id: string; etiqueta: string };

const FORMATOS = [
  { param: "post", etiqueta: "Posteo" },
  { param: "historia", etiqueta: "Historia" },
  { param: "cuadrado", etiqueta: "Cuadrado" },
] as const;

/**
 * Una vista previa a la vez (D29): cada una arma la imagen en el servidor, así que se pide sólo la
 * que está elegida. "Descargar" es la misma dirección con `descargar=1`.
 */
export function PiezasRedes({
  activityId, nombre, variantes, inicial, obras = [], impresos = false, avisoObra = null,
}: {
  activityId: string;
  nombre: string;
  variantes: OpcionVariante[];
  inicial: string;
  obras?: OpcionObra[];
  /** En "cambian para cada visitante": la obra elegida se ve en redes aunque online sea sorpresa (D39). */
  avisoObra?: string | null;
  impresos?: boolean;
}) {
  const [variante, setVariante] = useState(inicial);
  const [formato, setFormato] = useState<string>("post");
  const [obra, setObra] = useState(obras[0]?.id ?? "");
  const [cargada, setCargada] = useState<string | null>(null);
  const [fallida, setFallida] = useState<{ src: string; motivo: string } | null>(null);

  const base = `/api/redes/${encodeURIComponent(activityId)}`;
  const pedido = (f: string, extra = "") =>
    `${base}?formato=${f}&variante=${variante}${variante === "obra" && obra ? `&obra=${encodeURIComponent(obra)}` : ""}${extra}`;
  const src = pedido(formato);
  const cargando = cargada !== src && fallida?.src !== src;
  const etiquetaVariante = variantes.find((v) => v.param === variante)?.etiqueta ?? "";
  const etiquetaFormato = FORMATOS.find((f) => f.param === formato)?.etiqueta ?? "";

  const alFallar = async () => {
    // El motivo viene en texto (por ejemplo, "la inauguración ya pasó"): se pide para mostrarlo.
    let motivo = "No pudimos armar la pieza. Probá de nuevo.";
    try {
      const r = await fetch(src);
      if (!r.ok) motivo = (await r.text()).slice(0, 300) || motivo;
    } catch {
      // Se queda el mensaje general.
    }
    setFallida({ src, motivo });
  };

  return (
    <div className="space-y-4">
      {variantes.length > 1 ? (
        <fieldset className="space-y-2">
          <legend className={nota}>Pieza</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {variantes.map((v) => (
              <label key={v.param} className="flex items-center gap-2">
                <input type="radio" name={`variante-${nombre}`} value={v.param} checked={variante === v.param} onChange={() => setVariante(v.param)} />
                {v.etiqueta}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <fieldset className="space-y-2">
        <legend className={nota}>Formato</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {FORMATOS.map((f) => (
            <label key={f.param} className="flex items-center gap-2">
              <input type="radio" name={`formato-${nombre}`} value={f.param} checked={formato === f.param} onChange={() => setFormato(f.param)} />
              {f.etiqueta}
            </label>
          ))}
        </div>
      </fieldset>
      {variante === "obra" && obras.length > 0 ? (
        <label className="block max-w-md space-y-1">
          <span className={nota}>Obra</span>
          <select className={campo} value={obra} onChange={(e) => setObra(e.target.value)}>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
          </select>
          {avisoObra ? <span role="status" className={`block ${nota}`}>{avisoObra}</span> : null}
        </label>
      ) : null}

      <div className="w-full max-w-[360px] space-y-3">
        {fallida?.src === src ? (
          <p className="text-[var(--mf-alerta)]" role="alert">{fallida.motivo}</p>
        ) : (
          <div className="relative border border-[var(--mf-line)] bg-[var(--mf-surface)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- la pieza la arma nuestra ruta: no pasa por el optimizador */}
            <img
              key={src}
              src={src}
              alt={`Vista previa: ${etiquetaVariante}, ${etiquetaFormato.toLowerCase()}`}
              loading="lazy"
              className="block h-auto w-full"
              onLoad={() => setCargada(src)}
              onError={alFallar}
            />
            {cargando ? <p className={`absolute inset-x-0 top-0 p-3 ${nota}`} aria-live="polite">Armando la pieza…</p> : null}
          </div>
        )}
        <a href={pedido(formato, "&descargar=1")} className={botonFino} download>Descargar</a>
      </div>
      {impresos ? (
        <p className="flex flex-wrap gap-3">
          <a href={pedido("a6")} className={botonFino} download>Para imprimir A6 (PDF)</a>
          <a href={pedido("a5")} className={botonFino} download>Para imprimir A5 (PDF)</a>
        </p>
      ) : null}
      <p className={nota}>Instagram recomprime las imágenes: subila tal cual, sin recortar.</p>
    </div>
  );
}
