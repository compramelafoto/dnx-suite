/**
 * La clave con la que se agrupan las distintas formas de escribir una ciudad.
 *
 * "ROSARIO", "rosario" y "Rosario (SANTA FE - CP. 2000)" con provincia
 * "Snta Fe" dan todas `rosario|santa fe`. Es pura y determinística: la usan
 * tanto la inscripción al guardarse como la sección Personas al leer.
 */

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\bc\.?\s?p\.?\s*\d+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_DE_PROVINCIA: Record<string, string> = {
  "snta fe": "santa fe",
  "sta fe": "santa fe",
  "sante fe": "santa fe",
  "santafe": "santa fe",
  "bs as": "buenos aires",
  "bsas": "buenos aires",
  "pba": "buenos aires",
  "provincia de buenos aires": "buenos aires",
  "caba": "ciudad autonoma de buenos aires",
  "capital federal": "ciudad autonoma de buenos aires",
  "cdad autonoma de buenos aires": "ciudad autonoma de buenos aires",
  "cba": "cordoba",
  "ctes": "corrientes",
  "sgo del estero": "santiago del estero",
  "tdf": "tierra del fuego",
};

export function normalizarProvincia(provincia: string | null | undefined): string {
  const limpia = normalizar(provincia ?? "");
  return ALIAS_DE_PROVINCIA[limpia] ?? limpia;
}

export function normalizarCiudad(ciudad: string | null | undefined): string {
  return normalizar(ciudad ?? "");
}

/** `null` si no hay ciudad: sin ciudad no hay nada que ubicar. */
export function claveDeLocalidad(
  ciudad: string | null | undefined,
  provincia: string | null | undefined,
): string | null {
  const c = normalizarCiudad(ciudad);
  if (!c) return null;
  return `${c}|${normalizarProvincia(provincia)}`;
}
