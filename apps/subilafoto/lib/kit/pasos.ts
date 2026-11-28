/**
 * Los tres pasos para empezar a vender.
 *
 * Antes el panel decía "Todavía no podés vender" y ofrecía dos botones sueltos: el
 * fotógrafo tenía que adivinar el orden y no sabía cuánto le faltaba. Ahora es una lista
 * con avance, y el primer paso pendiente es el único botón destacado.
 *
 * Función pura: la usa el panel y la fija una prueba.
 */

export type EstadoDelPerfil = {
  basePriceCents: number;
  mpConnected: boolean;
  isPublished: boolean;
};

export type Paso = {
  clave: "ficha" | "mercado-pago" | "publicar";
  titulo: string;
  detalle: string;
  hecho: boolean;
  /** A dónde lleva el botón del paso. */
  href: string;
  boton: string;
};

export function pasosDelAlta(perfil: EstadoDelPerfil): Paso[] {
  return [
    {
      clave: "ficha",
      titulo: "Armá tu ficha",
      detalle: "Tu nombre, tu logo y tu precio por evento. Es lo que ve tu cliente.",
      hecho: perfil.basePriceCents > 0,
      href: "/panel/perfil",
      boton: "Armar mi ficha",
    },
    {
      clave: "mercado-pago",
      titulo: "Conectá Mercado Pago",
      detalle: "La venta entra directo en tu cuenta. Nosotros sólo retenemos la comisión.",
      hecho: perfil.mpConnected,
      href: "/api/pagos/conectar",
      boton: "Conectar Mercado Pago",
    },
    {
      clave: "publicar",
      titulo: "Publicá tu enlace",
      detalle: "Desde ese momento tus clientes pueden contratarte solos.",
      hecho: perfil.isPublished && perfil.basePriceCents > 0,
      href: "/panel/perfil#publicar",
      boton: "Publicar mi enlace",
    },
  ];
}

/** El primer paso que falta, o `null` si ya está todo. */
export function pasoSiguiente(pasos: Paso[]): Paso | null {
  return pasos.find((p) => !p.hecho) ?? null;
}

/** Puede vender de verdad: ficha publicada con precio **y** Mercado Pago conectado. */
export function listoParaCobrar(perfil: EstadoDelPerfil): boolean {
  return pasosDelAlta(perfil).every((p) => p.hecho);
}
