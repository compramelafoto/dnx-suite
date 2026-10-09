/**
 * Formato liviano del texto de un contrato → bloques. Módulo PURO.
 *
 * Nunca se interpreta HTML del usuario: la salida es una lista de bloques de datos que cada
 * renderizador (pantalla, PDF) dibuja por su cuenta.
 *
 * Sintaxis del texto:
 * - `# Título` y `## Subtítulo` (al principio de la línea) son títulos.
 * - `**negrita**` dentro de títulos y párrafos. Un `**` sin pareja queda como texto.
 * - Una línea en blanco separa párrafos; un salto simple dentro de un párrafo se conserva.
 *
 * Salto de página y tablas NO se escriben a mano: vienen de variables (`[salto_de_pagina]`,
 * `[pedido_items]`, `[pedido_cuotas]`) que `variables.ts` reemplaza por regiones delimitadas con un
 * carácter privado (`MARCA`) que no se ve. Sólo `variables.ts` las produce: el texto de la plantilla y
 * los datos de las personas pasan por `sinMarca`, así que nadie puede fabricarlas escribiendo. En el
 * texto guardado (y en su huella) la tabla queda como filas con tabulaciones, legible tal cual.
 */

/** Carácter privado (zona de uso privado de Unicode) que delimita las regiones especiales. */
export const MARCA = "\uE001";

export type Segmento = { texto: string; negrita: boolean };

export type Bloque =
  | { tipo: "titulo"; nivel: 1 | 2; segmentos: Segmento[] }
  | { tipo: "parrafo"; segmentos: Segmento[] }
  | { tipo: "salto" }
  | { tipo: "tabla"; filas: string[][] };

/** Saca la marca de un texto de afuera (plantilla, nombres, domicilios…). */
export function sinMarca(texto: string): string {
  return texto.includes(MARCA) ? texto.split(MARCA).join("") : texto;
}

/** Región de salto de página, para que la use `variables.ts`. */
export const REGION_SALTO = `${MARCA}salto${MARCA}`;

/** Región de tabla: la primera fila es el encabezado. Las celdas no pueden tener tabulaciones ni saltos. */
export function regionTabla(filas: readonly (readonly string[])[]): string {
  const limpias = filas.map((f) => f.map((c) => sinMarca(c).replace(/[\t\r\n]+/g, " ").trim()).join("\t"));
  return `${MARCA}tabla${MARCA}${limpias.join("\n")}${MARCA}fin${MARCA}`;
}

const REGIONES = new RegExp(`${MARCA}(salto|tabla)${MARCA}(?:([\\s\\S]*?)${MARCA}fin${MARCA})?`, "g");

/** Negritas de una línea: `**…**`. Nunca devuelve segmentos vacíos. */
export function segmentarNegrita(texto: string): Segmento[] {
  const salida: Segmento[] = [];
  const partes = texto.split("**");
  // Con una cantidad par de partes hay un `**` sin pareja al final: ese resto queda literal.
  const sinPareja = partes.length % 2 === 0;
  partes.forEach((parte, i) => {
    const negrita = i % 2 === 1 && !(sinPareja && i === partes.length - 1);
    let t = parte;
    if (sinPareja && i === partes.length - 1) t = `**${parte}`;
    if (!t) return;
    const ultimo = salida[salida.length - 1];
    if (ultimo && ultimo.negrita === negrita) ultimo.texto += t;
    else salida.push({ texto: t, negrita });
  });
  return salida;
}

function bloquesDeTexto(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let parrafo: string[] = [];
  const cerrar = () => {
    if (!parrafo.length) return;
    const segmentos = segmentarNegrita(parrafo.join("\n"));
    if (segmentos.length) bloques.push({ tipo: "parrafo", segmentos });
    parrafo = [];
  };
  for (const linea of texto.replace(/\r\n?/g, "\n").split("\n")) {
    const titulo = /^(#{1,2}) +(\S.*)$/.exec(linea);
    if (titulo) {
      cerrar();
      bloques.push({ tipo: "titulo", nivel: titulo[1]!.length === 1 ? 1 : 2, segmentos: segmentarNegrita(titulo[2]!.trim()) });
    } else if (linea.trim() === "") {
      cerrar();
    } else {
      parrafo.push(linea.replace(/\s+$/, ""));
    }
  }
  cerrar();
  return bloques;
}

/** Texto final del contrato → bloques. Una región mal formada se ignora (queda sin marca, como texto). */
export function aBloques(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let desde = 0;
  for (const m of texto.matchAll(REGIONES)) {
    bloques.push(...bloquesDeTexto(sinMarca(texto.slice(desde, m.index))));
    desde = m.index + m[0].length;
    if (m[1] === "salto") {
      bloques.push({ tipo: "salto" });
    } else if (m[2] !== undefined) {
      const filas = m[2].split("\n").map((f) => f.split("\t"));
      bloques.push({ tipo: "tabla", filas });
    }
  }
  bloques.push(...bloquesDeTexto(sinMarca(texto.slice(desde))));
  return bloques;
}

/** El texto sin marcas ni formato, para mostrarlo como texto plano (el salto de página es una línea). */
export function aTextoPlano(texto: string): string {
  return sinMarca(texto.replace(REGIONES, (_t, tipo: string, filas?: string) => (tipo === "salto" ? "\n———\n" : `\n${filas ?? ""}\n`)));
}
