/**
 * Las versiones reducidas de cada foto.
 *
 * Existen por la **regla anti-bypass** del capítulo 12.4: el fotógrafo no descarga las
 * fotos de los invitados. Si pudiera entregarle los originales a su cliente por su cuenta,
 * el adicional de descarga —que es 100% ingreso de la plataforma— no se vendería nunca.
 *
 * Un permiso no alcanza para eso. Mientras el panel le muestre el original, alcanza con el
 * botón derecho. La única forma es **no darle nunca los bytes del original**: todo lo que
 * se ve en una pantalla es una variante reducida, y el original sólo sale dentro del ZIP
 * que se paga.
 */

export type Etiqueta = "pantalla" | "panel";

export type Medida = {
  etiqueta: Etiqueta;
  /** El lado más largo, en píxeles. La proporción no se toca. */
  ladoMayor: number;
  /** Calidad del JPEG, de 1 a 100. */
  calidad: number;
};

export const MEDIDAS: readonly Medida[] = [
  /*
    1920 en el lado mayor: un televisor de salón es 1920×1080 y una foto vertical de fiesta
    se muestra completa. Más que eso es regalar resolución que después se vende.
  */
  { etiqueta: "pantalla", ladoMayor: 1920, calidad: 82 },
  /*
    640 para la grilla del panel. Moderar es decidir si una foto va o no va, y para eso
    alcanza con verla. Bajar treinta fotos grandes para decidir treinta veces "sí" es
    tiempo de espera y tráfico que no hace falta.
  */
  { etiqueta: "panel", ladoMayor: 640, calidad: 70 },
] as const;

/**
 * Dónde vive la variante.
 *
 * Cuelga del nombre del original con un sufijo, así se ve de dónde salió con sólo mirar la
 * clave. Siempre `.jpg`: la variante se genera nosotros, y un HEIC de iPhone no lo abre
 * ningún navegador.
 */
export function claveDeVariante(original: string, etiqueta: Etiqueta): string {
  const barra = original.lastIndexOf("/");
  const punto = original.lastIndexOf(".");
  // El punto sólo cuenta si está en el nombre del archivo, no en una carpeta.
  const sinExtension = punto > barra ? original.slice(0, punto) : original;
  return `${sinExtension}--${etiqueta}.jpg`;
}

export type VarianteGuardada = { label: string; storageKey: string };

/**
 * Qué clave mostrar, o `null`.
 *
 * Si falta la que se pidió se cae a la otra: una miniatura donde iba una grande se ve
 * peor, pero se ve. Lo que **nunca** se devuelve es el original — antes de eso, nada.
 */
export function varianteParaMirar(
  variantes: readonly VarianteGuardada[],
  quiero: Etiqueta,
): string | null {
  const pedida = variantes.find((v) => v.label === quiero);
  if (pedida) return pedida.storageKey;

  const otra = variantes.find((v) => MEDIDAS.some((m) => m.etiqueta === v.label));
  return otra?.storageKey ?? null;
}
