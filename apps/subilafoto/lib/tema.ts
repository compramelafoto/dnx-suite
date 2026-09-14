/**
 * El tema visual de un evento (capítulo 8).
 *
 * Las plantillas de Subí la Foto son **datos**, no un motor: un puñado de colores y una
 * tipografía que el front aplica con CSS. Elegir plantilla es cambiar estos valores.
 *
 * Todo lo que sale de acá termina en un atributo `style`, así que nada entra sin validar:
 * un valor con `;` o con `url(...)` podría inyectar CSS en la página del invitado.
 */

export type Tema = {
  fondo: string;
  texto: string;
  acento: string;
  textoSobreAcento: string;
  tipografia: string;
};

/** Sin plantilla elegida, el evento se ve con la identidad de Subí la Foto. */
export const TEMA_BASE: Tema = {
  fondo: "#200638",
  texto: "#FFFFFF",
  acento: "#FFD51F",
  textoSobreAcento: "#200638",
  tipografia: "var(--slf-font)",
};

/** Sólo colores hexadecimales de 3 o 6 dígitos. Nada de funciones ni de nombres. */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Para la tipografía: letras, números, espacios, comas, comillas y var(--…) de la marca. */
const TIPOGRAFIA_SEGURA = /^(?:var\(--[a-z0-9-]+\)|[a-zA-Z0-9 ,'"-]{1,120})$/;

function colorValido(valor: unknown, porDefecto: string): string {
  return typeof valor === "string" && HEX.test(valor.trim()) ? valor.trim() : porDefecto;
}

function tipografiaValida(valor: unknown, porDefecto: string): string {
  return typeof valor === "string" && TIPOGRAFIA_SEGURA.test(valor.trim())
    ? valor.trim()
    : porDefecto;
}

export function resolverTema(tokens: unknown): Tema {
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) return TEMA_BASE;

  const t = tokens as Record<string, unknown>;

  return {
    fondo: colorValido(t.fondo, TEMA_BASE.fondo),
    texto: colorValido(t.texto, TEMA_BASE.texto),
    acento: colorValido(t.acento, TEMA_BASE.acento),
    textoSobreAcento: colorValido(t.textoSobreAcento, TEMA_BASE.textoSobreAcento),
    tipografia: tipografiaValida(t.tipografia, TEMA_BASE.tipografia),
  };
}
