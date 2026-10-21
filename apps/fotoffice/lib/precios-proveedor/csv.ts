import Papa from "papaparse";
import { claveRenglon, normalizarMedida } from "./clave";

/**
 * El CSV que devuelve ChatGPT a partir del PDF del proveedor. Módulo PURO.
 *
 * Se tolera lo que un modelo de lenguaje suele agregar: el bloque de código alrededor,
 * encabezados con mayúsculas o tildes, `$` y puntos de miles en el precio.
 */

export const ENCABEZADO_CSV = [
  "proveedor",
  "vigencia",
  "tipo",
  "categoria",
  "producto",
  "modelo",
  "medida",
  "variante",
  "cantidad_minima",
  "unidad",
  "precio",
  "codigo_proveedor",
  "notas",
] as const;

export const TIPOS_RENGLON = ["PRODUCTO", "TAPA", "HOJA", "CAJA", "ADICIONAL"] as const;
export type TipoRenglon = (typeof TIPOS_RENGLON)[number];

export const MAX_RENGLONES_LISTA = 3000;
const MAX_PRECIO_MINOR = 999_999_900;

export type RenglonLista = {
  fila: number;
  proveedor: string;
  vigencia: string;
  tipo: TipoRenglon;
  categoria: string;
  producto: string;
  modelo: string | null;
  medida: string | null;
  variante: string | null;
  cantidadMinima: number | null;
  unidad: string;
  costoMinor: number;
  codigoProveedor: string | null;
  notas: string | null;
  clave: string;
};

export type AnalisisLista = {
  renglones: RenglonLista[];
  errores: { fila: number; error: string }[];
  duplicadas: number;
  vigencia: string | null;
  proveedor: string | null;
  errorGeneral: string | null;
};

function sinBloqueDeCodigo(texto: string): string {
  const m = /```[a-zA-Z]*\s*\n([\s\S]*?)```/.exec(texto);
  return (m ? m[1]! : texto).replace(/^﻿/, "");
}

function campo(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** "$10 .200" → 1.020.000 centavos. Sólo pesos enteros (se toleran ",00"). */
export function precioDeLista(raw: string): number | null {
  const t = raw.replace(/[$\s.]/g, "").replace(/,0{1,2}$/, "");
  if (!/^\d+$/.test(t)) return null;
  const minor = Number(t) * 100;
  return minor > 0 && minor <= MAX_PRECIO_MINOR ? minor : null;
}

function texto(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export function analizarCsvLista(entrada: string): AnalisisLista {
  const vacio: AnalisisLista = { renglones: [], errores: [], duplicadas: 0, vigencia: null, proveedor: null, errorGeneral: null };
  const limpio = sinBloqueDeCodigo(entrada ?? "").trim();
  if (limpio === "") return { ...vacio, errorGeneral: "El CSV está vacío." };

  const r = Papa.parse<Record<string, string>>(limpio, { header: true, skipEmptyLines: "greedy" });
  const columnas = new Map<string, string>();
  const esperadas = new Set(ENCABEZADO_CSV.map(campo));
  for (const h of r.meta.fields ?? []) if (esperadas.has(campo(h)) && !columnas.has(campo(h))) columnas.set(campo(h), h);
  for (const obligatoria of ["producto", "precio"]) {
    if (!columnas.has(obligatoria)) {
      return { ...vacio, errorGeneral: `Falta la columna "${obligatoria}". El encabezado tiene que ser: ${ENCABEZADO_CSV.join(",")}` };
    }
  }
  if (r.data.length > MAX_RENGLONES_LISTA) return { ...vacio, errorGeneral: `La lista tiene más de ${MAX_RENGLONES_LISTA} renglones.` };

  const v = (fila: Record<string, string>, c: string) => {
    const h = columnas.get(c.replace(/_/g, ""));
    return h ? (fila[h] ?? "").trim() : "";
  };

  const porClave = new Map<string, RenglonLista>();
  const errores: AnalisisLista["errores"] = [];
  let duplicadas = 0;
  let vigencia: string | null = null;
  let proveedor: string | null = null;

  r.data.forEach((fila, i) => {
    const n = i + 1;
    const tipoRaw = (v(fila, "tipo") || "PRODUCTO").toUpperCase();
    if (!(TIPOS_RENGLON as readonly string[]).includes(tipoRaw)) {
      errores.push({ fila: n, error: `El tipo "${tipoRaw}" no es válido (PRODUCTO, TAPA, HOJA, CAJA o ADICIONAL).` });
      return;
    }
    const producto = v(fila, "producto");
    if (producto === "") {
      errores.push({ fila: n, error: "Falta el nombre del producto." });
      return;
    }
    const costoMinor = precioDeLista(v(fila, "precio"));
    if (costoMinor === null) {
      errores.push({ fila: n, error: `El precio "${v(fila, "precio")}" no se entiende.` });
      return;
    }
    const cantRaw = v(fila, "cantidad_minima");
    let cantidadMinima: number | null = null;
    if (cantRaw !== "") {
      cantidadMinima = Number(cantRaw.replace(/\D/g, ""));
      if (!Number.isInteger(cantidadMinima) || cantidadMinima <= 0) {
        errores.push({ fila: n, error: `La cantidad mínima "${cantRaw}" no se entiende.` });
        return;
      }
    }
    const vig = v(fila, "vigencia");
    if (vigencia === null && /^\d{4}-\d{2}$/.test(vig)) vigencia = vig;
    if (proveedor === null && v(fila, "proveedor") !== "") proveedor = v(fila, "proveedor");

    const base = {
      tipo: tipoRaw as TipoRenglon,
      categoria: v(fila, "categoria"),
      producto,
      modelo: texto(v(fila, "modelo")),
      medida: normalizarMedida(v(fila, "medida")),
      variante: texto(v(fila, "variante")),
      cantidadMinima,
    };
    const renglon: RenglonLista = {
      fila: n,
      proveedor: v(fila, "proveedor"),
      vigencia: vig,
      ...base,
      unidad: v(fila, "unidad").toLowerCase() || "unidad",
      costoMinor,
      codigoProveedor: texto(v(fila, "codigo_proveedor")),
      notas: texto(v(fila, "notas")),
      clave: claveRenglon(base),
    };
    if (porClave.has(renglon.clave)) {
      duplicadas += 1;
      porClave.delete(renglon.clave);
    }
    porClave.set(renglon.clave, renglon);
  });

  return { renglones: [...porClave.values()].sort((a, b) => a.fila - b.fila), errores, duplicadas, vigencia, proveedor, errorGeneral: null };
}
