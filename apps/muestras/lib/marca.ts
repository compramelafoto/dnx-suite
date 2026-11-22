/**
 * Marca de cada dominio. La app sirve dos sitios con el mismo código:
 * muestrasfotograficas.com (fotografía) y muestrasdearte.com (arte). Acá viven los nombres,
 * textos y dominios de cada uno; no depende de React ni de la base.
 */

export type MarcaId = "FOTOGRAFIA" | "ARTE";
export type SegmentoMarca = "fotografia" | "arte";

export type Marca = {
  id: MarcaId;
  segmento: SegmentoMarca;
  dominio: string;
  origen: string;
  nombre: string;
  descripcion: string;
  palabraAutor: { singular: string; plural: string; titulo: string };
  rutaAutores: "/fotografos" | "/artistas";
  logo: string;
  imagenRedes: string;
  descriptorTarjeta: string;
};

// Arte usa el mismo logo que fotografía hasta que esté /brand/arte-logo-1254.webp.
const LOGO = "/brand/muestras-logo-1254.webp";

export const MARCAS: Record<MarcaId, Marca> = {
  FOTOGRAFIA: {
    id: "FOTOGRAFIA",
    segmento: "fotografia",
    dominio: "muestrasfotograficas.com",
    origen: "https://muestrasfotograficas.com",
    nombre: "Muestras Fotográficas",
    descripcion: "Muestras de fotografía para ver en persona, en todo el país: dónde quedan, fechas, horarios y cómo llegar.",
    palabraAutor: { singular: "fotógrafo", plural: "fotógrafos", titulo: "Fotógrafos que expusieron" },
    rutaAutores: "/fotografos",
    logo: LOGO,
    imagenRedes: LOGO,
    descriptorTarjeta: "MUESTRAS FOTO",
  },
  ARTE: {
    id: "ARTE",
    segmento: "arte",
    dominio: "muestrasdearte.com",
    origen: "https://muestrasdearte.com",
    nombre: "Muestras de Arte",
    descripcion: "Muestras de arte para ver en persona: pintura, escultura, grabado, fotografía y más. Dónde quedan, fechas, horarios y cómo llegar.",
    palabraAutor: { singular: "artista", plural: "artistas", titulo: "Artistas que expusieron" },
    rutaAutores: "/artistas",
    logo: LOGO,
    imagenRedes: LOGO,
    descriptorTarjeta: "MUESTRAS ARTE",
  },
};

const HOSTS_DE_ARTE = new Set(["muestrasdearte.com", "www.muestrasdearte.com", "muestrasdearte.localhost"]);

function sinPuerto(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

export function esHostDeArte(host: string): boolean {
  return HOSTS_DE_ARTE.has(sinPuerto(host));
}

export function marcaPorHost(host: string | null | undefined): Marca {
  return host && esHostDeArte(host) ? MARCAS.ARTE : MARCAS.FOTOGRAFIA;
}

export function marcaPorSegmento(segmento: string): Marca | null {
  return Object.values(MARCAS).find((m) => m.segmento === segmento) ?? null;
}

export function marcaDeDisciplina(primaryDiscipline: string | null | undefined): Marca {
  return !primaryDiscipline || primaryDiscipline === "FOTOGRAFIA" ? MARCAS.FOTOGRAFIA : MARCAS.ARTE;
}

/**
 * Origen público (https://dominio) de la marca. En producción de Vercel es el dominio de la marca;
 * en cualquier otro caso (desarrollo, `next start` local) se usa APP_URL, y arte cambia
 * `localhost` por `muestrasdearte.localhost` conservando el puerto.
 */
export function origenPublico(marca: Marca, env: Record<string, string | undefined> = process.env): string {
  if (env.VERCEL_ENV === "production") return marca.origen;
  const base = env.APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3014";
  const url = new URL(base);
  if (marca.id === "ARTE" && url.hostname === "localhost") url.hostname = "muestrasdearte.localhost";
  return url.origin;
}
