"use client";

import Cropper from "react-easy-crop";
import type { CropAreaPixels } from "./procesar";

function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso,
  pasoBoton,
  formato,
  onChange,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  pasoBoton: number;
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
        <button type="button" className="fo-icon-btn" onClick={() => ajustar(-pasoBoton)} aria-label={`Menos ${etiqueta.toLowerCase()}`}>
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
        <button type="button" className="fo-icon-btn" onClick={() => ajustar(pasoBoton)} aria-label={`Más ${etiqueta.toLowerCase()}`}>
          +
        </button>
      </div>
    </div>
  );
}

/** Encuadre de la cara: se arrastra la foto, el zoom acerca y el giro endereza. */
export function Recorte({
  imageSrc,
  crop,
  zoom,
  rotation,
  aspect,
  onCropChange,
  onZoomChange,
  onRotationChange,
  onCropComplete,
}: {
  imageSrc: string;
  crop: { x: number; y: number };
  zoom: number;
  rotation: number;
  aspect: number;
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onRotationChange: (rotation: number) => void;
  onCropComplete: (area: CropAreaPixels) => void;
}) {
  return (
    <div className="grid items-center gap-6 lg:grid-cols-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-[var(--fo-radius-sm)] bg-black/10">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          cropShape="rect"
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={(_, areaPixels) => onCropComplete(areaPixels as CropAreaPixels)}
          objectFit="contain"
          showGrid
          minZoom={0.5}
          maxZoom={6}
        />
      </div>
      <div className="space-y-4">
        <p className="text-sm text-[var(--fo-muted)]">
          Arrastrá la foto para centrar la cara dentro del recuadro. Con el zoom ajustá el tamaño de la cabeza y con el giro enderezá
          los hombros.
        </p>
        <Deslizador etiqueta="Zoom" valor={zoom} min={0.5} max={6} paso={0.05} pasoBoton={0.1} formato={(v) => `${v.toFixed(2)}×`} onChange={onZoomChange} />
        <Deslizador etiqueta="Giro" valor={rotation} min={-45} max={45} paso={1} pasoBoton={1} formato={(v) => `${v}°`} onChange={onRotationChange} />
      </div>
    </div>
  );
}
