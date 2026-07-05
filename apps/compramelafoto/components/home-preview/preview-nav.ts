export type PreviewNavLink = {
  label: string;
  href: string;
  description?: string;
};

export type PreviewNavGroup = {
  label: string;
  href?: string;
  children?: PreviewNavLink[];
};

/** Navegación principal del header de /home-preview */
export const PREVIEW_HEADER_NAV: PreviewNavGroup[] = [
  { label: "Buscar fotos", href: "#descubrir" },
  {
    label: "Soluciones",
    children: [
      { label: "Para fotógrafos", href: "#soluciones-fotografos", description: "Álbumes, ventas y cobros" },
      { label: "Para organizadores", href: "#eventos-colaborativos", description: "Eventos y comisiones" },
      { label: "Para escuelas", href: "#gestion-escolar", description: "Preventa y álbumes privados" },
      { label: "Para laboratorios", href: "#soluciones-laboratorios", description: "Pedidos e impresión" },
    ],
  },
  {
    label: "Comunidad",
    children: [
      { label: "Fotógrafos", href: "/directorio/fotografos" },
      { label: "Laboratorios", href: "/directorio/laboratorios" },
      { label: "Empresas afines", href: "/directorio/servicios-de-eventos" },
      { label: "Organizadores", href: "/directorio/organizadores" },
    ],
  },
  {
    label: "Recursos",
    children: [
      { label: "Cómo funciona", href: "#como-funciona" },
      { label: "Preguntas frecuentes", href: "#faq" },
      { label: "Bases y condiciones", href: "/terminos" },
    ],
  },
];

/** Barra visual de herramientas / soluciones */
export const PREVIEW_SOLUTIONS_BAR: PreviewNavLink[] = [
  { label: "Marketplace de fotos", href: "#marketplace" },
  { label: "Eventos colaborativos", href: "#eventos-colaborativos" },
  { label: "Gestión escolar", href: "#gestion-escolar" },
  { label: "Comisiones", href: "#eventos-colaborativos" },
  { label: "Comunidad", href: "#comunidad" },
  { label: "Laboratorios", href: "#soluciones-laboratorios" },
];

export type ProfileId = "photographers" | "organizers" | "schools" | "labs";

export const PREVIEW_PROFILES: {
  id: ProfileId;
  title: string;
  anchor: string;
  benefits: string[];
  cta: string;
  href: string;
  visual: "photographers" | "organizers" | "schools" | "labs";
}[] = [
  {
    id: "photographers",
    title: "Fotógrafos",
    anchor: "soluciones-fotografos",
    benefits: [
      "Publicá álbumes y vendé en línea con tu lista de precios",
      "Gestioná preventas y cobros sin perseguir mensajes",
      "Compartí links y QR para que compren solos",
    ],
    cta: "Ver herramientas para fotógrafos",
    href: "/fotografo/registro",
    visual: "photographers",
  },
  {
    id: "organizers",
    title: "Organizadores",
    anchor: "soluciones-organizadores",
    benefits: [
      "Creá eventos e invitá fotógrafos colaboradores",
      "Centralizá galerías en un solo lugar",
      "Configurá comisiones por cada venta",
    ],
    cta: "Crear evento",
    href: "/organizador/events/new",
    visual: "organizers",
  },
  {
    id: "schools",
    title: "Escuelas",
    anchor: "gestion-escolar",
    benefits: [
      "Preventa escolar y álbumes por institución",
      "Búsqueda inteligente para familias",
      "Comisiones y privacidad bajo control",
    ],
    cta: "Conocer solución escolar",
    href: "/escuelas",
    visual: "schools",
  },
  {
    id: "labs",
    title: "Laboratorios",
    anchor: "soluciones-laboratorios",
    benefits: [
      "Recibí pedidos de impresión conectados a fotógrafos",
      "Integrate al ecosistema de eventos",
      "Flujo ordenado de producción y entrega",
    ],
    cta: "Registrarme como laboratorio",
    href: "/lab/registro",
    visual: "labs",
  },
];
