import sharp from "sharp";

/**
 * Compara dos imágenes de la misma página: la del lienzo (navegador) y la del PDF.
 *
 * No se busca igualdad píxel a píxel: el navegador y el PDF suavizan los bordes de las letras de
 * forma distinta. Las dos se achican y se desenfocan apenas, así esas diferencias finas se
 * borran, y lo que queda es lo que una persona notaría: un texto que se mueve, una letra
 * distinta, una línea que se corta en otro lugar, algo que falta.
 *
 * Cada punto se mira dos veces: con poco desenfoque, para ver formas y letras corridas, y con
 * mucho, para ver un color de fondo o de relleno distinto aunque sea suave (un rosa muy claro
 * contra blanco), que con el primer umbral pasaría.
 *
 * Se miden dos cosas:
 * - cuánto de la página es distinto en total;
 * - la peor zona: la página se divide en cuadros y se mira el cuadro más distinto. Un texto
 *   chico que falta casi no pesa en el total, pero deja un cuadro muy distinto.
 */
export type ResultadoComparacion = {
  /** Fracción de la página con diferencias (0 a 1). */
  distinto: number;
  /** Fracción distinta del peor cuadro (0 a 1). */
  peorZona: number;
  /** Dónde está el peor cuadro, en fracciones de la página. */
  peorZonaEn: { x: number; y: number };
  aprobado: boolean;
  /** Imagen para mirar: la página en gris y las diferencias en rojo. */
  diferencias: Buffer;
};

export const UMBRALES = {
  /** Lado mayor al que se achican las dos imágenes antes de comparar. */
  ladoMayor: 900,
  desenfoque: 1.2,
  /** Diferencia de color (0–255, el canal que más cambia) a partir de la cual un punto es distinto. */
  diferenciaDeColor: 70,
  /** Lo mismo, con la imagen muy desenfocada: detecta zonas de otro color. */
  desenfoqueDeZona: 6,
  diferenciaDeZona: 18,
  /** Lado de los cuadros, en píxeles de la imagen achicada. */
  cuadro: 30,
  maximoDistinto: 0.015,
  maximoPeorZona: 0.3,
};

async function preparar(png: Buffer, ancho: number, alto: number, desenfoque: number): Promise<Buffer> {
  return sharp(png)
    .flatten({ background: "#ffffff" })
    .resize(ancho, alto, { fit: "fill" })
    .blur(desenfoque)
    .removeAlpha()
    .raw()
    .toBuffer();
}

export async function compararImagenes(
  pantalla: Buffer,
  pdf: Buffer,
  umbrales: Partial<typeof UMBRALES> = {},
): Promise<ResultadoComparacion> {
  const u = { ...UMBRALES, ...umbrales };
  const meta = await sharp(pantalla).metadata();
  const escala = u.ladoMayor / Math.max(meta.width ?? 1, meta.height ?? 1);
  const ancho = Math.max(1, Math.round((meta.width ?? 1) * escala));
  const alto = Math.max(1, Math.round((meta.height ?? 1) * escala));
  const [a, b, za, zb] = await Promise.all([
    preparar(pantalla, ancho, alto, u.desenfoque),
    preparar(pdf, ancho, alto, u.desenfoque),
    preparar(pantalla, ancho, alto, u.desenfoqueDeZona),
    preparar(pdf, ancho, alto, u.desenfoqueDeZona),
  ]);

  const columnas = Math.ceil(ancho / u.cuadro);
  const filas = Math.ceil(alto / u.cuadro);
  const porCuadro = new Uint32Array(columnas * filas);
  const totalPorCuadro = new Uint32Array(columnas * filas);
  const salida = Buffer.alloc(ancho * alto * 3);
  let distintos = 0;

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 3;
      const d = Math.max(
        Math.abs(a[i]! - b[i]!),
        Math.abs(a[i + 1]! - b[i + 1]!),
        Math.abs(a[i + 2]! - b[i + 2]!),
      );
      const dz = Math.max(
        Math.abs(za[i]! - zb[i]!),
        Math.abs(za[i + 1]! - zb[i + 1]!),
        Math.abs(za[i + 2]! - zb[i + 2]!),
      );
      const c = Math.floor(y / u.cuadro) * columnas + Math.floor(x / u.cuadro);
      totalPorCuadro[c]! += 1;
      const gris = Math.round(0.3 * a[i]! + 0.59 * a[i + 1]! + 0.11 * a[i + 2]!);
      const claro = Math.round(255 - (255 - gris) * 0.35);
      if (d > u.diferenciaDeColor || dz > u.diferenciaDeZona) {
        distintos += 1;
        porCuadro[c]! += 1;
        salida[i] = 230;
        salida[i + 1] = 30;
        salida[i + 2] = 40;
      } else {
        salida[i] = claro;
        salida[i + 1] = claro;
        salida[i + 2] = claro;
      }
    }
  }

  let peorZona = 0;
  let peorIndice = 0;
  for (let c = 0; c < porCuadro.length; c++) {
    const fraccion = porCuadro[c]! / Math.max(1, totalPorCuadro[c]!);
    if (fraccion > peorZona) {
      peorZona = fraccion;
      peorIndice = c;
    }
  }
  const distinto = distintos / (ancho * alto);
  const diferencias = await sharp(salida, { raw: { width: ancho, height: alto, channels: 3 } }).png().toBuffer();

  return {
    distinto,
    peorZona,
    peorZonaEn: {
      x: ((peorIndice % columnas) * u.cuadro) / ancho,
      y: (Math.floor(peorIndice / columnas) * u.cuadro) / alto,
    },
    aprobado: distinto <= u.maximoDistinto && peorZona <= u.maximoPeorZona,
    diferencias,
  };
}
