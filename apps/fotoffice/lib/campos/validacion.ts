import {
  MAX_CLAVE, MAX_ENLACE, MAX_NOMBRE_CAMPO, MAX_TEXTO, MAX_TEXTO_LARGO, type TipoCampo,
} from "./constantes";

export type ValorCampo = { texto?: string; numero?: string; fecha?: string; booleano?: boolean; opcionId?: string };
export type ResultadoValor = { ok: true; valor: ValorCampo | null } | { ok: false; error: string };

/** Clave estable del campo: minúsculas, sin acentos, con guion bajo, hasta 40. El sufijo `_2` lo pone quien crea. */
export function claveDeCampo(nombre: string): string {
  const k = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_CLAVE)
    .replace(/_+$/g, "");
  return k || "campo";
}

export function validarNombreCampo(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return "Poné un nombre para el campo.";
  if (raw.trim().length > MAX_NOMBRE_CAMPO) return `El nombre puede tener hasta ${MAX_NOMBRE_CAMPO} caracteres.`;
  return null;
}

const NUMERO = /^(-?)(\d+)(?:[.,](\d{1,4}))?$/;
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function fechaReal(s: string): boolean {
  const m = FECHA.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

const no = (error: string): ResultadoValor => ({ ok: false, error });

export function validarValor(tipo: TipoCampo, raw: unknown, opcionesValidas: string[]): ResultadoValor {
  if (raw === null || raw === undefined) return { ok: true, valor: null };
  if (typeof raw === "string" && !raw.trim()) return { ok: true, valor: null };

  switch (tipo) {
    case "TEXTO":
    case "TEXTO_LARGO": {
      if (typeof raw !== "string") return no("El valor tiene que ser texto.");
      const max = tipo === "TEXTO" ? MAX_TEXTO : MAX_TEXTO_LARGO;
      const t = raw.trim();
      if (t.length > max) return no(`El texto puede tener hasta ${max} caracteres.`);
      return { ok: true, valor: { texto: t } };
    }
    case "NUMERO": {
      if (typeof raw === "number" && !Number.isFinite(raw)) return no("Ingresá un número válido.");
      if (typeof raw !== "number" && typeof raw !== "string") return no("Ingresá un número válido.");
      const m = NUMERO.exec(String(raw).trim());
      if (!m) return no("Ingresá un número válido, con hasta 4 decimales (por ejemplo 12,5).");
      const [, signo, entero, dec] = m;
      const enteroLimpio = entero.replace(/^0+(?=\d)/, "");
      if (enteroLimpio.length > 14) return no("El número es demasiado grande.");
      const decimales = (dec ?? "").replace(/0+$/, "");
      const cuerpo = decimales ? `${enteroLimpio}.${decimales}` : enteroLimpio;
      const esCero = Number(cuerpo) === 0;
      return { ok: true, valor: { numero: `${esCero ? "" : signo}${cuerpo}` } };
    }
    case "FECHA": {
      if (typeof raw !== "string" || !fechaReal(raw.trim())) return no("Ingresá una fecha real con formato AAAA-MM-DD.");
      return { ok: true, valor: { fecha: raw.trim() } };
    }
    case "ENLACE": {
      if (typeof raw !== "string") return no("El enlace tiene que ser texto.");
      const t = raw.trim();
      if (t.length > MAX_ENLACE) return no(`El enlace puede tener hasta ${MAX_ENLACE} caracteres.`);
      let u: URL;
      try {
        u = new URL(t);
      } catch {
        return no("El enlace tiene que empezar con http:// o https://.");
      }
      if ((u.protocol !== "http:" && u.protocol !== "https:") || !/^https?:\/\/[^\s/]+/i.test(t) || /\s/.test(t) || !u.hostname) {
        return no("El enlace tiene que empezar con http:// o https:// y no llevar espacios.");
      }
      return { ok: true, valor: { texto: t } };
    }
    case "SI_NO": {
      if (raw === "si") return { ok: true, valor: { booleano: true } };
      if (raw === "no") return { ok: true, valor: { booleano: false } };
      return no("Elegí Sí o No.");
    }
    case "LISTA": {
      if (typeof raw !== "string" || !opcionesValidas.includes(raw)) return no("Elegí una de las opciones de la lista.");
      return { ok: true, valor: { opcionId: raw } };
    }
  }
}

/** Texto para historial y exportación. */
export function textoLegible(tipo: TipoCampo, valor: ValorCampo | null, etiquetasDeOpcion: Record<string, string>): string {
  if (!valor) return "";
  switch (tipo) {
    case "TEXTO":
    case "TEXTO_LARGO":
    case "ENLACE":
      return valor.texto ?? "";
    case "NUMERO": {
      if (valor.numero === undefined) return "";
      const [e, d] = valor.numero.split(".");
      const dec = (d ?? "").replace(/0+$/, "");
      const n = dec ? `${e},${dec}` : e;
      return n === "-0" ? "0" : n;
    }
    case "FECHA": {
      if (!valor.fecha) return "";
      const [a, m, d] = valor.fecha.split("-");
      return `${d}/${m}/${a}`;
    }
    case "SI_NO":
      return valor.booleano === undefined ? "" : valor.booleano ? "Sí" : "No";
    case "LISTA":
      return (valor.opcionId && etiquetasDeOpcion[valor.opcionId]) || "";
  }
}
