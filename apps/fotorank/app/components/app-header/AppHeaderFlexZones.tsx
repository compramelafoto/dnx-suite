import type { ReactNode } from "react";
import { SIDEBAR_WIDTH_PX } from "@repo/design-system/components/sidebar";

/**
 * Shell del header en tres zonas. En FotoRank (landing + dashboard) **`center` debe ser `null`**:
 * la navegación global va en `FullscreenMenu` y, en dashboard, en el sidebar — ver `APP_SHELL_HEADER.md`.
 */
type AppHeaderFlexZonesProps = {
  /** Zona izquierda: logo (+ controles solo desktop si los pasás ahí). */
  left: ReactNode;
  /** Navegación central; en móvil no se renderiza la fila (solo md+). Si es null, en desktop la franja central queda vacía (sin “Más” ni placeholders). */
  center: ReactNode | null;
  /** Zona derecha: siempre visible (acciones + hamburguesa móvil si aplica). */
  right: ReactNode;
  /** Altura de cada fila (móvil / desktop). Por defecto `h-16`. */
  rowClassName?: string;
  /**
   * Primera franja = ancho del panel lateral (`SIDEBAR_WIDTH_PX`), contenido centrado (logo + X/hamburguesa
   * alineados visualmente sobre el drawer/sidebar). Home y dashboard comparten el mismo criterio.
   */
  alignLeftWithSidebarBand?: boolean;
};

/**
 * Layout en flexbox (sin grid):
 * - Móvil: dos zonas `justify-between` (izq / der); sin columna central en el DOM.
 * - md+: tres zonas `flex-1` con misma base; centro `justify-center` para alinear el nav al eje visual de su tercio.
 */
export function AppHeaderFlexZones({
  left,
  center,
  right,
  rowClassName = "h-16",
  alignLeftWithSidebarBand = false,
}: AppHeaderFlexZonesProps) {
  const sidebarBandStyle = { width: SIDEBAR_WIDTH_PX, flexShrink: 0 } as const;
  const sidebarBandMobileStyle = {
    width: `min(${SIDEBAR_WIDTH_PX}px, calc(100vw - 7rem))`,
    flexShrink: 0,
  } as const;

  return (
    <>
      {/* Móvil: solo izquierda y derecha — nada “colgando” en el centro */}
      <div className={`flex w-full items-center gap-2 md:hidden ${rowClassName}`}>
        {alignLeftWithSidebarBand ? (
          <>
            <div
              className="flex items-center justify-center gap-2 px-1"
              style={sidebarBandMobileStyle}
            >
              {left}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{right}</div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center justify-start gap-3">{left}</div>
            <div className="flex shrink-0 items-center justify-end gap-3">{right}</div>
          </>
        )}
      </div>

      {/* Desktop */}
      {alignLeftWithSidebarBand ? (
        <div className={`hidden w-full items-center gap-0 md:flex ${rowClassName}`}>
          <div
            className="flex items-center justify-center gap-2 px-2 md:gap-3"
            style={sidebarBandStyle}
          >
            {left}
          </div>
          <div
            className={`flex min-w-0 flex-1 items-center px-2 ${center != null ? "justify-center" : ""}`}
          >
            {center}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-3">{right}</div>
        </div>
      ) : (
        <div className={`hidden w-full items-center gap-3 md:flex md:gap-4 lg:gap-4 ${rowClassName}`}>
          <div className="flex min-w-0 flex-1 basis-0 items-center justify-start gap-3">{left}</div>
          <div className="flex min-w-0 flex-1 basis-0 items-center justify-center px-2">
            {center}
          </div>
          <div className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-3">{right}</div>
        </div>
      )}
    </>
  );
}
