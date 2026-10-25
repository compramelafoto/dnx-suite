"use client";

/**
 * Los marcos del combo: un lugar por foto ya pagada, que se llena a medida que la familia
 * elige. Es la pieza que hace visible "te faltan 2" sin leer nada.
 *
 * Un lugar lleno muestra la foto ENTERA: el marco toma la forma de la foto (horizontal o
 * vertical) en vez de recortarla. Antes era un marco vertical con la foto recortada, y una
 * familia que eligió la grupal del curso veía medio curso y pensaba que la copia salía así.
 */

type Props = {
  slots: number;
  photoIds: number[];
  thumbUrl: (photoId: number) => string;
  onRemove?: (photoId: number) => void;
  size?: "lg" | "md" | "sm";
  /** Qué foto va en cada lugar ("Foto individual", "Foto grupal"), si la plantilla lo dice. */
  labels?: Array<string | undefined>;
  /** El lugar que se está llenando ahora; se resalta. */
  activeIndex?: number;
  /** Tocar un lugar vacío lo elige como el próximo a llenar. */
  onPickEmpty?: (index: number) => void;
  /** Texto bajo cada foto elegida: en qué formato la recibe ("Copia 15x21 · se imprime horizontal"). */
  caption?: (photoId: number) => string | null;
  /** Avisa cuando carga cada foto, para medirla (ancho y alto reales). */
  onImgLoad?: (photoId: number, img: HTMLImageElement | null) => void;
};

/** Lugar vacío: un marco vertical, como siempre. */
const SIZES = {
  lg: "w-24 h-32 sm:w-28 sm:h-36",
  md: "w-16 h-20 sm:w-20 sm:h-24",
  sm: "w-12 h-16",
};

/** Lugar lleno: un cuadro donde entra la foto entera, sea horizontal o vertical. */
const CAJA = {
  lg: "h-28 w-28 sm:h-36 sm:w-36",
  md: "h-20 w-20 sm:h-24 sm:w-24",
  sm: "h-16 w-16",
};
const FOTO = {
  lg: "max-h-28 max-w-28 sm:max-h-36 sm:max-w-36",
  md: "max-h-20 max-w-20 sm:max-h-24 sm:max-w-24",
  sm: "max-h-16 max-w-16",
};

export default function ComboFrames({
  slots,
  photoIds,
  thumbUrl,
  onRemove,
  size = "md",
  labels,
  activeIndex = -1,
  onPickEmpty,
  caption,
  onImgLoad,
}: Props) {
  return (
    <ol className="m-0 flex list-none flex-wrap justify-center gap-2.5 p-0 sm:gap-3" aria-label="Fotos de tu combo">
      {Array.from({ length: slots }, (_, i) => {
        const id = photoIds[i];
        const label = labels?.[i];
        const activo = i === activeIndex && id == null;
        return (
          <li key={i} className="relative flex flex-col items-center">
            {id != null ? (
              <div className={`${CAJA[size]} flex items-center justify-center`}>
                <div className="relative rounded-md border-[3px] border-white bg-[#efe9e2] shadow-[0_1px_3px_rgba(60,40,20,0.25)] ring-1 ring-[#2f7d5b]/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(id)}
                    alt={`Foto ${i + 1} del combo`}
                    ref={onImgLoad ? (el) => onImgLoad(id, el) : undefined}
                    onLoad={onImgLoad ? (e) => onImgLoad(id, e.currentTarget) : undefined}
                    className={`${FOTO[size]} block h-auto w-auto rounded-[3px]`}
                  />
                  {onRemove ? (
                    <button
                      type="button"
                      onClick={() => onRemove(id)}
                      className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm text-[#4b4f56] shadow ring-1 ring-black/10 focus-visible:outline-2 focus-visible:outline-[#c27b3d]"
                      aria-label={`Sacar la foto ${i + 1} del combo`}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={!onPickEmpty}
                onClick={() => onPickEmpty?.(i)}
                className={`${SIZES[size]} flex items-center justify-center rounded-md border-2 border-dashed px-1 text-center font-medium leading-tight disabled:cursor-default ${
                  activo
                    ? "border-[#c27b3d] bg-[#fdf3ea] text-[#a8652e]"
                    : "border-[#c9bfb3] bg-[#faf8f6] text-[#a89c8f]"
                } ${label ? "text-[11px]" : "text-lg"}`}
                aria-label={label ? `Lugar vacío: ${label}` : `Lugar ${i + 1} vacío`}
              >
                {label ?? i + 1}
              </button>
            )}
            {label && id != null ? (
              <span className="mt-1 max-w-[7rem] text-[10px] leading-tight text-[#6b6f76]">{label}</span>
            ) : null}
            {id != null && caption?.(id) ? (
              <span className="mt-1 max-w-[7.5rem] text-[11px] font-medium leading-tight text-[#2f7d5b]">
                {caption(id)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
