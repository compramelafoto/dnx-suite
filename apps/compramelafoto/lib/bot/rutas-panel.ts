/**
 * Pantallas reales del panel del fotógrafo y del organizador a las que DNX Bot puede mandar.
 * Única fuente de verdad: de acá sale (1) la sección "Pantallas del panel" de la guía del bot y
 * (2) la lista de prefijos que el chat acepta para convertir una ruta en enlace.
 * `pagina` es el page.tsx real (lo verifica rutas-panel.test.ts contra el sistema de archivos).
 */
export type RutaPanel = {
  /** Ruta con la que se escribe el enlace; los tramos {x} son datos que cambian (ej. {id}). */
  ruta: string;
  /** Para qué sirve, en una línea. */
  proposito: string;
  /** Archivo page.tsx de la ruta estática (o de su parte estática). */
  pagina: string;
};

export const RUTAS_PANEL: readonly RutaPanel[] = [
  { ruta: "/fotografo/dashboard", proposito: "inicio del panel del fotógrafo", pagina: "app/fotografo/dashboard/page.tsx" },
  { ruta: "/dashboard/albums", proposito: "lista de álbumes (acá se ven y se editan; no existe /fotografo/albums)", pagina: "app/dashboard/albums/page.tsx" },
  { ruta: "/dashboard/albums/new", proposito: "crear un álbum nuevo", pagina: "app/dashboard/albums/new/page.tsx" },
  { ruta: "/dashboard/albums/{id}", proposito: "un álbum en particular: fotos, configuración, precios, publicación", pagina: "app/dashboard/albums/[id]/page.tsx" },
  { ruta: "/fotografo/pedidos", proposito: "pedidos de compradores y links de descarga", pagina: "app/fotografo/pedidos/page.tsx" },
  { ruta: "/fotografo/configuracion", proposito: "datos del fotógrafo y conexión con Mercado Pago", pagina: "app/fotografo/configuracion/page.tsx" },
  { ruta: "/fotografo/configuracion/notificaciones", proposito: "avisos por mail que recibe el fotógrafo", pagina: "app/fotografo/configuracion/notificaciones/page.tsx" },
  { ruta: "/dashboard/sales-settings", proposito: "ajustes de venta (precios y descuentos)", pagina: "app/dashboard/sales-settings/page.tsx" },
  { ruta: "/fotografo/escuelas", proposito: "escuelas (fotografía escolar)", pagina: "app/fotografo/escuelas/page.tsx" },
  { ruta: "/fotografo/escuelas/nueva", proposito: "cargar una escuela nueva", pagina: "app/fotografo/escuelas/nueva/page.tsx" },
  { ruta: "/fotografo/escuelas/pedidos", proposito: "pedidos escolares de las familias", pagina: "app/fotografo/escuelas/pedidos/page.tsx" },
  { ruta: "/fotografo/escuelas/{id}", proposito: "una escuela en particular: cursos y datos", pagina: "app/fotografo/escuelas/[id]/page.tsx" },
  { ruta: "/fotografo/disenos", proposito: "diseños guardados", pagina: "app/fotografo/disenos/page.tsx" },
  { ruta: "/dashboard/designs", proposito: "diseños de productos", pagina: "app/dashboard/designs/page.tsx" },
  { ruta: "/dashboard/productos", proposito: "productos impresos que vende el fotógrafo", pagina: "app/dashboard/productos/page.tsx" },
  { ruta: "/fotografo/remociones", proposito: "pedidos de remoción de fotos (los aprueba el fotógrafo)", pagina: "app/fotografo/remociones/page.tsx" },
  { ruta: "/fotografo/eventos", proposito: "eventos del fotógrafo", pagina: "app/fotografo/eventos/page.tsx" },
  { ruta: "/fotografo/clientes", proposito: "clientes del fotógrafo", pagina: "app/fotografo/clientes/page.tsx" },
  { ruta: "/fotografo/analytics", proposito: "estadísticas de visitas y ventas", pagina: "app/fotografo/analytics/page.tsx" },
  { ruta: "/fotografo/negocio", proposito: "datos del negocio", pagina: "app/fotografo/negocio/page.tsx" },
  { ruta: "/fotografo/laboratorio", proposito: "laboratorio de impresión", pagina: "app/fotografo/laboratorio/page.tsx" },
  { ruta: "/fotografo/notificaciones", proposito: "avisos del panel", pagina: "app/fotografo/notificaciones/page.tsx" },
  { ruta: "/fotografo/comunidad", proposito: "comunidad de fotógrafos", pagina: "app/fotografo/comunidad/page.tsx" },
  { ruta: "/dashboard/referrals", proposito: "referidos del fotógrafo", pagina: "app/dashboard/referrals/page.tsx" },
  { ruta: "/fotografo/soporte", proposito: "pedidos de soporte del fotógrafo", pagina: "app/fotografo/soporte/page.tsx" },
  { ruta: "/organizador/dashboard", proposito: "inicio del panel del organizador", pagina: "app/organizador/(panel)/dashboard/page.tsx" },
  { ruta: "/organizador/events/new", proposito: "crear un evento nuevo (organizador)", pagina: "app/organizador/(panel)/events/new/page.tsx" },
  { ruta: "/organizador/events/{id}", proposito: "un evento en particular (organizador)", pagina: "app/organizador/(panel)/events/[id]/page.tsx" },
  { ruta: "/organizador/comisiones", proposito: "comisiones del organizador", pagina: "app/organizador/(panel)/comisiones/page.tsx" },
  { ruta: "/organizador/soporte", proposito: "pedidos de soporte del organizador", pagina: "app/organizador/(panel)/soporte/page.tsx" },
];

/** Prefijos para el chat: la ruta sin los tramos {x}, sin duplicados. "/dashboard/albums" cubre /dashboard/albums/12. */
export const RUTAS_PERMITIDAS_BOT: string[] = [
  ...new Set(RUTAS_PANEL.map((r) => r.ruta.replace(/\/\{[^}]*\}.*$/, ""))),
];

/** Texto de la sección "## Pantallas del panel" de la guía. Determinístico (sin fechas ni datos de cuentas). */
export function seccionPantallasDelPanel(): string {
  return [
    "## Pantallas del panel",
    "Estas son las únicas pantallas a las que podés mandar. Los tramos entre llaves (como {id}) son el número del álbum, la escuela o el evento. Si lo que buscás no está en la lista, no inventes una ruta: describí dónde está en el menú.",
    ...RUTAS_PANEL.map((r) => `- ${r.ruta}: ${r.proposito}`),
  ].join("\n");
}
