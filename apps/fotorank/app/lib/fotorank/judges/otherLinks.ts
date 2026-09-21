/**
 * Los "otros links" del perfil de un jurado.
 *
 * Se escriben como texto, una línea por link, con el formato
 * `Nombre | https://...`. Lo que no tenga una URL http(s) válida se descarta:
 * la página pública los renderiza como enlaces y un `javascript:` ahí es un
 * agujero.
 */
import { normalizarUrl } from "./publicSignupForm";

export type OtroLink = { nombre: string; url: string };

const TOPE = 10;

export function parsearOtrosLinks(texto: string): OtroLink[] {
  const salida: OtroLink[] = [];

  for (const linea of texto.split("\n")) {
    if (salida.length >= TOPE) break;
    const limpia = linea.trim();
    if (!limpia) continue;

    const corte = limpia.indexOf("|");
    const nombreCrudo = corte >= 0 ? limpia.slice(0, corte).trim() : "";
    const urlCruda = corte >= 0 ? limpia.slice(corte + 1).trim() : limpia;

    const url = normalizarUrl(urlCruda);
    if (!url) continue;

    let nombre = nombreCrudo;
    if (!nombre) {
      try {
        nombre = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
    }
    salida.push({ nombre: nombre.slice(0, 60), url });
  }

  return salida;
}

/** Lo guardado, de vuelta a texto para que el jurado lo edite. */
export function otrosLinksATexto(json: unknown): string {
  if (!Array.isArray(json)) return "";
  return json
    .filter(
      (x): x is OtroLink =>
        !!x && typeof x === "object" && typeof (x as OtroLink).url === "string",
    )
    .map((l) => `${l.nombre} | ${l.url}`)
    .join("\n");
}
