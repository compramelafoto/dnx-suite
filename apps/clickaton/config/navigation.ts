/**
 * Navegación MVP — solo anclas a contenido existente en la Home.
 * Rutas futuras (tienda, ranking, galería, etc.) no se exponen como enlaces.
 */

export type NavItem = {
  label: string;
  href: string;
};

export const mainNavigation: readonly NavItem[] = [
  { label: "Inicio", href: "#inicio" },
  { label: "Qué es", href: "#que-es" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Próximas maratones", href: "#proximas-maratones" },
  { label: "Comunidad", href: "#comunidad" },
] as const;

export const footerNavigation: readonly NavItem[] = [
  { label: "Inicio", href: "#inicio" },
  { label: "Qué es", href: "#que-es" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Próximas maratones", href: "#proximas-maratones" },
  { label: "Comunidad", href: "#comunidad" },
] as const;

/** Áreas futuras — documentadas, sin enlaces rotos en la UI. */
export const futureAreas = [
  "tienda",
  "ranking",
  "galería",
  "blog",
  "organizadores",
  "perfiles",
  "inscripciones",
  "jurados",
  "sponsors",
  "paneles privados",
] as const;
