/**
 * Navegación MVP — solo anclas a contenido existente en la Home.
 */

export type NavItem = {
  label: string;
  href: string;
};

export const mainNavigation: readonly NavItem[] = [
  { label: "Qué es", href: "#que-es" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Próximas", href: "#proximas" },
  { label: "Comunidad", href: "#comunidad" },
  { label: "Organizá una", href: "#organiza" },
  { label: "Sponsors", href: "#sponsors" },
] as const;

export const footerNavigation: readonly NavItem[] = [
  { label: "Qué es", href: "#que-es" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Próximas", href: "#proximas" },
  { label: "Aprender", href: "#aprender" },
  { label: "Comunidad", href: "#comunidad" },
  { label: "Organizá una", href: "#organiza" },
  { label: "Sponsors", href: "#sponsors" },
  { label: "Preguntas", href: "#faq" },
] as const;

export const headerCta: NavItem = {
  label: "Ver próximas maratones",
  href: "#proximas",
};

/** Áreas futuras — documentadas, sin enlaces rotos en la UI. */
export const futureAreas = [
  "tienda",
  "ranking",
  "galería",
  "blog",
  "perfiles",
  "inscripciones",
  "jurados",
  "paneles privados",
  "newsletter",
  "contacto funcional",
] as const;
