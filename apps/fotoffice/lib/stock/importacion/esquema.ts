import { z } from "zod";

/**
 * Esquema de lo que se lee de una factura (stock etapa 3). Módulo puro: sin base ni red.
 * Lo usan la lectura con IA (salida estructurada) y el lector de CSV.
 */

const nuloString = z.string().nullable();
const nuloNumero = z.number().finite().nullable();

export const filaSchema = z.object({
  codigo_barras: nuloString,
  codigo_proveedor: nuloString,
  descripcion: z.string(),
  cantidad: z.number().finite(),
  unidad: nuloString,
  unidades_por_paquete: z.number().int().nullable(),
  costo_unitario: nuloNumero,
  alicuota_iva: nuloNumero,
  subtotal: nuloNumero,
  /** Sólo viene del CSV (INSUMO | PRODUCTO); la IA no lo informa. */
  tipo: nuloString.optional(),
});

export const documentoSchema = z.object({
  proveedor: nuloString,
  cuit: nuloString,
  /** AAAA-MM-DD */
  fecha: nuloString,
  comprobante: nuloString,
  precios_con_iva: z.boolean().nullable(),
  total: nuloNumero,
  filas: z.array(filaSchema),
});

export type FilaImportada = z.infer<typeof filaSchema>;
export type DocumentoImportado = z.infer<typeof documentoSchema>;

const ns = { type: ["string", "null"] } as const;
const nn = { type: ["number", "null"] } as const;

/** JSON Schema para la salida estructurada de Claude: sin propiedades extra y todo en `required`. */
export const SCHEMA_FACTURA = {
  type: "object",
  additionalProperties: false,
  properties: {
    proveedor: ns,
    cuit: ns,
    fecha: ns,
    comprobante: ns,
    precios_con_iva: { type: ["boolean", "null"] },
    total: nn,
    filas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          codigo_barras: ns,
          codigo_proveedor: ns,
          descripcion: { type: "string" },
          cantidad: { type: "number" },
          unidad: ns,
          unidades_por_paquete: { type: ["integer", "null"] },
          costo_unitario: nn,
          alicuota_iva: nn,
          subtotal: nn,
        },
        required: [
          "codigo_barras",
          "codigo_proveedor",
          "descripcion",
          "cantidad",
          "unidad",
          "unidades_por_paquete",
          "costo_unitario",
          "alicuota_iva",
          "subtotal",
        ],
      },
    },
  },
  required: ["proveedor", "cuit", "fecha", "comprobante", "precios_con_iva", "total", "filas"],
} as const;

export function validarDocumento(
  json: unknown,
): { ok: true; doc: DocumentoImportado } | { ok: false } {
  const r = documentoSchema.safeParse(json);
  return r.success ? { ok: true, doc: r.data } : { ok: false };
}

/**
 * Lee un número escrito a la argentina o a la anglosajona.
 * "1.234,50" ⇒ 1234.5; "1234.50" ⇒ 1234.5; "$ 2.000" ⇒ 2000; "21 %" ⇒ 21; "" ⇒ null.
 * Un punto solo seguido de exactamente tres dígitos se toma como separador de miles ("2.000").
 */
export function normalizarNumero(texto: string): number | null {
  let t = String(texto ?? "")
    .replace(/[$%\s ]/g, "")
    .replace(/^ARS/i, "");
  if (!t) return null;
  let signo = 1;
  if (t.startsWith("-")) {
    signo = -1;
    t = t.slice(1);
  } else if (t.startsWith("+")) {
    t = t.slice(1);
  }
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;

  const ultimaComa = t.lastIndexOf(",");
  const ultimoPunto = t.lastIndexOf(".");
  let limpio: string;
  if (ultimaComa !== -1 && ultimoPunto !== -1) {
    // Gana como decimal el que aparece último.
    const decimal = ultimaComa > ultimoPunto ? "," : ".";
    const miles = decimal === "," ? "." : ",";
    limpio = t.split(miles).join("").replace(decimal, ".");
  } else if (ultimaComa !== -1) {
    limpio = soloUnSeparador(t, ",");
  } else if (ultimoPunto !== -1) {
    limpio = soloUnSeparador(t, ".");
  } else {
    limpio = t;
  }
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? signo * n : null;
}

function soloUnSeparador(t: string, sep: "," | "."): string {
  const partes = t.split(sep);
  if (partes.length > 2) return partes.join(""); // "1.234.567": miles
  const [ent, dec] = partes;
  if (sep === "." && dec.length === 3 && ent.length >= 1 && ent !== "0") return ent + dec; // "2.000"
  return `${ent}.${dec}`;
}

/**
 * Compara la suma de las líneas con el total del documento. Si no hay total, cuadra.
 * Tolerancia: el mayor entre 1 % del total y 100 pesos.
 */
export function cuadre(doc: DocumentoImportado): { cuadra: boolean; sumaPesos: number } {
  let suma = 0;
  for (const f of doc.filas) {
    if (f.subtotal != null) suma += f.subtotal;
    else if (f.costo_unitario != null) suma += f.cantidad * f.costo_unitario;
  }
  suma = Math.round(suma * 100) / 100;
  if (doc.total == null) return { cuadra: true, sumaPesos: suma };
  const tolerancia = Math.max(Math.abs(doc.total) * 0.01, 100);
  return { cuadra: Math.abs(suma - doc.total) <= tolerancia, sumaPesos: suma };
}
