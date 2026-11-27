/**
 * Fotos del sitio (Pexels, licencia libre), ya optimizadas en `public/fotos/`. Cada una tiene una
 * versión de 1600 px de ancho y otra de 720 px (`-720`) para los lugares chicos.
 */

export type NombreFoto =
  | "portada-montana"
  | "fotografa"
  | "calle"
  | "boda"
  | "entrega"
  | "feria"
  | "estudio"
  | "mesa-clara"
  | "laptop"
  | "estuche"
  | "lentes"
  | "recital";

export const FOTOS: Record<NombreFoto, { alt: string }> = {
  "portada-montana": {
    alt: "Un fotógrafo de espaldas, con la cámara en la mano, mira unas montañas y un lago a pleno día.",
  },
  fotografa: { alt: "Una fotógrafa con tatuajes, de espaldas, sostiene su cámara." },
  calle: { alt: "Un fotógrafo de calle encuadra junto a un colectivo azul." },
  boda: { alt: "La pantalla de una cámara encuadra a una pareja de novios con luz cálida." },
  entrega: { alt: "Una mano le pasa una cámara Nikon a otra, con un campo dorado de fondo." },
  feria: { alt: "Cámaras antiguas a la venta en un puesto de una feria de Buenos Aires." },
  estudio: { alt: "Un fotógrafo trabaja en un estudio con cajas de luz." },
  "mesa-clara": { alt: "Una cámara y varios lentes ordenados sobre una mesa blanca, vistos desde arriba." },
  laptop: { alt: "Una fotógrafa revisa su trabajo en una computadora portátil, en un escritorio luminoso." },
  estuche: { alt: "Unas manos abren un estuche con equipo fotográfico." },
  lentes: { alt: "Una cámara y varios lentes sobre una mesa oscura." },
  recital: { alt: "Un fotógrafo saca fotos en un recital en Mar del Plata." },
};

/** Ruta pública de la foto; `chica` elige la versión de 720 px. */
export function srcFoto(nombre: NombreFoto, chica = false): string {
  return `/fotos/${nombre}${chica ? "-720" : ""}.webp`;
}

/** «Rosario, Santa Fe»; si falta la ciudad, sólo la provincia. */
export function zona(city: string | null | undefined, province: string): string {
  const c = city?.trim();
  return c ? `${c}, ${province}` : province;
}
