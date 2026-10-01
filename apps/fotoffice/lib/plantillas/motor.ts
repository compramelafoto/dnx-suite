/**
 * Motor de plantillas: analiza el texto (variables, bloques condicionales, errores) y lo completa. Puro.
 *
 * Sintaxis:
 * - `[clave]` y `[campo:clave]`: una variable.
 * - `[si:clave]…[/si]` y `[si:campo:clave]…[/si]`: el bloque desaparece entero si la variable está vacía.
 *   Los bloques no se anidan.
 *
 * Qué cuenta como marcador: TOKEN = /\[(\/?[a-z_:][a-z0-9_:]*)\]/
 * - Un `[`, una barra opcional, un primer carácter en a-z, `_` o `:`, después a-z, 0-9, `_` o `:`, y `]`.
 *   Sólo minúsculas ASCII: los dígitos se admiten después del primer carácter porque las claves de
 *   campos de 0.5 (`claveDeCampo`) son a-z0-9_ y pueden empezar con un número (`[campo:2do_nombre]`).
 * - Lo que encaja con TOKEN y no es una variable permitida es ERROR (con su posición, base 0).
 * - Lo que no encaja (`[nota al pie]`, `[Nombre]`, `[2026]`, `[]`, `[ñandú]`) es texto literal.
 */
import { CARACTER_MARCADOR, CLAVE_FIRMA, MARCADOR_FIRMA } from "./constantes";

const TOKEN = /\[(\/?[a-z_:][a-z0-9_:]*)\]/g;
const PREFIJO_SI = "si:";
const PREFIJO_CAMPO = "campo:";

export type PiezaSimple = { tipo: "texto"; texto: string } | { tipo: "variable"; clave: string };
export type Pieza = PiezaSimple | { tipo: "bloque"; clave: string; piezas: PiezaSimple[] };

export type ErrorPlantilla = { posicion: number; mensaje: string; variable?: string };
export type ResultadoAnalisis = { ok: true; piezas: Pieza[] } | { ok: false; errores: ErrorPlantilla[] };

function desconocida(posicion: number, clave: string): ErrorPlantilla {
  return {
    posicion,
    variable: clave,
    mensaje: `La variable [${clave}] no existe o no se puede usar en este tipo de plantilla.`,
  };
}

/** Valida una clave de variable; devuelve el error o null. */
function validarClave(clave: string, posicion: number, permitidas: ReadonlySet<string>): ErrorPlantilla | null {
  if (clave === PREFIJO_CAMPO) return { posicion, variable: clave, mensaje: "Falta la clave del campo en [campo:]." };
  return permitidas.has(clave) ? null : desconocida(posicion, clave);
}

export function analizar(texto: string, permitidas: ReadonlySet<string>): ResultadoAnalisis {
  const raiz: Pieza[] = [];
  const errores: ErrorPlantilla[] = [];
  let bloque: { clave: string; posicion: number; piezas: PiezaSimple[] } | null = null;
  let desde = 0;

  const agregarTexto = (t: string) => {
    if (!t) return;
    const destino: Pieza[] = bloque ? bloque.piezas : raiz;
    const ultima = destino[destino.length - 1];
    if (ultima?.tipo === "texto") ultima.texto += t;
    else destino.push({ tipo: "texto", texto: t });
  };

  for (const m of texto.matchAll(TOKEN)) {
    const posicion = m.index;
    const contenido = m[1]!;
    agregarTexto(texto.slice(desde, posicion));
    desde = posicion + m[0].length;

    if (contenido.startsWith("/")) {
      if (contenido !== "/si") {
        errores.push({ posicion, mensaje: `[${contenido}] no es un cierre válido: los bloques se cierran con [/si].` });
      } else if (!bloque) {
        errores.push({ posicion, mensaje: "Hay un [/si] sin un [si:…] que lo abra." });
      } else {
        raiz.push({ tipo: "bloque", clave: bloque.clave, piezas: bloque.piezas });
        bloque = null;
      }
      continue;
    }

    if (contenido.startsWith(PREFIJO_SI)) {
      const clave = contenido.slice(PREFIJO_SI.length);
      if (bloque) {
        errores.push({ posicion, mensaje: "Los bloques [si:…] no se pueden anidar: cerrá el anterior con [/si] antes de abrir otro." });
        continue;
      }
      if (!clave) {
        errores.push({ posicion, mensaje: "Falta la variable en [si:]." });
        continue;
      }
      const error = validarClave(clave, posicion, permitidas);
      if (error) errores.push(error);
      bloque = { clave, posicion, piezas: [] };
      continue;
    }

    const error = validarClave(contenido, posicion, permitidas);
    if (error) {
      errores.push(error);
      continue;
    }
    (bloque ? bloque.piezas : raiz).push({ tipo: "variable", clave: contenido });
  }

  if (bloque) {
    errores.push({ posicion: bloque.posicion, variable: bloque.clave, mensaje: `Falta cerrar el bloque [si:${bloque.clave}] con [/si].` });
  }
  agregarTexto(texto.slice(desde));

  return errores.length ? { ok: false, errores } : { ok: true, piezas: raiz };
}

export type ResultadoCompletar = {
  texto: string;
  /** Variables que quedaron vacías en el texto final, sin repetir y en orden de aparición. */
  vacias: string[];
  /** Si el texto pidió `[firma]` (en un lugar visible). El render la agrega al final sólo si es false. */
  conFirma: boolean;
};

function sinMarcador(s: string): string {
  return s.includes(CARACTER_MARCADOR) ? s.split(CARACTER_MARCADOR).join("") : s;
}

function vacio(v: string | null): boolean {
  return v == null || v.trim() === "";
}

/**
 * Completa las piezas con los valores. Una variable vacía queda vacía; un bloque cuya variable está
 * vacía desaparece entero. `[firma]` deja `MARCADOR_FIRMA`, que reemplaza el render.
 */
export function completar(piezas: readonly Pieza[], valores: (clave: string) => string | null): ResultadoCompletar {
  let texto = "";
  const vacias: string[] = [];
  let conFirma = false;

  const simple = (p: PiezaSimple) => {
    if (p.tipo === "texto") {
      texto += sinMarcador(p.texto);
      return;
    }
    if (p.clave === CLAVE_FIRMA) {
      texto += MARCADOR_FIRMA;
      conFirma = true;
      return;
    }
    const v = valores(p.clave);
    if (vacio(v)) {
      if (!vacias.includes(p.clave)) vacias.push(p.clave);
      return;
    }
    texto += sinMarcador(v!);
  };

  for (const p of piezas) {
    if (p.tipo !== "bloque") {
      simple(p);
      continue;
    }
    if (vacio(valores(p.clave))) continue;
    for (const q of p.piezas) simple(q);
  }

  return { texto, vacias, conFirma };
}
