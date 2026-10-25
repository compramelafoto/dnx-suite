import type { Fase } from "./en-curso-puro";

/**
 * "Importar trabajos" desde una planilla (las de Google Sheets que el estudio usaba antes).
 * Módulo PURO: lee el texto pegado y lo convierte en filas listas para importar, con los errores
 * de cada renglón. Una fila por renglón, separada por `|` o por tabulador:
 *
 *   Cliente | Teléfono | Tipo | Detalle | Total | Seña | Estado | Entrega
 *
 * - Tipo: VHS, DVD, CD, CASETE, ROLLO, FOTOLIBRO o LABORATORIO.
 * - Estado: RECIBIDO, EN PROCESO, EN EL PROVEEDOR (o ENVIADO) o LISTO PARA RETIRAR.
 * - Entrega: dd/mm, dd/mm/aaaa o aaaa-mm-dd (opcional).
 *
 * La seña ya se cobró antes de FOTOFFICE: el pedido se arma por lo que resta, así la Caja no
 * recibe plata que entró en otro momento.
 */

export const TIPOS_IMPORTACION = {
  VHS: { producto: "Digitalización de VHS", circuito: null, proveedor: null },
  DVD: { producto: "Digitalización de DVD", circuito: null, proveedor: null },
  CD: { producto: "Digitalización de CD", circuito: null, proveedor: null },
  CASETE: { producto: "Digitalización de casete de audio", circuito: null, proveedor: null },
  ROLLO: { producto: "Revelado de rollo", circuito: null, proveedor: "Estudio del Bajo" },
  FOTOLIBRO: { producto: null, circuito: "Fotolibro", proveedor: "Román" },
  LABORATORIO: { producto: null, circuito: "Impresión en laboratorio", proveedor: "Fotolag" },
} as const;
export type TipoImportacion = keyof typeof TIPOS_IMPORTACION;

export type FilaImportacion = {
  renglon: number;
  cliente: string;
  telefono: string | null;
  tipo: TipoImportacion;
  detalle: string;
  /** En pesos enteros. */
  total: number;
  sena: number;
  fase: Exclude<Fase, "ENTREGADO">;
  /** "aaaa-mm-dd" o null. */
  entrega: string | null;
  /** Huella del renglón: importarlo dos veces no lo duplica. */
  clave: string;
};

export type ErrorImportacion = { renglon: number; texto: string; error: string };

const ESTADOS: Record<string, Exclude<Fase, "ENTREGADO">> = {
  RECIBIDO: "RECIBIDO",
  "EN PROCESO": "EN_PROCESO",
  PROCESO: "EN_PROCESO",
  "EN EL PROVEEDOR": "EN_PROVEEDOR",
  PROVEEDOR: "EN_PROVEEDOR",
  ENVIADO: "EN_PROVEEDOR",
  "LISTO PARA RETIRAR": "LISTO",
  "PARA RETIRAR": "LISTO",
};

function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "$56,100.00", "193800", "12.000", "$ 4.500,50" → pesos enteros. Vacío = 0. */
export function leerMonto(t: string): number | null {
  const s = t.replace(/[$\s]/g, "");
  if (s === "") return 0;
  let n: string;
  if (s.includes(",") && s.includes(".")) {
    // El separador que aparece último es el decimal.
    n = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    n = /,\d{3}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (s.includes(".")) {
    n = /\.\d{3}$/.test(s) ? s.replace(/\./g, "") : s;
  } else n = s;
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
}

/** dd/mm (año de `hoy`), dd/mm/aaaa o aaaa-mm-dd. */
export function leerFecha(t: string, hoy: string): string | null | "invalida" {
  const s = t.trim();
  if (s === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(s);
  if (!m) return "invalida";
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const anio = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(hoy.slice(0, 4));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return "invalida";
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Huella corta y estable del renglón (FNV-1a), sin depender de `crypto`. */
function huella(t: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function leerImportacion(texto: string, hoy: string): { filas: FilaImportacion[]; errores: ErrorImportacion[] } {
  const filas: FilaImportacion[] = [];
  const errores: ErrorImportacion[] = [];
  texto.split(/\r?\n/).forEach((linea, i) => {
    const renglon = i + 1;
    if (linea.trim() === "") return;
    const c = linea.split(linea.includes("|") ? "|" : "\t").map((x) => x.trim());
    if (renglon === 1 && normalizar(c[0] ?? "") === "CLIENTE") return; // encabezado
    const falla = (error: string) => errores.push({ renglon, texto: linea.trim(), error });
    const [cliente = "", telefono = "", tipoT = "", detalle = "", totalT = "", senaT = "", estadoT = "", entregaT = ""] = c;
    if (cliente === "") return falla("Falta el cliente.");
    const tipo = normalizar(tipoT).replace("CASSETTE", "CASETE") as TipoImportacion;
    if (!(tipo in TIPOS_IMPORTACION)) return falla(`Tipo «${tipoT}» desconocido: VHS, DVD, CD, CASETE, ROLLO, FOTOLIBRO o LABORATORIO.`);
    const total = leerMonto(totalT);
    const sena = leerMonto(senaT);
    if (total === null || sena === null) return falla("Un monto no se entiende.");
    const fase = ESTADOS[normalizar(estadoT) || "RECIBIDO"];
    if (!fase) return falla(`Estado «${estadoT}» desconocido: RECIBIDO, EN PROCESO, EN EL PROVEEDOR o LISTO PARA RETIRAR.`);
    const entrega = leerFecha(entregaT, hoy);
    if (entrega === "invalida") return falla(`La fecha «${entregaT}» no se entiende.`);
    const digitos = telefono.replace(/\D/g, "");
    filas.push({
      renglon,
      cliente: cliente.replace(/\s+/g, " "),
      telefono: digitos.length >= 6 ? digitos : null,
      tipo,
      detalle: detalle.replace(/\s+/g, " "),
      total,
      sena: Math.min(sena, total || sena),
      fase,
      entrega,
      clave: huella(normalizar([cliente, digitos, tipo, detalle, total, sena].join("|"))),
    });
  });
  return { filas, errores };
}

/** Lo que queda por cobrar (la seña ya entró antes). */
export function restaDeFila(f: Pick<FilaImportacion, "total" | "sena">): number {
  return Math.max(0, f.total - f.sena);
}

/** Mismo teléfono: los últimos 10 dígitos (sin 0 ni 15 delante, sin +54 9). */
export function mismoTelefono(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const corto = (t: string) => t.replace(/\D/g, "").slice(-10);
  return corto(a).length >= 8 && corto(a) === corto(b);
}

export const MARCA_IMPORTACION = (clave: string) => `[importado:${clave}]`;
