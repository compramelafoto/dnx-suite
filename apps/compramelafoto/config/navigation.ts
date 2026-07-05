import type { ReactNode } from "react";

export type SidebarNavItem = {
  id: string;
  label: string;
  path?: string;
  href?: string;
  icon?: ReactNode;
  badge?: string;
  dividerBefore?: boolean;
  children?: {
    id: string;
    label: string;
    path?: string;
    href?: string;
    tab?: string;
    /** Query ?view=… (p. ej. recomendados en /dashboard/productos) */
    view?: string;
    /** Activo cuando view NO coincide (p. ej. Mis Packs y Combos sin ?view=recomendados) */
    excludeView?: string;
    badge?: string;
  }[];
};

/**
 * Menú lateral del panel Fotógrafo — PR11.1 (orden y agrupación).
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
  events?: ReactNode;
  analytics?: ReactNode;
  lab?: ReactNode;
  sales?: ReactNode;
}): SidebarNavItem[] {
  const ventasChildren: SidebarNavItem["children"] = [
    {
      id: "v-config-ventas",
      label: "Configuración de ventas",
      path: "/dashboard/sales-settings",
    },
    {
      id: "v-productos",
      label: "Mis Packs y Combos",
      path: "/dashboard/productos",
      excludeView: "recomendados",
    },
    {
      id: "v-recomendados",
      label: "Packs y Combos Recomendados",
      path: "/dashboard/productos",
      view: "recomendados",
    },
    {
      id: "v-adicionales",
      label: "Adicionales",
      path: "/fotografo/configuracion",
      tab: "upselling",
    },
    {
      id: "v-impresiones",
      label: "Mis Productos Impresos",
      path: "/fotografo/configuracion",
      tab: "productos",
    },
    {
      id: "v-mercadopago",
      label: "Mercado Pago",
      path: "/fotografo/configuracion",
      tab: "mercadopago",
    },
  ];

  return [
    { id: "inicio", label: "Inicio", path: "/fotografo/dashboard", icon: icons.home },
    { id: "pedidos", label: "Pedidos", path: "/fotografo/pedidos", icon: icons.orders },
    {
      id: "albumes",
      label: "Álbumes",
      path: "/dashboard/albums",
      icon: icons.albums,
      children: [
        { id: "albumes-todos", label: "Todos los álbumes", path: "/dashboard/albums" },
        { id: "albumes-nuevo", label: "Crear álbum", path: "/dashboard/albums/new" },
        {
          id: "albumes-eventos",
          label: "Eventos colaborativos",
          path: "/fotografo/eventos",
        },
        { id: "albumes-bajas", label: "Solicitudes de baja", path: "/fotografo/remociones" },
      ],
    },
    {
      id: "escolar",
      label: "Escolar",
      path: "/fotografo/escuelas",
      icon: icons.schools ?? icons.albums,
      badge: "BETA",
      children: [
        { id: "escolar-instituciones", label: "Instituciones", path: "/fotografo/escuelas" },
        { id: "escolar-pedidos", label: "Pedidos escolares", path: "/fotografo/escuelas/pedidos" },
        { id: "escolar-disenos", label: "Diseños escolares", path: "/dashboard/designs" },
        { id: "escolar-revisiones", label: "Revisiones", path: "/dashboard/design-projects" },
      ],
    },
    {
      id: "ventas",
      label: "Ventas",
      path: "/dashboard/sales-settings",
      icon: icons.sales ?? icons.orders,
      children: ventasChildren,
    },
    { id: "clientes", label: "Clientes", path: "/fotografo/clientes", icon: icons.clients },
    {
      id: "analytics",
      label: "Analytics",
      path: "/fotografo/analytics",
      icon: icons.analytics ?? icons.orders,
    },
    {
      id: "configuracion",
      label: "Configuración",
      path: "/fotografo/configuracion",
      icon: icons.settings,
      children: [
        { id: "c-datos", label: "Perfil", path: "/fotografo/configuracion", tab: "datos" },
        { id: "c-password", label: "Cuenta y seguridad", path: "/cuenta/cambiar-contrasena" },
        { id: "c-diseno", label: "Marca y diseño", path: "/fotografo/configuracion", tab: "diseno" },
        { id: "c-impresion", label: "Impresión", path: "/fotografo/laboratorio" },
        {
          id: "c-camera-connection",
          label: "Conexión de Cámara",
          path: "/dashboard/camera-connection",
        },
        { id: "c-referidos", label: "Referidos & Marketing", path: "/dashboard/referrals" },
      ],
    },
    {
      id: "comunidad",
      label: "Comunidad",
      path: "/fotografo/comunidad",
      icon: icons.community,
      children: [
        { id: "comunidad-foro", label: "Comunidad", path: "/fotografo/comunidad" },
        { id: "comunidad-testimonios", label: "Dejá tu testimonio", path: "/testimonios" },
      ],
    },
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
      ],
    },
  ];
}

export type LabSidebarNavItem = SidebarNavItem;

/**
 * Menú lateral del panel LAB.
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
  referrals?: ReactNode;
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
      id: "referidos-main",
      label: "Panel de Referidos",
      path: "/lab/referrals",
      icon: icons.referrals ?? icons.community,
    },
    {
      id: "configuracion",
      label: "Configuración",
      path: "/lab/configuracion/datos",
      icon: icons.settings,
      children: [
        { id: "c-datos", label: "Datos", path: "/lab/configuracion/datos" },
        { id: "c-password", label: "Cambiar contraseña", path: "/cuenta/cambiar-contrasena" },
        { id: "c-diseno", label: "Diseño", path: "/lab/configuracion/diseno" },
        { id: "c-mercadopago", label: "Mercado Pago", path: "/lab/configuracion/mercadopago" },
        { id: "c-descuentos", label: "Descuentos", path: "/lab/configuracion/descuentos" },
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
