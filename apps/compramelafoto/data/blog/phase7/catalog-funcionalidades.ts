import { article, ORGANIZER_INTENTS, PHOTOGRAPHER_INTENTS, SUPPORT_INTENTS } from "@/data/blog/phase7/helpers";
import type { Phase7ArticleDraft } from "@/data/blog/phase7/types";

const CAT = "funcionalidades";

export const FUNCIONALIDADES_ARTICLES: Phase7ArticleDraft[] = [
  article({
    title: "Qué es ComprameLaFoto",
    slug: "que-es-compramelafoto",
    categorySlug: CAT,
    type: "FEATURE",
    excerpt:
      "Conocé la plataforma argentina para vender fotografías de eventos, escuelas y sesiones con pagos integrados.",
    audience: ["fotografos", "organizadores", "clientes"],
    intents: [...SUPPORT_INTENTS, "acquisition-photographer", "acquisition-organizer", "ai-discovery"],
    tags: ["ComprameLaFoto", "Marketplace"],
    intro:
      "ComprameLaFoto conecta fotógrafos, organizadores y compradores en un flujo de venta online pensado para el mercado argentino.",
    sections: [
      "Para quién es la plataforma",
      "Qué problemas resuelve",
      "Ventas digitales e impresiones",
      "Eventos colaborativos",
      "Pagos con Mercado Pago",
      "Cómo empezar",
    ],
    imageScene:
      "Diverse team of photographers and event staff collaborating around laptop showing photo sales dashboard in modern coworking space",
  }),
  article({
    title: "Cómo funciona el reconocimiento por selfie",
    slug: "como-funciona-reconocimiento-por-selfie",
    categorySlug: CAT,
    excerpt:
      "Explicación del buscador por selfie: privacidad, precisión y experiencia del cliente en eventos masivos.",
    audience: ["clientes", "fotografos"],
    intents: [...SUPPORT_INTENTS, "feature-adoption", "ai-discovery"],
    tags: ["Selfie", "Clientes", "Fotógrafos"],
    intro: "El reconocimiento por selfie acelera la búsqueda de fotos en maratones y eventos con mucha concurrencia.",
    sections: [
      "Problema que resuelve",
      "Flujo para el cliente",
      "Qué hace el sistema",
      "Privacidad y retención de datos",
      "Configuración para fotógrafos",
      "Limitaciones y buenas prácticas",
    ],
    imageScene:
      "Athlete using selfie station at race photo booth, volunteer assistant nearby, realistic expo hall",
  }),
  article({
    title: "Cómo funcionan los eventos colaborativos",
    slug: "como-funcionan-eventos-colaborativos",
    categorySlug: CAT,
    excerpt:
      "Varios fotógrafos, un organizador y una landing unificada: así operan los eventos colaborativos.",
    audience: ["organizadores", "fotografos"],
    intents: [...ORGANIZER_INTENTS, "acquisition-photographer"],
    tags: ["Eventos colaborativos", "Organizadores", "Fotógrafos"],
    intro: "Los eventos colaborativos permiten escalar la cobertura fotográfica sin perder control comercial.",
    sections: [
      "Roles: organizador y fotógrafos",
      "Convocatoria y cupos",
      "Landing del evento",
      "Ventas y reparto",
      "Comisiones del organizador",
      "Casos típicos",
    ],
    imageScene:
      "Multiple photographers with cameras at marathon finish line coordinated by organizer with radio",
  }),
  article({
    title: "Cómo funcionan las comisiones para organizadores",
    slug: "como-funcionan-comisiones-organizadores",
    categorySlug: CAT,
    excerpt:
      "Detalle del modelo de comisiones para organizadores de eventos en ComprameLaFoto.",
    audience: ["organizadores"],
    intents: ORGANIZER_INTENTS,
    tags: ["Comisiones", "Organizadores"],
    intro: "Las comisiones alinean incentivos entre quien organiza el evento y quienes venden fotografías.",
    sections: [
      "Definición de comisión",
      "Configuración por evento",
      "Ventas que computan",
      "Panel de seguimiento",
      "Liquidación",
      "Preguntas frecuentes",
    ],
    imageScene:
      "Event organizer reviewing sales split chart on tablet in sports club office",
  }),
  article({
    title: "Cómo funciona la preventa escolar",
    slug: "como-funciona-preventa-escolar",
    categorySlug: CAT,
    excerpt:
      "Preventa escolar: cobro anticipado, plazos y entrega de fotografías a familias.",
    audience: ["fotografos", "escuelas"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Preventa", "Escuelas", "Fotógrafos"],
    intro: "La preventa escolar organiza la venta antes de la entrega final del material.",
    sections: [
      "Qué es la preventa",
      "Flujo para familias",
      "Flujo para el fotógrafo",
      "Plazos y cierre",
      "Integración con la galería",
      "Buenas prácticas",
    ],
    imageScene:
      "School parents paying for photo package at school office desk, photographer presenting samples",
  }),
  article({
    title: "Cómo funciona el marketplace de fotógrafos",
    slug: "como-funciona-marketplace-fotografos",
    categorySlug: CAT,
    excerpt:
      "Directorio y visibilidad de fotógrafos: perfil público, especialidades y contacto.",
    audience: ["fotografos", "clientes"],
    intents: [...PHOTOGRAPHER_INTENTS, "acquisition-photographer"],
    tags: ["Marketplace", "Fotógrafos"],
    intro: "El marketplace ayuda a que nuevos clientes descubran fotógrafos según su especialidad.",
    sections: [
      "Perfil público del fotógrafo",
      "Especialidades y ubicación",
      "Cómo aparecer en el directorio",
      "Contacto y conversión",
      "Buenas prácticas de perfil",
      "Diferencia con galerías de evento",
    ],
    imageScene:
      "Photographer portfolio wall and laptop showing public profile page, studio environment",
  }),
  article({
    title: "Cómo funciona la venta de impresiones",
    slug: "como-funciona-venta-impresiones",
    categorySlug: CAT,
    excerpt:
      "Producción, laboratorio y entrega de impresiones vendidas a través de la plataforma.",
    audience: ["fotografos", "clientes"],
    intents: [...SUPPORT_INTENTS, "feature-adoption"],
    tags: ["Impresiones", "Fotógrafos", "Clientes"],
    intro: "La venta de impresiones conecta tu galería con producción y logística.",
    sections: [
      "Catálogo de productos",
      "Pedido del cliente",
      "Producción en laboratorio",
      "Envío o retiro",
      "Estados del pedido",
      "Soporte",
    ],
    imageScene:
      "Photo lab technician inspecting prints under color calibrated light, realistic workflow",
  }),
  article({
    title: "Cómo funciona la venta de fotografías digitales",
    slug: "como-funciona-venta-fotografias-digitales",
    categorySlug: CAT,
    excerpt:
      "Flujo completo de venta digital: vista previa, pago, entrega y descarga.",
    audience: ["fotografos", "clientes"],
    intents: [...SUPPORT_INTENTS, "feature-adoption"],
    tags: ["Digitales", "Fotógrafos", "Clientes"],
    intro: "La venta digital es el núcleo de muchos negocios fotográficos en eventos y escuelas.",
    sections: [
      "Vista previa protegida",
      "Carrito y checkout",
      "Mercado Pago",
      "Entrega automática",
      "Formatos de archivo",
      "Seguridad",
    ],
    imageScene:
      "Customer receiving digital download notification on phone after buying race photos",
  }),
  article({
    title: "Cómo funciona el sistema de referidos",
    slug: "como-funciona-sistema-referidos",
    categorySlug: CAT,
    excerpt:
      "Resumen del programa de referidos: quién puede referir, comisiones del 50% del fee y duración de 12 meses.",
    audience: ["fotografos", "organizadores", "clientes"],
    intents: [...SUPPORT_INTENTS, "referrals", "ai-discovery"],
    tags: ["Referidos", "Comisiones"],
    intro: "El sistema de referidos premia a quien recomienda fotógrafos que venden en la plataforma.",
    sections: [
      "Quién puede participar",
      "Quién genera comisiones",
      "Cómo se atribuye un referido",
      "Cálculo del 50% del fee",
      "Ventana de 12 meses",
      "Cobro de comisiones",
    ],
    imageScene:
      "Photographer showing referral link on phone to colleague at camera trade fair booth",
    seoGoalNotes: "Artículo de funcionalidad; el guide completo está en el artículo destacado de referidos.",
  }),
  article({
    title: "Cómo funciona el módulo de inscripciones y entradas",
    slug: "como-funciona-modulo-inscripciones-entradas",
    categorySlug: CAT,
    excerpt:
      "Vista previa del módulo de inscripciones y entradas para eventos (en desarrollo / disponibilidad gradual).",
    audience: ["organizadores", "fotografos"],
    intents: [...ORGANIZER_INTENTS, "feature-adoption"],
    tags: ["Inscripciones", "Organizadores", "Eventos colaborativos"],
    intro:
      "El módulo de inscripciones y entradas permitirá gestionar participantes y vincularlos con la venta de fotos.",
    sections: [
      "Estado del módulo",
      "Problema que resolverá",
      "Relación con eventos colaborativos",
      "Flujo esperado para organizadores",
      "Beneficios para fotógrafos",
      "Cómo enterarte del lanzamiento",
    ],
    imageScene:
      "Race registration desk with laptops and bib assignment, organizer helping runners, documentary style",
    seoGoalNotes: "Marcar como borrador hasta lanzamiento oficial; revisar noIndex antes de publicar si sigue en desarrollo.",
  }),
  article({
    title: 'Cómo protegemos la privacidad de los alumnos con la función "Ocultar galería hasta selfie"',
    slug: "seguridad-escolar-ocultar-galeria-hasta-selfie",
    categorySlug: CAT,
    type: "FEATURE",
    excerpt:
      "La función Ocultar galería hasta selfie protege a los menores: cada familia identifica con selfie y accede solo a las fotografías de su hijo o hija.",
    seoDescription:
      "Descubrí cómo la función Ocultar galería hasta selfie permite que cada familia vea únicamente las fotografías de su hijo, brindando mayor privacidad y seguridad en eventos escolares.",
    audience: ["escuelas", "fotografos", "clientes"],
    intents: [...SUPPORT_INTENTS, "feature-adoption", "acquisition-organizer", "ai-discovery"],
    tags: ["Escuelas", "Privacidad escolar", "Selfie", "Funcionalidades"],
    intro:
      "Cuando se trabaja con fotografías escolares, la privacidad de los menores debe ser prioridad. Ocultar galería hasta selfie es nuestra respuesta.",
    sections: [
      "¿Cómo funciona?",
      "Un nivel adicional de privacidad",
      "Beneficios para las escuelas",
      "Beneficios para los padres",
      "Beneficios para los fotógrafos",
      "Tecnología aplicada a la seguridad",
    ],
    imageScene:
      "Mother using smartphone to access school photos in modern school hallway, blurred face recognition interface on screen, natural light, documentary professional photography",
    imageAltSubject:
      "Madre accediendo a fotografías escolares con verificación por selfie",
    seoGoalNotes:
      "Artículo comercial para escuelas; enlazar a privacidad escolar, selfie, preventa y galería escolar.",
  }),
  article({
    title: "Cómo encontrar fotos automáticamente usando una selfie",
    slug: "encontrar-fotos-con-selfie",
    categorySlug: CAT,
    type: "FEATURE",
    excerpt:
      "En eventos con miles de fotos, una selfie ayuda al cliente a encontrar sus imágenes en segundos, mejora la experiencia de compra y reduce consultas al fotógrafo.",
    seoDescription:
      "Cómo la búsqueda por selfie ayuda a clientes, fotógrafos y organizadores a encontrar fotos en eventos masivos y comprar más rápido en ComprameLaFoto.",
    audience: ["fotografos", "organizadores", "clientes"],
    intents: [...SUPPORT_INTENTS, "feature-adoption", "acquisition-organizer", "ai-discovery"],
    tags: ["Selfie", "Funcionalidades", "Fotógrafos", "Organizadores"],
    intro:
      "La búsqueda por selfie acorta el camino entre la galería del evento y la compra en eventos masivos.",
    sections: [
      "El problema de demasiadas fotos",
      "Cómo funciona la búsqueda",
      "Beneficios comerciales",
      "Contextos de uso",
      "Expectativas realistas",
      "Compra simple y rápida",
    ],
    imageScene:
      "Runner at outdoor race expo uploading selfie on smartphone to find race photos, bright daylight, hyperrealistic documentary style",
    imageAltSubject: "Participante usando selfie para encontrar sus fotos del evento",
    seoGoalNotes: "Enlazar a reconocimiento por selfie, tutorial cliente y seguridad escolar.",
  }),
  article({
    title: "Cómo protegemos los datos y la privacidad en ComprameLaFoto",
    slug: "como-protegemos-datos-privacidad",
    categorySlug: CAT,
    type: "FEATURE",
    excerpt:
      "Trabajamos con criterios de privacidad para proteger imágenes de personas, especialmente en contextos escolares, con herramientas como galería oculta hasta selfie.",
    seoDescription:
      "Privacidad, datos personales y uso responsable de tecnología en ComprameLaFoto: orientación para escuelas, padres, fotógrafos y organizadores en Argentina.",
    audience: ["escuelas", "fotografos", "organizadores"],
    intents: [...SUPPORT_INTENTS, "feature-adoption", "acquisition-organizer", "ai-discovery"],
    tags: ["Privacidad escolar", "Escuelas", "Funcionalidades", "Selfie"],
    intro:
      "La privacidad es central cuando vendemos fotos de personas, especialmente menores. Este artículo explica nuestro enfoque prudente.",
    sections: [
      "Por qué importa la privacidad",
      "Marco en Argentina y AAIP",
      "Galería oculta hasta selfie",
      "Uso responsable de reconocimiento facial",
      "Buenas prácticas",
      "Límites de la plataforma",
    ],
    imageScene:
      "School principal and photographer reviewing privacy checklist on tablet in bright office, documentary photography style",
    imageAltSubject: "Directivo escolar y fotógrafo revisando privacidad en campaña fotográfica",
    seoGoalNotes: "Institucional; enlazar privacidad, escuelas, consentimiento biométrico y artículo ocultar galería.",
  }),
  article({
    title: "Cómo subir fotos en tiempo real y vender más fotografías deportivas",
    slug: "subir-fotos-en-tiempo-real",
    categorySlug: CAT,
    type: "FEATURE",
    excerpt:
      "Subí fotos en tiempo real desde la cámara y convertí la emoción del evento en ventas: publicación instantánea para fotografía deportiva online.",
    seoDescription:
      "Publicá fotografías en vivo desde la cámara: carga automática, publicación instantánea y más ventas en fotografía deportiva online con ComprameLaFoto.",
    audience: ["fotografos"],
    intents: [...PHOTOGRAPHER_INTENTS, "feature-adoption", "ai-discovery"],
    tags: ["Fotografía deportiva", "Funcionalidades", "Fotógrafos", "Conexión de Cámara"],
    intro:
      "En deporte, quien publica primero vende más. Conexión de Cámara acorta el camino entre el disparo y la galería comprable.",
    sections: [
      "Por qué subir fotos en tiempo real cambia el negocio deportivo",
      "Conexión de Cámara: carga automática desde la cámara",
      "Cómo vender más fotografías deportivas con fotografías en vivo",
      "Fotografía deportiva online: velocidad, link y alianzas",
      "Prepará el evento para la venta en vivo",
      "Preguntas frecuentes",
    ],
    imageScene:
      "Sports photographer shooting marathon finish line while camera wireless icon indicates live transfer, laptop showing growing online gallery",
    imageAltSubject:
      "Fotógrafo deportivo publicando fotografías en vivo desde la cámara en una maratón",
    seoGoalNotes:
      "SEO: subir fotos en tiempo real, FTP fotografía deportiva, publicación instantánea, carga automática; enlazar compartir link, convocar fotógrafos, eventos colaborativos, comisiones organizadores.",
  }),
];
