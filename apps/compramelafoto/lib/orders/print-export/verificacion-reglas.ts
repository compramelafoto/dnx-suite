/**
 * Reglas de pantalla de «Verificar lote»: qué se muestra de cada archivo, el resumen por tamaño y
 * los avisos de resolución y forma. Sin servidor (lo usa el visor del navegador) y sin base de datos,
 * para poder probarlo. Las filas las arma `verificacion` con lo mismo que el ZIP.
 */

export type TipoDeArchivo = "FOTO" | "PDF";

/** Una fila de la verificación. Lo que va al navegador (sin la clave de R2: la agrega el servidor). */
export type ArchivoAVerificar = {
  /** Lugar en la lista, empieza en 1. */
  n: number;
  /** El ZIP (o la parte) donde llega. */
  zip: string;
  /** Ruta completa dentro del ZIP. */
  ruta: string;
  archivo: string;
  /** Carpeta dentro del ZIP («15x21 Mate»); vacío si va en la raíz. */
  carpeta: string;
  tipo: TipoDeArchivo;
  pedido: string | null;
  cliente: string | null;
  detalle: string | null;
  producto: string | null;
  tamano: string | null;
  acabado: string | null;
  copias: number;
};

/** Copias por tamaño y acabado, de mayor a menor cantidad: el resumen de arriba de la verificación. */
export function copiasPorTamano(filas: readonly ArchivoAVerificar[]): Array<{ texto: string; copias: number; archivos: number }> {
  const grupos = new Map<string, { copias: number; archivos: number }>();
  for (const f of filas) {
    const texto = f.tamano ? [f.tamano, f.acabado].filter(Boolean).join(" ") : f.tipo === "PDF" ? "PDF" : "Otros";
    const g = grupos.get(texto) ?? { copias: 0, archivos: 0 };
    g.copias += f.copias;
    g.archivos += 1;
    grupos.set(texto, g);
  }
  return [...grupos.entries()]
    .map(([texto, g]) => ({ texto, ...g }))
    .sort((a, b) => b.copias - a.copias || a.texto.localeCompare(b.texto, "es", { numeric: true }));
}

/** «10x15» → [10, 15] en cm; null si no se entiende. */
export function medidaEnCm(tamano: string | null | undefined): [number, number] | null {
  const m = String(tamano ?? "").match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const a = Number(m[1]!.replace(",", "."));
  const b = Number(m[2]!.replace(",", "."));
  return a > 0 && b > 0 ? [a, b] : null;
}

export type CalidadDeLaFoto = {
  /** Puntos por pulgada a ese tamaño (el lado más corto manda). */
  dpi: number;
  /** Cuánto se aleja la forma de la foto de la del papel: 0 = igual; 0,1 = 10 %. */
  diferenciaDeForma: number;
  avisos: string[];
};

/** Por debajo, la copia puede verse pixelada. */
export const DPI_BAJO = 150;
/** Más de esto de diferencia de forma: el laboratorio recorta una parte visible. */
export const DIFERENCIA_DE_FORMA = 0.08;

/** Resolución y forma de una foto contra el papel. Null si el tamaño no es una medida («Foto grupal»). */
export function calidadDeLaFoto(anchoPx: number, altoPx: number, tamano: string | null | undefined): CalidadDeLaFoto | null {
  const cm = medidaEnCm(tamano);
  if (!cm || anchoPx <= 0 || altoPx <= 0) return null;
  const [cortoCm, largoCm] = cm[0] <= cm[1] ? cm : [cm[1], cm[0]];
  const cortoPx = Math.min(anchoPx, altoPx);
  const largoPx = Math.max(anchoPx, altoPx);
  const dpi = Math.round(Math.min(cortoPx / (cortoCm / 2.54), largoPx / (largoCm / 2.54)));
  const formaFoto = largoPx / cortoPx;
  const formaPapel = largoCm / cortoCm;
  const diferenciaDeForma = Math.abs(formaFoto - formaPapel) / formaPapel;
  const avisos: string[] = [];
  if (dpi < DPI_BAJO) avisos.push(`Resolución baja para ${tamano}: ${dpi} dpi (conviene 200 o más).`);
  if (diferenciaDeForma > DIFERENCIA_DE_FORMA) {
    avisos.push(
      formaFoto > formaPapel
        ? `La foto es más alargada que el papel ${tamano}: el laboratorio va a recortar los extremos.`
        : `La foto es más cuadrada que el papel ${tamano}: el laboratorio va a recortar arriba y abajo.`,
    );
  }
  return { dpi, diferenciaDeForma, avisos };
}

/** «2,4 MB», «850 KB». */
export function textoDelPeso(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
