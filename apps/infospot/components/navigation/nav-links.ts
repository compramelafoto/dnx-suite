import type { NavLink } from "@/components/navigation/MobileNavigation";

/**
 * Navegación principal de medio — solo rutas existentes.
 */
export const primaryNavLinks: NavLink[] = [
  { href: "/noticias", label: "Noticias" },
  { href: "/eventos", label: "Eventos" },
  { href: "/colaboradores", label: "Colaboradores" },
  { href: "/categorias/deportes", label: "Deportes" },
  { href: "/categorias/cultura", label: "Cultura" },
  { href: "/contacto", label: "Contacto" },
];

/** Agrupación editorial para el menú mobile. */
export const mobileNavGroups = [
  {
    id: "explore",
    title: "Explorar",
    items: ["Noticias", "Eventos", "Deportes", "Cultura"] as const,
  },
  {
    id: "community",
    title: "Comunidad",
    items: ["Colaboradores", "Contacto"] as const,
  },
] as const;
