import { fail, ok, type Result } from "../result";
import { formatDateUtc, parseDateUtc } from "./dates";
import type {
  ResolvedVariables,
  VariableContract,
  VariableDeclaration,
  VariableValues,
} from "./contract";

const MARCADOR = /\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g;

function ausente(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "string") return valor.trim() === "";
  return false;
}

function convertir(
  decl: VariableDeclaration,
  valor: string | number | Date,
): { ok: true; texto: string } | { ok: false; motivo: string } {
  switch (decl.type) {
    case "number": {
      const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
      if (!Number.isFinite(n)) {
        return { ok: false, motivo: `"${decl.label}" (${decl.key}) tiene que ser un número.` };
      }
      const decimales = decl.decimals ?? 0;
      return { ok: true, texto: n.toFixed(decimales) };
    }
    case "date": {
      if (typeof valor === "number") {
        return { ok: false, motivo: `"${decl.label}" (${decl.key}) tiene que ser una fecha.` };
      }
      const d = parseDateUtc(valor);
      if (!d) {
        return {
          ok: false,
          motivo: `"${decl.label}" (${decl.key}) no es una fecha válida. Usá el formato AAAA-MM-DD.`,
        };
      }
      return { ok: true, texto: formatDateUtc(d, decl.dateFormat ?? "es-AR-short") };
    }
    case "url":
    case "qrPayload": {
      const texto = String(valor).trim();
      if (decl.type === "url" && !/^https?:\/\/\S+$/.test(texto)) {
        return {
          ok: false,
          motivo: `"${decl.label}" (${decl.key}) tiene que ser un enlace que empiece con http.`,
        };
      }
      return { ok: true, texto };
    }
    case "image":
    case "text":
    default:
      return { ok: true, texto: String(valor) };
  }
}

/**
 * Convierte los valores del producto en texto listo para dibujar.
 *
 * `maxLength` NO se controla acá: la spec lo pone en la validación de publicación, contra el
 * valor de ejemplo. Frenar una emisión real porque un apellido es largo sería peor que
 * dejarla salir; frenar la publicación de una plantilla que no da el ancho es correcto.
 */
export function resolveVariables(
  contract: VariableContract,
  values: VariableValues,
): Result<ResolvedVariables> {
  const errores: string[] = [];
  const resueltas: Record<string, string> = {};
  const omitidas: string[] = [];

  for (const decl of contract.variables) {
    const bruto = values[decl.key];
    if (ausente(bruto)) {
      if (decl.required) {
        errores.push(
          `Falta un dato obligatorio: "${decl.label}" (${decl.key}). No se emite la pieza con ese campo vacío.`,
        );
      } else {
        resueltas[decl.key] = "";
        omitidas.push(decl.key);
      }
      continue;
    }
    const convertido = convertir(decl, bruto as string | number | Date);
    if (!convertido.ok) {
      errores.push(convertido.motivo);
      continue;
    }
    resueltas[decl.key] = convertido.texto;
  }

  if (errores.length > 0) return fail(...errores);
  return ok({ values: resueltas, omitted: omitidas });
}

/**
 * Reemplaza los marcadores `{{clave}}`. Un marcador sin declarar es un error del diseño, no
 * un hueco que se rellena con nada: por eso lanza en vez de devolver cadena vacía.
 */
export function interpolate(plantilla: string, resueltas: Record<string, string>): string {
  return plantilla.replace(MARCADOR, (_todo, clave: string) => {
    const valor = resueltas[clave];
    if (valor === undefined) {
      throw new Error(
        `El diseño usa la variable "${clave}" pero el contrato no la declara. Revisá la plantilla.`,
      );
    }
    return valor;
  });
}

/** Marcadores que aparecen en un texto. Lo usa la validación de publicación. */
export function placeholdersOf(plantilla: string): string[] {
  const encontrados = new Set<string>();
  for (const m of plantilla.matchAll(MARCADOR)) {
    const clave = m[1];
    if (clave) encontrados.add(clave);
  }
  return [...encontrados];
}
