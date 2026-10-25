/**
 * Cómo se entrega cada foto elegida en un canje, dicho para la familia.
 *
 * Las copias sueltas se imprimen con el archivo original de la foto: el sistema no la recorta
 * ni la gira (la carpeta de impresión lleva el original, ordenado por tamaño). Por eso una foto
 * horizontal sale en papel horizontal y una vertical en papel vertical. Lo único que puede
 * variar es el borde: la proporción de la cámara (3:2) no es exactamente la del papel 15x21
 * (1,4), y eso lo resuelve quien imprime con un borde finito o un recorte mínimo en las puntas.
 *
 * Los digitales se descargan con el archivo original, sin achicar ni recortar.
 */

export type Orientacion = "horizontal" | "vertical" | "cuadrada";

/** Diferencia entre lados por debajo de la cual la foto se considera cuadrada. */
const TOLERANCIA_CUADRADA = 0.03;
/** Diferencia de proporción entre foto y papel a partir de la cual vale avisar de los bordes. */
const TOLERANCIA_PAPEL = 0.03;

export const TEXTO_DIGITAL = "Digital en alta calidad, en su formato original";

export function orientacionDeLaFoto(ancho: number | null | undefined, alto: number | null | undefined): Orientacion | null {
  if (!ancho || !alto || !Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) return null;
  const mayor = Math.max(ancho, alto);
  if (Math.abs(ancho - alto) / mayor <= TOLERANCIA_CUADRADA) return "cuadrada";
  return ancho > alto ? "horizontal" : "vertical";
}

/**
 * "15x21 cm", "15 X 21", "15×21" → "15x21". Devuelve `null` si no es una medida (vacío,
 * "DIGITAL", un nombre de producto).
 */
export function medidaDeCopia(size: string | null | undefined): string | null {
  if (!size) return null;
  const m = size.trim().match(/^(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)(?:\s*cm)?$/);
  return m ? `${m[1]}x${m[2]}` : null;
}

/** Proporción lado largo / lado corto de una medida "15x21". */
function proporcionDeMedida(medida: string): number | null {
  const [a, b] = medida.split("x").map((n) => Number(n.replace(",", ".")));
  if (!a || !b) return null;
  return Math.max(a, b) / Math.min(a, b);
}

/**
 * Lo que se lee junto a una copia impresa: "Copia 15x21 · se imprime horizontal". Sin medida,
 * "Copia impresa · …". Si todavía no se sabe la forma de la foto (no cargó) o es cuadrada, no
 * se promete un sentido: "se imprime en el sentido de la foto".
 */
export function textoFormatoCopia(size: string | null | undefined, orientacion: Orientacion | null): string {
  const medida = medidaDeCopia(size);
  const copia = medida ? `Copia ${medida}` : "Copia impresa";
  if (orientacion === "horizontal" || orientacion === "vertical") return `${copia} · se imprime ${orientacion}`;
  return `${copia} · se imprime en el sentido de la foto`;
}

/**
 * Aviso de bordes cuando la forma de la foto no es la del papel (una foto de cámara, 3:2, en
 * papel 15x21). `null` si coinciden, si no hay medida o si no se conoce la foto.
 */
export function avisoDeBordes(
  size: string | null | undefined,
  ancho: number | null | undefined,
  alto: number | null | undefined
): string | null {
  const medida = medidaDeCopia(size);
  if (!medida || !orientacionDeLaFoto(ancho, alto)) return null;
  const papel = proporcionDeMedida(medida);
  if (!papel) return null;
  const foto = Math.max(ancho!, alto!) / Math.min(ancho!, alto!);
  if (Math.abs(foto - papel) / papel <= TOLERANCIA_PAPEL) return null;
  return `El papel ${medida} no tiene exactamente la forma de la foto: según quien imprime, puede llevar un borde finito o perder muy poquito en las puntas.`;
}
