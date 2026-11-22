import { permanentRedirect } from "next/navigation";
import { MARCAS, esHostDeArte, marcaDeDisciplina, marcaPorSegmento, origenPublico, type MarcaId } from "./marca";

type Env = Record<string, string | undefined>;

export type Casa = { tipo: "mostrar"; canonical: string } | { tipo: "redirigir"; destino: string };

/**
 * Dónde vive una muestra según su disciplina principal. La fotografía se ve en los dos dominios
 * (su canonical es el de fotografía); el resto vive sólo en el de arte: pedida en fotografía, se
 * redirige. Devuelve orígenes (sin ruta): la página les suma la suya.
 */
export function decidirCasa(marcaPedida: MarcaId, primaryDiscipline: string, env: Env = process.env): Casa {
  const casa = marcaDeDisciplina(primaryDiscipline);
  const origen = origenPublico(casa, env);
  // Sólo se redirige a un host que el proxy reescribe a arte: con otro (una preview de Vercel,
  // 127.0.0.1) se volvería a caer en fotografía y se redirigiría sin fin.
  if (casa.id === "ARTE" && marcaPedida === "FOTOGRAFIA" && esHostDeArte(new URL(origen).host)) return { tipo: "redirigir", destino: origen };
  return { tipo: "mostrar", canonical: origen };
}

/** La dirección canónica de una página de la muestra: el dominio de su casa más la ruta. */
export function canonicalDe(primaryDiscipline: string, ruta: string, env: Env = process.env): string {
  return `${origenPublico(marcaDeDisciplina(primaryDiscipline), env)}${ruta}`;
}

/**
 * En las páginas de `app/[marca]/m/[slug]/**`, después de encontrar la muestra: si se pidió en el
 * dominio que no es su casa, 308 a la misma ruta (y búsqueda) en su casa. El segmento lo valida el
 * layout; si faltara, se toma fotografía.
 */
export function asegurarCasa(segmento: string | undefined, primaryDiscipline: string, ruta: string, busqueda = "", env: Env = process.env): void {
  const pedida = (segmento && marcaPorSegmento(segmento)) || MARCAS.FOTOGRAFIA;
  const casa = decidirCasa(pedida.id, primaryDiscipline, env);
  if (casa.tipo === "redirigir") permanentRedirect(`${casa.destino}${ruta}${busqueda}`);
}

/** `?a=1&b=2` a partir de los `searchParams` de una página (vacío si no hay ninguno). */
export function textoDeBusqueda(sp: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v == null ? [] : [v]) q.append(k, x);
  const s = q.toString();
  return s ? `?${s}` : "";
}
