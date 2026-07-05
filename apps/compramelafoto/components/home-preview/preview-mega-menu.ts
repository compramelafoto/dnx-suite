export type MegaMenuIcon =
  | "search"
  | "calendar"
  | "sport"
  | "school"
  | "party"
  | "camera"
  | "users"
  | "folder"
  | "gift"
  | "print"
  | "building"
  | "ticket"
  | "percent"
  | "qr"
  | "shield"
  | "sparkles"
  | "handshake"
  | "map";

export type MegaMenuItem = {
  label: string;
  description: string;
  href: string;
  icon: MegaMenuIcon;
};

export type MegaMenuCategory = {
  id: string;
  label: string;
  items: MegaMenuItem[];
};

export const PREVIEW_MEGA_MENUS: MegaMenuCategory[] = [
  {
    id: "eventos",
    label: "Eventos",
    items: [
      {
        label: "Próximos eventos",
        description: "Descubrí eventos publicados en la plataforma.",
        href: "#proximos-eventos",
        icon: "calendar",
      },
      {
        label: "Eventos deportivos",
        description: "Carreras, torneos, clubes y competencias.",
        href: "#proximos-eventos",
        icon: "sport",
      },
      {
        label: "Eventos escolares",
        description: "Actos, egresos, muestras y fotografía institucional.",
        href: "#albumes-disponibles",
        icon: "school",
      },
      {
        label: "Eventos sociales",
        description: "XV, bodas, fiestas y celebraciones.",
        href: "#proximos-eventos",
        icon: "party",
      },
      {
        label: "Eventos que buscan fotógrafos",
        description: "Sumate a coberturas abiertas o colaborativas.",
        href: "#eventos-fotografos",
        icon: "camera",
      },
    ],
  },
  {
    id: "fotografos",
    label: "Fotógrafos",
    items: [
      {
        label: "Vender fotografías",
        description: "Publicá galerías y cobrá online.",
        href: "/fotografo/registro",
        icon: "folder",
      },
      {
        label: "Eventos colaborativos",
        description: "Participá en coberturas junto a otros fotógrafos.",
        href: "#eventos-fotografos",
        icon: "users",
      },
      {
        label: "Comunidad",
        description: "Conectate con colegas y oportunidades.",
        href: "/fotografo/comunidad",
        icon: "sparkles",
      },
      {
        label: "Directorio",
        description: "Aparecé en las búsquedas de profesionales.",
        href: "/directorio/fotografos",
        icon: "map",
      },
      {
        label: "Referidos",
        description: "Generá ingresos recomendando la plataforma.",
        href: "/fotografo/configuracion",
        icon: "gift",
      },
      {
        label: "Laboratorios",
        description: "Conectá con servicios de impresión y producción.",
        href: "/directorio/laboratorios",
        icon: "print",
      },
    ],
  },
  {
    id: "organizadores",
    label: "Organizadores",
    items: [
      {
        label: "Crear evento",
        description: "Publicá tu evento y centralizá la galería.",
        href: "/organizador/events/new",
        icon: "calendar",
      },
      {
        label: "Convocar fotógrafos",
        description: "Invitá profesionales cercanos o de tu comunidad.",
        href: "#eventos-fotografos",
        icon: "camera",
      },
      {
        label: "Inscripciones",
        description: "Gestioná participantes desde la plataforma.",
        href: "/organizador/events/new",
        icon: "ticket",
      },
      {
        label: "Venta de entradas",
        description: "Vendé accesos o inscripciones con pago online.",
        href: "/organizador/events/new",
        icon: "ticket",
      },
      {
        label: "Comisiones",
        description: "Generá ingresos por cada venta de fotos.",
        href: "/registro/organizador",
        icon: "percent",
      },
      {
        label: "Links y QR",
        description: "Compartí la galería fácilmente.",
        href: "/registro/organizador",
        icon: "qr",
      },
    ],
  },
  {
    id: "escuelas",
    label: "Escuelas",
    items: [
      {
        label: "Fotografía escolar",
        description: "Organizá la venta de fotos de tu institución.",
        href: "/escuelas",
        icon: "school",
      },
      {
        label: "Preventa escolar",
        description: "Ofrecé packs antes del día de fotos.",
        href: "/escuelas",
        icon: "gift",
      },
      {
        label: "Álbumes privados",
        description: "Protegé el acceso a las imágenes.",
        href: "/escuelas",
        icon: "shield",
      },
      {
        label: "Búsqueda inteligente",
        description: "Ayudá a cada familia a encontrar sus fotos.",
        href: "#albumes-disponibles",
        icon: "search",
      },
      {
        label: "Comisiones institucionales",
        description: "La escuela puede recibir ingresos por ventas.",
        href: "/escuelas",
        icon: "percent",
      },
      {
        label: "Seguridad de imágenes",
        description: "Privacidad y control de acceso.",
        href: "/escuelas",
        icon: "shield",
      },
    ],
  },
  {
    id: "laboratorios",
    label: "Laboratorios",
    items: [
      {
        label: "Registro de laboratorio",
        description: "Sumá tus servicios al ecosistema.",
        href: "/lab/registro",
        icon: "building",
      },
      {
        label: "Pedidos de impresión",
        description: "Recibí solicitudes de producción fotográfica.",
        href: "/lab/registro",
        icon: "print",
      },
      {
        label: "Directorio de laboratorios",
        description: "Aparecé como proveedor disponible.",
        href: "/directorio/laboratorios",
        icon: "map",
      },
      {
        label: "Alianzas",
        description: "Conectá con fotógrafos y organizadores.",
        href: "/lab/registro",
        icon: "handshake",
      },
    ],
  },
  {
    id: "comunidad",
    label: "Comunidad",
    items: [
      {
        label: "Fotógrafos",
        description: "Profesionales que venden y cubren eventos.",
        href: "/directorio/fotografos",
        icon: "camera",
      },
      {
        label: "Organizadores",
        description: "Clubes, productoras, escuelas y entidades.",
        href: "/directorio/organizadores",
        icon: "users",
      },
      {
        label: "Laboratorios",
        description: "Proveedores de impresión y producción.",
        href: "/directorio/laboratorios",
        icon: "print",
      },
      {
        label: "Empresas afines",
        description: "Marcas y servicios vinculados al sector.",
        href: "/directorio/servicios-de-eventos",
        icon: "sparkles",
      },
      {
        label: "Beneficios",
        description: "Oportunidades, alianzas y recursos.",
        href: "/fotografo/comunidad",
        icon: "gift",
      },
      {
        label: "Blog",
        description: "Guías, casos de éxito y novedades de ComprameLaFoto.",
        href: "/blog",
        icon: "sparkles",
      },
    ],
  },
];

/** Accesos rápidos bajo el hero (comprador) */
export const BUYER_QUICK_ACCESS = [
  { label: "Deportes", href: "#proximos-eventos", icon: "sport" as MegaMenuIcon },
  { label: "Escuelas", href: "#albumes-disponibles", icon: "school" as MegaMenuIcon },
  { label: "Eventos sociales", href: "#proximos-eventos", icon: "party" as MegaMenuIcon },
  { label: "Carreras", href: "#proximos-eventos", icon: "sport" as MegaMenuIcon },
  { label: "Clubes", href: "#proximos-eventos", icon: "users" as MegaMenuIcon },
  { label: "Fotógrafos", href: "#ecosistema", icon: "camera" as MegaMenuIcon },
] as const;
