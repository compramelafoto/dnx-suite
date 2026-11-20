import type { CSSProperties } from "react";

/**
 * Los elementos del recorrido de un cliente y su color, uno por elemento y el mismo en todo el
 * sistema. El color vive en `globals.css` (`--fo-ent-*`); acá se elige cuál. Módulo puro.
 *
 * Para pintar algo con el color de un elemento: `style={estiloDeEntidad("pedido")}` en el
 * contenedor y, adentro, las clases de `CLASE_ENTIDAD` (todas leen `--ent`). Así las clases son
 * siempre las mismas cadenas literales y Tailwind las encuentra.
 */
export const ENTIDADES = [
  "cliente",
  "consulta",
  "cotizacion",
  "pedido",
  "contrato",
  "proyecto",
  "galeria",
  "agenda",
  "cobrado",
  "porCobrar",
] as const;

export type Entidad = (typeof ENTIDADES)[number];

export const ENTIDAD: Record<Entidad, { singular: string; plural: string; variable: string }> = {
  cliente: { singular: "Cliente", plural: "Clientes", variable: "--fo-ent-cliente" },
  consulta: { singular: "Consulta", plural: "Consultas", variable: "--fo-ent-consulta" },
  cotizacion: { singular: "Cotización", plural: "Cotizaciones", variable: "--fo-ent-cotizacion" },
  pedido: { singular: "Pedido", plural: "Pedidos", variable: "--fo-ent-pedido" },
  contrato: { singular: "Contrato", plural: "Contratos", variable: "--fo-ent-contrato" },
  proyecto: { singular: "Proyecto", plural: "Proyectos", variable: "--fo-ent-proyecto" },
  galeria: { singular: "Galería", plural: "Galerías", variable: "--fo-ent-galeria" },
  agenda: { singular: "Agenda", plural: "Agenda", variable: "--fo-ent-agenda" },
  cobrado: { singular: "Cobrado", plural: "Cobrado", variable: "--fo-ent-cobrado" },
  porCobrar: { singular: "Por cobrar", plural: "Por cobrar", variable: "--fo-ent-por-cobrar" },
};

/** Fija `--ent` al color del elemento, para las clases de `CLASE_ENTIDAD`. */
export function estiloDeEntidad(e: Entidad): CSSProperties {
  return { "--ent": `var(${ENTIDAD[e].variable})` } as CSSProperties;
}

/** Clases que leen `--ent` (siempre junto con `estiloDeEntidad`). */
export const CLASE_ENTIDAD = {
  fondo: "bg-[var(--ent)]",
  texto: "text-[var(--ent)]",
  borde: "border-[var(--ent)]",
  bordeArriba: "border-t-4 border-t-[var(--ent)]",
  tinte: "bg-[color-mix(in_srgb,var(--ent)_10%,transparent)]",
} as const;

/** La pantalla principal de cada elemento (para pintar el menú y los buscadores). */
const RUTA: [string, Entidad][] = [
  ["/clientes", "cliente"],
  ["/consultas", "consulta"],
  ["/presupuestos", "cotizacion"],
  ["/pedidos", "pedido"],
  ["/contratos", "contrato"],
  ["/proyectos", "proyecto"],
  ["/galerias", "galeria"],
  ["/agenda", "agenda"],
];

/** Puro: el elemento al que lleva una ruta del panel, o null si no es de ninguno. */
export function entidadDeRuta(href: string): Entidad | null {
  const ruta = href.split(/[?#]/)[0] ?? "";
  for (const [base, e] of RUTA) if (ruta === base || ruta.startsWith(`${base}/`)) return e;
  return null;
}
