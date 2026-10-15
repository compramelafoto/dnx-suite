"use client";

/**
 * Los marcos del combo: un lugar por foto ya pagada, que se llena a medida que la familia
 * elige. Es la pieza que hace visible "te faltan 2" sin leer nada.
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
};

const SIZES = {
  lg: "w-24 h-32 sm:w-28 sm:h-36",
  md: "w-16 h-20 sm:w-20 sm:h-24",
  sm: "w-12 h-16",
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
}: Props) {
  return (
    <ol className="m-0 flex list-none justify-center gap-2.5 p-0 sm:gap-3" aria-label="Fotos de tu combo">
      {Array.from({ length: slots }, (_, i) => {
        const id = photoIds[i];
        const label = labels?.[i];
        const activo = i === activeIndex && id == null;
        return (
          <li key={i} className="relative flex flex-col items-center">
            {id != null ? (
              <div
                className={`${SIZES[size]} overflow-hidden rounded-md border-[3px] border-white bg-[#efe9e2] shadow-[0_1px_3px_rgba(60,40,20,0.25)] ring-1 ring-[#2f7d5b]/40`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl(id)} alt={`Foto ${i + 1} del combo`} className="h-full w-full object-cover" />
                {onRemove ? (
                  <button
                    type="button"
                    onClick={() => onRemove(id)}
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm text-[#4b4f56] shadow ring-1 ring-black/10 focus-visible:outline-2 focus-visible:outline-[#c27b3d]"
                    aria-label={`Sacar la foto ${i + 1} del combo`}
                  >
                    ✕
                  </button>
                ) : null}
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
          </li>
        );
      })}
    </ol>
  );
}
