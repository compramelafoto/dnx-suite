/**
 * Limpieza de los datos de Alboom antes de traducirlos. Puro.
 *
 * Alboom manda casi todo como texto ("421", "1500.00", "0000-00-00"), a veces como número, y con campos que
 * pueden faltar. Acá nada falla: lo que no se entiende vuelve `null` y el traductor decide si es una duda.
 */

export function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** El payload como objeto (o uno vacío). */
export function campos(payload: unknown): Record<string, unknown> {
  return esObjeto(payload) ? payload : {};
}

/** Texto con los espacios colapsados, o `null` si no hay. Los números se aceptan como texto. */
export function texto(v: unknown, max = 500): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  if (t === "") return null;
  return t.length > max ? t.slice(0, max).trim() : t;
}

/** Texto multilínea (notas, "Sobre"): conserva los saltos, recorta espacios de cada punta. */
export function textoLargo(v: unknown, max = 5000): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r\n?/g, "\n").trim();
  if (t === "") return null;
  return t.length > max ? t.slice(0, max) : t;
}

/** Minúsculas, sin acentos, sin signos y con los espacios colapsados: decide si dos nombres son el mismo. */
export function clave(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Como `claveDeEtiqueta` de `lib/ficha/etiquetas.ts` (la unicidad de `FotofficeTag.nameKey`). */
export function claveEtiqueta(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Id de Alboom como texto ("12", 12 → "12"), o `null`. */
export function idAlboom(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === "string" && /^\s*[A-Za-z0-9_-]{1,60}\s*$/.test(v) && v.trim() !== "0") return v.trim();
  return null;
}

/** Entero ("3", 3, "3.0"), o `null`. */
export function entero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && /^\s*-?\d+(\.0+)?\s*$/.test(v)) return Math.trunc(Number(v));
  return null;
}

/** 1/"1"/true/"si"/"sim"/"yes" → true; 0/"0"/false/"no"/"nao" → false; otra cosa → null. */
export function siNo(v: unknown): boolean | null {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v !== "string") return null;
  const t = clave(v);
  if (["1", "true", "si", "sim", "yes", "s", "y"].includes(t)) return true;
  if (["0", "false", "no", "nao", "n"].includes(t)) return false;
  return null;
}

/**
 * Importe en pesos con dos decimales ("1500.00"), o `null`. Acepta 1500, "1500", "1500.5", "1.500,50",
 * "1,500.50" y "$ 1.500". Un importe negativo o ilegible es `null`.
 */
