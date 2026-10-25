import type { Ref } from "react";

/**
 * Una página de impresión de tamaño fijo con la imagen al tamaño real en mm. La página real es fija:
 * con una escala mayor a 1000 la imagen se recorta (overflow hidden), no pasa a otra hoja.
 * La usan la página de una hoja y la de toda la preparación.
 */
export function PaginaATamano({
  src,
  anchoMm,
  altoMm,
  paginaAnchoMm,
  paginaAltoMm,
  imgRef,
  clave,
  onLoad,
  onError,
  className,
}: {
  src: string;
  /** Con la corrección de escala de la impresora. */
  anchoMm: number;
  altoMm: number;
  paginaAnchoMm: number;
  paginaAltoMm: number;
  imgRef?: Ref<HTMLImageElement>;
  /** Identifica la imagen para saber cuáles ya cargaron (`data-clave`). */
  clave?: string;
  onLoad: () => void;
  onError: () => void;
  className?: string;
}) {
  return (
    <div className={className} style={{ width: `${paginaAnchoMm}mm`, height: `${paginaAltoMm}mm`, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- el tamaño en mm es el punto: no se optimiza */}
      <img
        ref={imgRef}
        data-clave={clave}
        src={src}
        alt=""
        onLoad={onLoad}
        onError={onError}
        style={{ width: `${anchoMm}mm`, height: `${altoMm}mm`, display: "block", maxWidth: "none" }}
      />
    </div>
  );
}
