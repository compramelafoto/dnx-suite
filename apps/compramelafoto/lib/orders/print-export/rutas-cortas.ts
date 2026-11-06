/**
 * Nombres cortos para las carpetas y archivos del ZIP de impresión.
 *
 * Por qué: Windows no descomprime rutas de más de 260 caracteres contando desde la unidad
 * ("C:\Users\Maria Fernanda\Downloads\Impresiones 2026-11-06\…"). Con la ruta vieja
 * (`Pedido-Album-003888 - Maria Fernanda Gonzalez/Foto individual con la seño/BRILLO/15x21 cm/
 * 2 Copias - 15x21 cm - DSC_20261012_….jpg`) el Explorador daba error a mitad del ZIP.
 *
 * Reglas: el tamaño sin "cm", el acabado sólo si el fotógrafo lo cargó, el producto sólo si no es
 * el genérico, el cliente como "número + nombre recortado", y la copia como "2x nombre".
 * Además, `ajustarRuta` pone un tope final a cualquier ruta que entre al ZIP.
 */

import path from "path";
import { safeFilename } from "@/lib/safe-filename";
import { esGenerico } from "./export-product-name";

/** Largo máximo de una ruta dentro del ZIP: deja ~140 caracteres para la carpeta donde se descomprime. */
export const LARGO_MAXIMO_RUTA = 120;

/** Recorta sin dejar espacios, puntos ni guiones al final (Windows no acepta carpetas que terminan en punto). */
export function recortar(texto: string, max: number): string {
  return texto.slice(0, max).replace(/[\s.\-_]+$/, "");
}

function limpio(texto: string | null | undefined): string {
  return safeFilename(String(texto ?? ""), "").trim();
}

/** "15x21 cm" → "15x21"; "10 x 15" → "10x15". */
export function tamanoCorto(size: string | null | undefined): string {
  return limpio(size)
    .replace(/\s*cm\.?$/i, "")
    .replace(/\s*x\s*/gi, "x")
    .trim();
}

/** "BRILLO" → "Brillo". Vacío si el fotógrafo no cargó el acabado: no se inventa "Brillo". */
export function acabadoCorto(finish: string | null | undefined): string {
  const a = limpio(finish);
  return a ? a.charAt(0).toUpperCase() + a.slice(1).toLowerCase() : "";
}

/** Carpeta de un tamaño: "15x21 Mate", "10x15 Brillo Polaroid", "13x18". */
export function carpetaDeImpresion(i: { tamano: string; acabado: string; producto: string }): string {
  const producto = esGenerico(i.producto) ? "" : recortar(i.producto, 24);
  const partes = [i.tamano, i.acabado, producto].filter(Boolean);
  return recortar(partes.join(" "), 40) || "Copias";
}

/** Carpeta del pedido: "3888 Maria Fernanda Gonzal". */
export function carpetaDePedido(codigo: string, cliente: string | null | undefined): string {
  const nombre = recortar(limpio(cliente), 24);
  return nombre ? `${codigo} ${nombre}` : codigo;
}

/** Archivo de una copia: "2x DSC_1234.jpg". El tamaño ya está en la carpeta. */
export function nombreDeCopia(copias: number, original: string): string {
  const ext = path.extname(original) || ".jpg";
  const base = recortar(limpio(path.basename(original, ext)), 40) || "foto";
  return `${copias}x ${base}${ext.toLowerCase()}`;
}

/**
 * Tope final para cualquier ruta del ZIP: si se pasa de largo recorta el nombre del archivo
 * (nunca la extensión) y, si dos archivos terminan con el mismo nombre, numera el segundo.
 */
export function ajustarRuta(zipPath: string, usadas: Set<string>, max = LARGO_MAXIMO_RUTA): string {
  const carpeta = path.posix.dirname(zipPath);
  const prefijo = carpeta === "." ? "" : `${carpeta}/`;
  const ext = path.posix.extname(zipPath);
  const base = path.posix.basename(zipPath, ext);
  const armar = (sufijo: string) => {
    const lugar = Math.max(8, max - prefijo.length - ext.length - sufijo.length);
    return `${prefijo}${recortar(base, lugar)}${sufijo}${ext}`;
  };
  let ruta = armar("");
  for (let n = 2; usadas.has(ruta.toLowerCase()); n++) ruta = armar(` (${n})`);
  usadas.add(ruta.toLowerCase());
  return ruta;
}
