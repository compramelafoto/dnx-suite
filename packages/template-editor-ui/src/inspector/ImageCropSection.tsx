"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PHOTO_CROP, PHOTO_CROP_MAX_ZOOM, normalizePhotoCrop, type PhotoCrop } from "@repo/template-editor-core";
import { FieldLabel, InspectorPanel } from "./InspectorPanel";
import { NumberSliderField } from "./NumberSliderField";

/**
 * Encuadre de la foto dentro de su marco: el marco queda quieto y la foto se agranda o se corre
 * adentro, como en los diseñadores de fotolibro. También gira el marco, que hasta ahora sólo se
 * podía girar arrastrando el tirador.
 *
 * Junto con el encuadre se guarda el tamaño original de la foto: la vista previa y la impresión
 * lo necesitan para ubicarla igual que en pantalla.
 */

type Props = {
  src: string;
  cfg: Record<string, unknown>;
  rotation: number;
  updateConfig: (patch: Record<string, unknown>) => void;
  setRotation: (deg: number) => void;
};

/** Tamaño natural de una imagen, una vez cargada. */
export function useNaturalImageSize(src: string): { w: number; h: number } | null {
  const [size, setSize] = useState<{ src: string; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!src) return;
    let vigente = true;
    const img = new Image();
    img.onload = () => {
      if (vigente) setSize({ src, w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => {
      vigente = false;
    };
  }, [src]);
  return size && size.src === src ? { w: size.w, h: size.h } : null;
}

const smallBtn =
  "h-7 rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-2 text-[11px] font-medium text-[color:var(--te-ink)] transition-colors hover:bg-[color:var(--te-chrome-sunken)] disabled:opacity-50";

/** Lleva un ángulo a (-180, 180]. */
function normalizarGiro(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return Math.round(d * 10) / 10;
}

export function ImageCropSection({ src, cfg, rotation, updateConfig, setRotation }: Props) {
  const natural = useNaturalImageSize(src);
  const crop = cfg.crop ? normalizePhotoCrop(cfg.crop) : DEFAULT_PHOTO_CROP;
  const centrada = crop.zoom === 1 && crop.x === 0 && crop.y === 0;

  function cambiar(patch: Partial<PhotoCrop>) {
    const siguiente = normalizePhotoCrop({ ...crop, ...patch });
    updateConfig({
      crop: siguiente,
      ...(natural ? { srcWidth: natural.w, srcHeight: natural.h } : {}),
    });
  }

  return (
    <InspectorPanel title="Encuadre">
      <p className="text-[11px] leading-snug text-[color:var(--te-ink-muted)]">
        Doble clic sobre la foto para arrastrarla dentro del marco; la rueda del mouse acerca y aleja.
      </p>
      <div>
        <FieldLabel>Zoom</FieldLabel>
        <NumberSliderField
          ariaLabel="Zoom de la foto dentro del marco"
          value={crop.zoom}
          min={1}
          max={PHOTO_CROP_MAX_ZOOM}
          step={0.05}
          onChange={(zoom) => cambiar({ zoom })}
        />
      </div>
      <div>
        <FieldLabel>Horizontal</FieldLabel>
        <NumberSliderField
          ariaLabel="Correr la foto a izquierda o derecha dentro del marco"
          value={crop.x}
          min={-1}
          max={1}
          step={0.01}
          onChange={(x) => cambiar({ x })}
        />
      </div>
      <div>
        <FieldLabel>Vertical</FieldLabel>
        <NumberSliderField
          ariaLabel="Correr la foto arriba o abajo dentro del marco"
          value={crop.y}
          min={-1}
          max={1}
          step={0.01}
          onChange={(y) => cambiar({ y })}
        />
      </div>
      <button
        type="button"
        className={smallBtn}
        disabled={centrada}
        onClick={() => updateConfig({ crop: null })}
      >
        Centrar foto
      </button>

      <div>
        <FieldLabel>Giro del marco (°)</FieldLabel>
        <NumberSliderField
          ariaLabel="Giro del marco en grados"
          value={rotation}
          min={-180}
          max={180}
          step={1}
          onChange={(deg) => setRotation(normalizarGiro(deg))}
        />
        <div className="mt-1.5 flex gap-1.5">
          <button type="button" className={smallBtn} onClick={() => setRotation(normalizarGiro(rotation - 90))}>
            ⟲ 90°
          </button>
          <button type="button" className={smallBtn} onClick={() => setRotation(normalizarGiro(rotation + 90))}>
            ⟳ 90°
          </button>
          <button type="button" className={smallBtn} disabled={rotation === 0} onClick={() => setRotation(0)}>
            Derecho
          </button>
        </div>
      </div>
    </InspectorPanel>
  );
}
