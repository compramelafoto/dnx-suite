"use client";

import { useState } from "react";
import Cropper from "react-easy-crop";
import { RotateCw } from "lucide-react";
import { GUIAS_ROSTRO } from "@/lib/foto-carnet/medidas";

/** Lo que devuelve react-easy-crop: píxeles de la vista previa ya girada. */
export type PixelesRecorte = { x: number; y: number; width: number; height: number };

function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso,
  formato,
  onChange,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  formato: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const ajustar = (d: number) => onChange(Math.min(max, Math.max(min, Number((valor + d).toFixed(2)))));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="fo-label !mb-0">{etiqueta}</span>
        <span className="text-xs text-[var(--fo-muted)]">{formato(valor)}</span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="fo-icon-btn" onClick={() => ajustar(-paso)} aria-label={`Menos ${etiqueta.toLowerCase()}`}>
          −
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={paso}
          value={valor}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-[var(--fo-accent)]"
          aria-label={etiqueta}
        />
        <button type="button" className="fo-icon-btn" onClick={() => ajustar(paso)} aria-label={`Más ${etiqueta.toLowerCase()}`}>
          +
        </button>
      </div>
    </div>
  );
}

/** Líneas de coronilla y mentón y el eje de la cara, encima del recuadro. No se imprimen. */
function GuiasRostro({ ancho, alto }: { ancho: number; alto: number }) {
  const linea = "absolute left-0 right-0 border-t-2 border-dashed border-sky-400/90";
  const rotulo = "absolute left-1 -translate-y-full rounded bg-black/50 px-1 text-[10px] leading-4 text-white";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width: ancho, height: alto }}
    >
      <div className={linea} style={{ top: `${GUIAS_ROSTRO.coronilla * 100}%` }} />
      <span className={rotulo} style={{ top: `${GUIAS_ROSTRO.coronilla * 100}%` }}>
        Coronilla
      </span>
      <div className={linea} style={{ top: `${GUIAS_ROSTRO.menton * 100}%` }} />
      <span className={rotulo} style={{ top: `${GUIAS_ROSTRO.menton * 100}%` }}>
        Mentón
      </span>
      <div className="absolute bottom-0 top-0 border-l-2 border-dashed border-sky-400/70" style={{ left: "50%" }} />
    </div>
  );
}

/**
 * Encuadre de la cara sobre la vista previa del servidor: se arrastra la foto, el zoom acerca,
 * "Girar 90°" acuesta o para la foto y "Enderezar" corrige hasta ±10°. El zoom mínimo llena el
 * recuadro: la foto carnet siempre se recorta, nunca queda borde blanco.
 */
export function Recorte({
  imageSrc,
  crop,
  zoom,
  giro90,
  enderezar,
  aspect,
  onCropChange,
  onZoomChange,
  onGiro90Change,
  onEnderezarChange,
  onCropComplete,
}: {
  imageSrc: string;
  crop: { x: number; y: number };
  zoom: number;
  giro90: number;
  enderezar: number;
  aspect: number;
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onGiro90Change: (grados: number) => void;
  onEnderezarChange: (grados: number) => void;
  onCropComplete: (pixeles: PixelesRecorte) => void;
}) {
  const [guias, setGuias] = useState(true);
  const [recuadro, setRecuadro] = useState<{ width: number; height: number } | null>(null);

  return (
    <div className="grid items-center gap-6 lg:grid-cols-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-[var(--fo-radius-sm)] bg-black/10">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={giro90 + enderezar}
          aspect={aspect}
          cropShape="rect"
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={(_, px) => onCropComplete(px)}
          onCropSizeChange={setRecuadro}
          objectFit="contain"
          showGrid={false}
          minZoom={1}
          maxZoom={6}
        />
        {guias && recuadro ? <GuiasRostro ancho={recuadro.width} alto={recuadro.height} /> : null}
      </div>
      <div className="space-y-4">
        <p className="text-sm text-[var(--fo-muted)]">
          Arrastrá la foto para centrar la cara. Con el zoom dejá la coronilla y el mentón sobre las guías, y con «Enderezar»
          nivelá los hombros.
        </p>
        <Deslizador etiqueta="Zoom" valor={zoom} min={1} max={6} paso={0.05} formato={(v) => `${v.toFixed(2)}×`} onChange={onZoomChange} />
        <Deslizador
          etiqueta="Enderezar"
          valor={enderezar}
          min={-10}
          max={10}
          paso={0.5}
          formato={(v) => `${String(v).replace(".", ",")}°`}
          onChange={onEnderezarChange}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="fo-btn fo-btn-secondary" onClick={() => onGiro90Change((giro90 + 90) % 360)}>
            <RotateCw className="size-4" aria-hidden />
            Girar 90°
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={guias} onChange={(e) => setGuias(e.target.checked)} className="accent-[var(--fo-accent)]" />
            Guías
          </label>
        </div>
      </div>
    </div>
  );
}