export function importe(v: unknown): string | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v.toFixed(2) : null;
  if (typeof v !== "string") return null;
  let t = v.replace(/[^\d.,-]/g, "");
  if (t === "" || t.includes("-")) return null;
  const coma = t.lastIndexOf(",");
  const punto = t.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) {
    // El último separador es el decimal; el otro, de miles.
    t = coma > punto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (coma >= 0) {
    // "1500,5" decimal; "1,500" (tres cifras después) miles.
    t = /,\d{3}$/.test(t) && t.split(",").length > 1 && !/^0,/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (punto >= 0 && t.split(".").length > 2) {
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null;
}

/** Fecha "aaaa-mm-dd" (sin hora). Acepta "aaaa-mm-dd hh:mm:ss" y "dd/mm/aaaa". "0000-00-00" y fechas imposibles → null. */
export function fecha(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  let a: string, m: string, d: string;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  const dma = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (iso) [a, m, d] = [iso[1]!, iso[2]!, iso[3]!];
  else if (dma) [a, m, d] = [dma[3]!, dma[2]!.padStart(2, "0"), dma[1]!.padStart(2, "0")];
  else return null;
  const n = new Date(`${a}-${m}-${d}T00:00:00Z`);
  if (Number.isNaN(n.getTime()) || Number(a) < 1900 || Number(a) > 2100) return null;
  // `Date` corre el 31/02 al 03/03: si no es la misma fecha, no existe.
  if (n.toISOString().slice(0, 10) !== `${a}-${m}-${d}`) return null;
  return `${a}-${m}-${d}`;
}

const FORMATO_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$/;

/** Correo en minúsculas y sin espacios; `invalido` si hay algo pero no tiene forma de correo. */
export function correo(v: unknown): { valor: string | null; invalido: boolean } {
  if (typeof v !== "string") return { valor: null, invalido: false };
  const t = v.replace(/\s+/g, "").toLowerCase();
  if (t === "") return { valor: null, invalido: false };
  if (t.length > 200 || !FORMATO_CORREO.test(t)) return { valor: null, invalido: true };
  return { valor: t, invalido: false };
}

export type Telefono = {
  /** Lo que se guarda: dígitos con el 54 adelante (y el 9 de los móviles) o, si no es argentino, los dígitos tal cual. */
  valor: string | null;
  /** Número nacional de 10 dígitos (área + abonado), para emparejar. `null` si no es un número argentino legible. */
  nacional: string | null;
  /** Había algo, pero no parece un número argentino. */
  raro: boolean;
};

/**
 * Teléfono argentino: sólo dígitos, sin el 0 de larga distancia ni el 15 de los móviles, con el prefijo del país.
 * `movil` agrega el 9 que WhatsApp exige (`lib/contact/whatsapp.ts`). Un número de otro país o de largo raro se
 * guarda con sus dígitos y se marca `raro` (duda).
 */
export function telefonoAr(v: unknown, movil: boolean): Telefono {
  const crudo = typeof v === "number" ? String(v) : typeof v === "string" ? v : "";
  let d = crudo.replace(/\D/g, "");
  if (d === "") return { valor: null, nacional: null, raro: false };
  if (d.startsWith("00")) d = d.slice(2);
  let n = d;
  if (n.startsWith("54") && n.length >= 12) {
    n = n.slice(2);
    if (n.startsWith("9") && n.length === 11) n = n.slice(1);
  }
  if (n.startsWith("0")) n = n.slice(1);
  if (n.length === 12) {
    // Área de 2 a 4 dígitos seguida del 15 de los móviles: "341 15 1234567".
    for (const area of [2, 3, 4]) {
      if (n.slice(area, area + 2) === "15") {
        n = n.slice(0, area) + n.slice(area + 2);
        break;
      }
    }
  }
  if (n.length !== 10) return { valor: d.length >= 6 && d.length <= 15 ? d : null, nacional: null, raro: true };
  return { valor: `54${movil ? "9" : ""}${n}`, nacional: n, raro: false };
}

const PALABRAS_PRUEBA = new Set(["prueba", "pruebas", "test", "teste", "testing", "demo"]);
const LOCALES_PRUEBA = new Set(["usuario", "user", "test", "teste", "prueba", "demo", "ejemplo", "example"]);
const DOMINIOS_PRUEBA = new Set(["example.com", "example.org", "test.com", "teste.com", "prueba.com", "mailinator.com"]);

/** ¿Es un dato de prueba evidente? Correos `usuario@`, `test@`, de dominios de ejemplo, o un nombre "prueba"/"test". */
export function esDatoDePrueba(c: { correo: string | null; nombres: (string | null)[] }): boolean {
  if (c.correo) {
    const [local, dominio] = c.correo.split("@") as [string, string];
    if (LOCALES_PRUEBA.has(local.replace(/[\d._+-]+$/g, "")) || DOMINIOS_PRUEBA.has(dominio)) return true;
  }
  return c.nombres.some((n) => n !== null && clave(n).split(" ").some((p) => PALABRAS_PRUEBA.has(p)));
}

/** Etiquetas de un registro de Alboom: texto separado por comas (o arreglo). Sin repetidas; las de más de `max` se descartan. */
export function partirEtiquetas(v: unknown, max = 40): { nombres: string[]; largas: number } {
  const lista = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;]/) : [];
  const vistos = new Set<string>();
  const nombres: string[] = [];
  let largas = 0;
  for (const x of lista) {
    const t = texto(esObjeto(x) ? (x.tag ?? x.name) : x, 1000);
    if (!t) continue;
    if (t.length > max) {
      largas++;
      continue;
    }
    const k = claveEtiqueta(t);
    if (vistos.has(k)) continue;
    vistos.add(k);
    nombres.push(t);
  }
  return { nombres, largas };
}
