import { PHOTOGRAPHY } from "@repo/muestras";
import { MARCAS, esHostDeArte, origenPublico, type Marca, type MarcaId } from "@/lib/marca";

type Env = Record<string, string | undefined>;

export type CasaDePerfil = { tipo: "mostrar"; canonical: string } | { tipo: "redirigir"; destino: string };

/** Casa de un perfil (spec 6.1): fotografía si todas sus disciplinas son fotografía (o no tiene); si no, arte. */
export function casaDePerfil(disciplines: readonly string[] | null | undefined): MarcaId {
  return (disciplines ?? []).every((d) => d === PHOTOGRAPHY) ? "FOTOGRAFIA" : "ARTE";
}

/** `/fotografos/<slug>` o `/artistas/<slug>`, según la marca. */
export function rutaDePerfil(marca: Marca, slug: string): string {
  return `${marca.rutaAutores}/${slug}`;
}

/**
 * Qué hacer con un perfil pedido en una marca. Un perfil de arte pedido en fotografía se redirige a
 * `/artistas/<slug>` en el dominio de arte, pero sólo si ese origen es un host de arte: con otro (una
 * preview, 127.0.0.1) se volvería a caer en fotografía y se redirigiría sin fin. Un perfil de
 * fotografía se ve también en arte (lo lista `/artistas`), con canonical a fotografía: mismo
 * criterio que las muestras.
 */
export function decidirCasaDePerfil(pedida: MarcaId, disciplines: readonly string[] | null | undefined, slug: string, env: Env = process.env): CasaDePerfil {
  const casa = MARCAS[casaDePerfil(disciplines)];
  const origen = origenPublico(casa, env);
  const url = `${origen}${rutaDePerfil(casa, slug)}`;
  if (casa.id === "ARTE" && pedida === "FOTOGRAFIA" && esHostDeArte(new URL(origen).host)) return { tipo: "redirigir", destino: url };
  return { tipo: "mostrar", canonical: url };
}
