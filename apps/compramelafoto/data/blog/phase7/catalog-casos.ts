import { article, ORGANIZER_INTENTS, PHOTOGRAPHER_INTENTS } from "@/data/blog/phase7/helpers";
import type { Phase7ArticleDraft } from "@/data/blog/phase7/types";

const CAT = "casos-de-uso";

const CASE_SECTIONS = [
  "Contexto del evento",
  "Desafíos habituales",
  "Configuración recomendada en ComprameLaFoto",
  "Estrategia de cobertura",
  "Comunicación a participantes",
  "Pricing sugerido",
  "Métricas de éxito",
  "Lecciones aprendidas",
];

export const CASOS_ARTICLES: Phase7ArticleDraft[] = [
  article({
    title: "Cómo vender fotografías de una maratón",
    slug: "como-vender-fotografias-maraton",
    categorySlug: CAT,
    type: "CASE_STUDY",
    excerpt: "Caso de uso: venta de fotos en maratones y carreras de running con selfie y dorsal.",
    audience: ["fotografos", "organizadores"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Fotografía deportiva", "Fotógrafos", "Selfie"],
    intro: "Las maratones concentran miles de corredores que buscan sus fotos el mismo día.",
    sections: CASE_SECTIONS,
    imageScene:
      "Marathon photographers capturing runners at km marker, city street race, realistic crowd density",
  }),
  article({
    title: "Cómo vender fotografías de un torneo deportivo",
    slug: "como-vender-fotografias-torneo-deportivo",
    categorySlug: CAT,
    type: "CASE_STUDY",
    excerpt: "Caso de uso: torneos de fútbol, hockey o básquet con múltiples canchas y categorías.",
    audience: ["fotografos", "organizadores"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Fotografía deportiva", "Eventos colaborativos"],
    intro: "Un torneo requiere organización por categorías, horarios y cobertura simultánea.",
    sections: CASE_SECTIONS,
    imageScene:
      "Youth football tournament with photographers along sideline, parents watching from stands",
  }),
  article({
    title: "Cómo vender fotografías escolares",
    slug: "como-vender-fotografias-escolares-caso-de-uso",
    categorySlug: CAT,
    type: "CASE_STUDY",
    excerpt: "Caso de uso completo: proyecto anual de fotografía escolar con preventa y privacidad.",
    audience: ["fotografos", "escuelas"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Escuelas", "Preventa", "Privacidad escolar"],
    intro: "La venta escolar combina volumen, sensibilidad de datos y ventanas de compra cortas.",
    sections: CASE_SECTIONS,
    imageScene:
      "School photo day with orderly lines of students, photographer with step ladder in gymnasium",
  }),
  article({
    title:
      "Día de la Bandera: una de las mejores oportunidades del año para vender fotografías escolares",
    slug: "dia-de-la-bandera-vender-fotos-escolares",
    categorySlug: CAT,
    type: "CASE_STUDY",
    excerpt:
      "Cada 20 de junio, miles de niños prometen lealtad a la Bandera Argentina. Para las familias es un recuerdo único, y para los fotógrafos escolares una gran oportunidad para vender fotografías de forma simple, segura y profesional.",
    seoDescription:
      "Descubrí por qué los actos de Promesa de Lealtad a la Bandera son una de las mejores oportunidades del año para fotógrafos escolares y cómo vender más con ComprameLaFoto.",
    audience: ["fotografos", "escuelas"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: [
      "Día de la bandera",
      "Fotografía escolar",
      "Actos escolares",
      "Venta de fotos",
      "Promesa a la bandera",
      "ComprameLaFoto",
    ],
    intro:
      "El 20 de junio concentra emoción familiar y demanda de recuerdos profesionales en un acto que cada alumno vive una sola vez.",
    sections: [
      "Un momento único que ocurre una sola vez",
      "¿Qué fotografías suelen tener mayor valor?",
      "La velocidad de publicación también influye en las ventas",
      "Cómo ayuda ComprameLaFoto",
      "Ocultar galería hasta selfie",
      "Una oportunidad que muchos fotógrafos desaprovechan",
    ],
    imageScene:
      "Argentine school flag day ceremony, students in uniforms at flag promise event, families watching, documentary photography",
    imageAltSubject:
      "Acto escolar de Promesa de Lealtad a la Bandera con alumnos y familias",
    seoGoalNotes:
      "Artículo estacional 20 de junio; enlazar a caso escolar, selfie, publicar galería y registro fotógrafo.",
  }),
  article({
    title: "Cómo vender fotografías de una fiesta de egresados",
    slug: "como-vender-fotografias-fiesta-egresados",
    categorySlug: CAT,
    type: "CASE_STUDY",
    excerpt: "Caso de uso: fiestas de egresados, cotillón y entrega rápida a estudiantes y familias.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Eventos", "Fotógrafos", "Digitales"],
    intro: "Los egresados valoran compartir en redes; la velocidad de entrega impulsa las ventas.",
    sections: CASE_SECTIONS,
    imageScene:
      "Graduation party photographer with on-camera flash, students in formal attire, ballroom venue",
  }),
  article({
    title: "Cómo vender fotografías de un recital",
    slug: "como-vender-fotografias-recital",
    categorySlug: CAT,
    type: "CASE_STUDY",
    excerpt: "Caso de uso: recitales de danza o música con baja luz y necesidad de venta post-show.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Eventos", "Fotógrafos"],
    intro: "Los recitales presentan desafíos técnicos y comerciales distintos a un evento deportivo.",
    sections: CASE_SECTIONS,
    imageScene:
      "Dance recital photographer backstage, performers in costumes, soft theater lighting realistic",
  }),
  article({
    title: "Cómo vender fotografías de un evento corporativo",
    slug: "como-vender-fotografias-evento-corporativo",
    categorySlug: CAT,
    type: "CASE_STUDY",
    excerpt:
      "Caso de uso: conferencias, team building y lanzamientos con entrega a empresas y asistentes.",
    audience: ["fotografos", "organizadores"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Eventos", "Fotógrafos", "Negocio fotográfico"],
    intro: "Los eventos corporativos priorizan imagen de marca y entrega controlada.",
    sections: CASE_SECTIONS,
    imageScene:
      "Corporate conference photographer capturing keynote speaker, attendees with badges, hotel ballroom",
  }),
  article({
    title:
      "Viajes estudiantiles y turismo: una nueva oportunidad para fotógrafos, coordinadores y agencias de viaje",
    slug: "viajes-estudiantiles-turismo-fotografos-compramelafoto",
    categorySlug: CAT,
    type: "CASE_STUDY",
    excerpt:
      "Las empresas de turismo pueden utilizar ComprameLaFoto como organizadores de eventos: crear viajes, convocar fotógrafos en destino, vender fotografías a los pasajeros y generar comisiones sin costos mensuales.",
    seoDescription:
      "Descubrí cómo las empresas de turismo, coordinadores y agencias de viaje pueden usar ComprameLaFoto para convocar fotógrafos, vender fotos a los pasajeros y generar comisiones sin costos fijos.",
    audience: ["fotografos", "organizadores", "escuelas"],
    intents: [...PHOTOGRAPHER_INTENTS, ...ORGANIZER_INTENTS, "acquisition-organizer"],
    tags: [
      "Viajes estudiantiles",
      "Turismo",
      "Agencias de viaje",
      "Organizadores",
      "Fotógrafos",
      "Eventos",
      "Comisiones",
      "Escuelas",
      "Viajes de egresados",
      "ComprameLaFoto",
    ],
    intro:
      "Los viajes grupales concentran emoción, recuerdos y demanda de fotografías profesionales en destinos donde la agencia no siempre tiene proveedores locales.",
    sections: [
      "¿Puede una empresa de turismo utilizar ComprameLaFoto?",
      "Encontrar fotógrafos en cualquier destino",
      "Más oportunidades para los fotógrafos",
      "Un modelo ideal para viajes estudiantiles",
      "La empresa también puede generar ingresos",
      "Sin costos mensuales ni inversión inicial",
      "El futuro de la fotografía en viajes",
    ],
    imageScene:
      "Student group travel in Patagonia Argentina, school trip at scenic viewpoint, travel coordinator with students, documentary photography",
    imageAltSubject:
      "Grupo de estudiantes en viaje turístico con coordinador en un destino patagónico",
    seoGoalNotes:
      "Caso de uso turismo y viajes estudiantiles; enlazar eventos colaborativos, convocar fotógrafos, comisiones organizadores y sin suscripción.",
  }),
];
