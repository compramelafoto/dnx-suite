/**
 * Animación de la marca: aparece en t = 60 + 600·k, visible 8 s; entra y sale deslizándose
 * desde la derecha en 0,6 s. `posicionMarcaX` (JS) y `expresionMarcaX` (ffmpeg) tienen la misma lógica.
 */
export const MARGEN = 40;
const INICIO = 60;
const PERIODO = 600;
const TRANSICION = 0.6;
const VISIBLE = 8;

export function posicionMarcaX(t: number, W: number, w: number): number {
  if (t < INICIO) return W;
  const m = (((t - INICIO) % PERIODO) + PERIODO) % PERIODO;
  const recorrido = w + MARGEN;
  if (m < TRANSICION) return W - (m / TRANSICION) * recorrido;
  if (m < VISIBLE - TRANSICION) return W - w - MARGEN;
  if (m < VISIBLE) return W - w - MARGEN + ((m - (VISIBLE - TRANSICION)) / TRANSICION) * recorrido;
  return W;
}

/** Expresión `x` del filtro overlay (variables W y w de ffmpeg). Sin comillas: las pone el filtro. */
export function expresionMarcaX(): string {
  const m = `mod(t-${INICIO},${PERIODO})`;
  const r = `(w+${MARGEN})`;
  const quieta = `W-w-${MARGEN}`;
  return (
    `if(lt(t,${INICIO}),W,` +
    `if(lt(${m},${TRANSICION}),W-(${m}/${TRANSICION})*${r},` +
    `if(lt(${m},${VISIBLE - TRANSICION}),${quieta},` +
    `if(lt(${m},${VISIBLE}),${quieta}+((${m}-${VISIBLE - TRANSICION})/${TRANSICION})*${r},W))))`
  );
}
