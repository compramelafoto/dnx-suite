/**
 * Abrir una consulta, cotización, pedido, contrato o proyecto DENTRO de la ficha del cliente, sin
 * cambiar de pantalla. Módulo PURO.
 *
 * La ficha lee `?ver=<tipo>:<id>` y muestra debajo la pantalla de ese elemento en modo
 * «incrustada» (`?vista=ficha` para la página: sin «Volver a…», con «Cerrar» y «Abrir completa»).
 */
export const TIPOS_DETALLE = ["consulta", "cotizacion", "pedido", "contrato", "proyecto"] as const;
export type TipoDetalle = (typeof TIPOS_DETALLE)[number];

/** El valor de `searchParams.vista` con el que una página se dibuja adentro de la ficha. */
export const VISTA_FICHA = "ficha";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

export type DetallePedido = { tipo: TipoDetalle; id: string };

/** El ancla de la ficha donde aparece el detalle. */
export const ANCLA_DETALLE = "detalle";

/** Enlace para ver un elemento adentro de la ficha del cliente. */
export function hrefVerEnFicha(clientId: string, tipo: TipoDetalle, id: string): string {
  return `/clientes/${encodeURIComponent(clientId)}?ver=${tipo}:${encodeURIComponent(id)}#${ANCLA_DETALLE}`;
}

/** Lee `?ver=` de la ficha; `null` si falta o no tiene forma válida (nunca se toca la base con basura). */
export function leerDetallePedido(valor: string | string[] | undefined): DetallePedido | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (!v) return null;
  const i = v.indexOf(":");
  if (i <= 0) return null;
  const tipo = v.slice(0, i) as TipoDetalle;
  const id = v.slice(i + 1);
  if (!TIPOS_DETALLE.includes(tipo) || !ID_VALIDO.test(id)) return null;
  return { tipo, id };
}

/** La ruta de la pantalla completa de cada elemento. */
export function hrefCompleto(tipo: TipoDetalle, id: string): string {
  const base = { consulta: "/consultas", cotizacion: "/presupuestos", pedido: "/pedidos", contrato: "/contratos", proyecto: "/proyectos" }[tipo];
  return `${base}/${encodeURIComponent(id)}`;
}

/** ¿La página se está dibujando adentro de la ficha? */
export function esVistaFicha(sp: { vista?: string | string[] } | undefined): boolean {
  const v = sp?.vista;
  return (Array.isArray(v) ? v[0] : v) === VISTA_FICHA;
}

/** El panel de los cuadros del resumen que corresponde a cada tipo (para dejarlo abierto). */
export const PANEL_DE_DETALLE: Record<TipoDetalle, "consultas" | "cotizaciones" | "pedidos" | "contratos" | "proyectos"> = {
  consulta: "consultas",
  cotizacion: "cotizaciones",
  pedido: "pedidos",
  contrato: "contratos",
  proyecto: "proyectos",
};
