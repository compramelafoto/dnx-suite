import type { ReactNode } from "react";

export type SidebarNavItem = {
  id: string;
  label: string;
  path?: string;
  href?: string;
  icon?: ReactNode;
  badge?: string;
  children?: { id: string; label: string; path?: string; href?: string; tab?: string; badge?: string }[];
};

/**
 * Menú lateral del panel Fotógrafo.
 * Fuente única de verdad: Inicio y Pedidos son ítems únicos (sin submenú).
 * Álbumes y Configuración son los únicos grupos colapsables.
 */
export function getPhotographerSidebarItems(icons: {
  home: ReactNode;
  albums: ReactNode;
  orders: ReactNode;
  clients: ReactNode;
  settings: ReactNode;
  removal: ReactNode;
  support: ReactNode;
  community: ReactNode;
  design?: ReactNode;
  schools?: ReactNode;
}): SidebarNavItem[] {
  return [
    { id: "inicio", label: "Inicio", path: "/fotografo/dashboard", icon: icons.home },
    { id: "pedidos", label: "Pedidos", path: "/fotografo/pedidos", icon: icons.orders },
    {
      id: "escuelas",
      label: "Escuelas",
      path: "/fotografo/escuelas",
      icon: icons.schools ?? icons.albums,
      badge: "BETA",
      children: [
        { id: "escuelas-ver", label: "Ver escuelas", path: "/fotografo/escuelas" },
        { id: "escuelas-pedidos", label: "Pedidos escolares", path: "/fotografo/escuelas/pedidos" },
      ],
    },
    {
      id: "albumes",
      label: "Álbumes",
      path: "/dashboard/albums",
      icon: icons.albums,
      children: [
        { id: "ver", label: "Ver álbumes", path: "/dashboard/albums" },
        { id: "solicitudes-baja", label: "Solicitudes de baja", path: "/fotografo/remociones" },
      ],
    },
    {
      id: "disenos",
      label: "Diseños",
      path: "/fotografo/diseno/plantillas",
      icon: icons.design,
      children: [
        { id: "plantillas", label: "Plantillas", path: "/fotografo/diseno/plantillas" },
      ],
    },
    { id: "clientes", label: "Clientes", path: "/fotografo/clientes", icon: icons.clients },
    {
      id: "configuracion",
      label: "Configuración",
      path: "/fotografo/configuracion",
      icon: icons.settings,
      children: [
        { id: "c-datos", label: "Datos personales", path: "/fotografo/configuracion", tab: "datos" },
        { id: "c-password", label: "Cambiar contraseña", path: "/cuenta/cambiar-contraseña" },
        { id: "c-diseno", label: "Diseño", path: "/fotografo/configuracion", tab: "diseno" },
        { id: "c-laboratorio", label: "Laboratorio y márgenes", path: "/fotografo/configuracion", tab: "laboratorio" },
        { id: "c-mercadopago", label: "Mercado Pago", path: "/fotografo/configuracion", tab: "mercadopago" },
        { id: "c-productos", label: "Productos", path: "/fotografo/configuracion", tab: "productos" },
        { id: "c-upselling", label: "Upselling", path: "/fotografo/configuracion", tab: "upselling", badge: "new" },
        { id: "c-referidos", label: "Referidos", path: "/fotografo/configuracion", tab: "referidos" },
      ],
    },
    { id: "comunidad", label: "Comunidad", path: "/fotografo/comunidad", icon: icons.community },
    {
      id: "soporte",
      label: "Soporte",
      path: "/fotografo/soporte",
      icon: icons.support,
      children: [
        { id: "s-incidencias", label: "Incidencias", path: "/fotografo/soporte", tab: "incidencias" },
        { id: "s-politicas", label: "Políticas", path: "/fotografo/soporte", tab: "politicas" },
        { id: "s-tutoriales", label: "Tutoriales", path: "/fotografo/soporte", tab: "tutoriales" },
        { id: "s-faqs", label: "FAQs", path: "/fotografo/soporte", tab: "faqs" },
        { id: "s-testimonios", label: "Dejá tu testimonio", path: "/testimonios" },
      ],
    },
  ];
}

export type LabSidebarNavItem = SidebarNavItem;

/**
 * Menú lateral del panel LAB.
 * Estructura alineada con Fotógrafo: Inicio, Pedidos, Clientes, Productos, Configuración, Comunidad, Soporte.
 * Sin "Mi negocio", "Precios" ni "Catálogo" como ítems de primer nivel.
 * Descuentos, Referidos y Upselling van dentro de Configuración.
 */
export function getLabSidebarItems(icons: {
  home: ReactNode;
  orders: ReactNode;
  albums: ReactNode;
  clients: ReactNode;
  products: ReactNode;
  settings: ReactNode;
  community: ReactNode;
  support: ReactNode;
}): LabSidebarNavItem[] {
  return [
    { id: "inicio", label: "Inicio", path: "/lab/dashboard", icon: icons.home },
    { id: "pedidos", label: "Pedidos", path: "/lab/pedidos", icon: icons.orders },
    {
      id: "albumes",
      label: "Álbumes",
      path: "/lab/albumes",
      icon: icons.albums,
      children: [
        { id: "albumes-ver", label: "Ver álbumes", path: "/lab/albumes", tab: "albums" },
        { id: "albumes-interesados", label: "Interesados", path: "/lab/albumes", tab: "interesados" },
      ],
    },
    { id: "clientes", label: "Clientes", path: "/lab/clientes", icon: icons.clients },
    { id: "productos", label: "Productos", path: "/lab/productos", icon: icons.products },
    {
      id: "configuracion",
      label: "Configuración",
      path: "/lab/configuracion/datos",
      icon: icons.settings,
      children: [
        { id: "c-datos", label: "Datos", path: "/lab/configuracion/datos" },
        { id: "c-password", label: "Cambiar contraseña", path: "/cuenta/cambiar-contraseña" },
        { id: "c-diseno", label: "Diseño", path: "/lab/configuracion/diseno" },
        { id: "c-mercadopago", label: "Mercado Pago", path: "/lab/configuracion/mercadopago" },
        { id: "c-descuentos", label: "Descuentos", path: "/lab/configuracion/descuentos" },
        { id: "c-referidos", label: "Referidos", path: "/lab/configuracion/referidos" },
        { id: "c-upselling", label: "Upselling", path: "/lab/configuracion/upselling" },
      ],
    },
    { id: "comunidad", label: "Comunidad", path: "/lab/comunidad", icon: icons.community },
    {
      id: "soporte",
      label: "Soporte",
      path: "/lab/soporte",
      icon: icons.support,
      children: [
        { id: "s-incidencias", label: "Incidencias", path: "/lab/soporte", tab: "incidencias" },
        { id: "s-politicas", label: "Políticas", path: "/lab/soporte", tab: "politicas" },
        { id: "s-tutoriales", label: "Tutoriales", path: "/lab/soporte", tab: "tutoriales" },
        { id: "s-faqs", label: "FAQs", path: "/lab/soporte", tab: "faqs" },
      ],
    },
  ];
}
