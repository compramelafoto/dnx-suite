/**
 * Páginas públicas de CompraMeLaFoto a las que DNX Bot para compradores puede mandar.
 * Única fuente de verdad para la guía y para los prefijos que la burbuja convierte en enlace.
 * `pagina` es el page.tsx real (lo verifica rutas.test.ts). Puro: lo usa también el navegador.
 */
export type RutaComprador = { ruta: string; proposito: string; pagina: string };

export const RUTAS_COMPRADOR: readonly RutaComprador[] = [
  { ruta: "/album/{slug}", proposito: "la página de un álbum", pagina: "app/album/[slug]/page.tsx" },
  { ruta: "/a/{id}", proposito: "la página de un álbum por número", pagina: "app/a/[id]/page.tsx" },
  { ruta: "/pago/reintentar/{pedido}", proposito: "reintentar el pago de un pedido pendiente o rechazado", pagina: "app/pago/reintentar/[orderId]/page.tsx" },
  { ruta: "/cliente/pedidos", proposito: "mis pedidos (con cuenta)", pagina: "app/cliente/pedidos/page.tsx" },
  { ruta: "/cliente/recuperar-pack", proposito: "recuperar el enlace del pack de preventa", pagina: "app/cliente/recuperar-pack/page.tsx" },
  { ruta: "/privacidad/solicitud", proposito: "pedidos sobre datos personales", pagina: "app/privacidad/solicitud/page.tsx" },
  { ruta: "/delete-biometric", proposito: "borrar los datos de la selfie", pagina: "app/delete-biometric/page.tsx" },
  { ruta: "/login", proposito: "entrar a la cuenta", pagina: "app/login/page.tsx" },
  { ruta: "/ayuda/mercadopago/seguridad", proposito: "seguridad de los pagos con Mercado Pago", pagina: "app/ayuda/mercadopago/seguridad/page.tsx" },
];

/** Prefijos para el chat: la ruta sin los tramos {x}, sin duplicados ("/a" cubre /a/12). */
export const RUTAS_PERMITIDAS_COMPRADOR: string[] = [
  ...new Set(RUTAS_COMPRADOR.map((r) => r.ruta.replace(/\/\{[^}]*\}.*$/, ""))),
];

/** Sección "## Páginas" de la guía del comprador. Determinística. */
export function seccionPaginasDelComprador(): string {
  return [
    "## Páginas a las que podés mandar",
    "Estas son las únicas páginas a las que podés mandar. Los tramos entre llaves son datos: {slug} es el nombre del álbum en la dirección, {id} su número y {pedido} el número de pedido. Si lo que buscás no está en la lista, no inventes una ruta.",
    ...RUTAS_COMPRADOR.map((r) => `- ${r.ruta}: ${r.proposito}`),
  ].join("\n");
}

const SLUG_ENLAZABLE = /^[a-z0-9_-]+$/;

/** La burbuja sólo convierte en enlace rutas en minúsculas y sin `?`: si el slug no sirve, va por número. */
export function enlaceAlbum(a: { id: number; publicSlug: string | null }): string {
  return a.publicSlug && SLUG_ENLAZABLE.test(a.publicSlug) ? `/album/${a.publicSlug}` : `/a/${a.id}`;
}

export function enlaceReintento(orderId: number): string {
  return `/pago/reintentar/${orderId}`;
}
