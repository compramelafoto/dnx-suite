import { article, PHOTOGRAPHER_INTENTS } from "@/data/blog/phase7/helpers";
import type { Phase7ArticleDraft } from "@/data/blog/phase7/types";

const CAT = "negocio-fotografico";

export const NEGOCIO_ARTICLES: Phase7ArticleDraft[] = [
  article({
    title: "Cómo generar ingresos pasivos recomendando ComprameLaFoto",
    slug: "como-generar-ingresos-pasivos-recomendando-compramelafoto",
    categorySlug: CAT,
    excerpt:
      "Introducción al programa de referidos como fuente de ingresos recurrentes para quien recomienda fotógrafos.",
    audience: ["fotografos", "organizadores", "clientes"],
    intents: [...PHOTOGRAPHER_INTENTS, "referrals"],
    tags: ["Referidos", "Negocio fotográfico"],
    intro:
      "Recomendar fotógrafos que venden en ComprameLaFoto puede generar comisiones durante 12 meses.",
    sections: [
      "Qué significa ingreso pasivo en referidos",
      "Perfil ideal de referidor",
      "Cómo empezar",
      "Dónde compartir tu link",
      "Métricas a seguir",
      "Artículo relacionado: guía completa de referidos",
    ],
    imageScene:
      "Photographer networking at industry meetup, sharing business cards and phone screen casually",
    seoGoalNotes: "Enlazar al artículo destacado como-generar-ingresos-recomendando-compramelafoto.",
  }),
  article({
    title: "Cómo vender más fotografías de eventos",
    slug: "como-vender-mas-fotografias-eventos",
    categorySlug: CAT,
    excerpt:
      "Estrategias comerciales y operativas para aumentar ventas en maratones, torneos y fiestas.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Negocio fotográfico", "Fotógrafos", "Eventos colaborativos"],
    intro: "Vender más en eventos combina buena cobertura, precio, comunicación y timing.",
    sections: [
      "Cobertura y calidad",
      "Pricing y packs",
      "Comunicación post-evento",
      "Selfie y búsqueda rápida",
      "Urgencia y plazos",
      "Medición de resultados",
    ],
    imageScene:
      "Photographer selling photos at outdoor festival booth, customers browsing on tablet",
  }),
  article({
    title: "Cómo aumentar las ventas de fotografías escolares",
    slug: "como-aumentar-ventas-fotografias-escolares",
    categorySlug: CAT,
    excerpt:
      "Tácticas para mejorar conversión en colegios: preventa, comunicación con padres y bundles.",
    audience: ["fotografos", "escuelas"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Negocio fotográfico", "Escuelas", "Preventa"],
    intro: "La fotografía escolar tiene ciclos cortos: la ejecución comercial es tan importante como el shooting.",
    sections: [
      "Calendario escolar",
      "Preventa efectiva",
      "Bundles familiares",
      "Comunicación institucional",
      "Recordatorios",
      "Post-mortem por colegio",
    ],
    imageScene:
      "School photographer presenting sales plan to school coordinator in principal office",
  }),
  article({
    title: "Cómo vender fotografías deportivas online",
    slug: "como-vender-fotografias-deportivas-online",
    categorySlug: CAT,
    excerpt:
      "Guía de negocio para running, ciclismo y deportes de equipo vendiendo online en Argentina.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Negocio fotográfico", "Fotógrafos", "Fotografía deportiva"],
    intro: "El deporte online exige velocidad de publicación y facilidad de búsqueda para el atleta.",
    sections: [
      "Nichos deportivos",
      "Publicar rápido después del evento",
      "Dorsal y selfie",
      "Pricing en deporte",
      "Alianzas con organizadores",
      "Fidelización",
    ],
    imageScene:
      "Sports photographer editing marathon shots trackside on laptop immediately after race",
  }),
  article({
    title: "Cómo automatizar la entrega de fotografías",
    slug: "como-automatizar-entrega-fotografias",
    categorySlug: CAT,
    excerpt:
      "Reducí trabajo manual con entrega digital automática, notificaciones y flujos en ComprameLaFoto.",
    audience: ["fotografos"],
    intents: [...PHOTOGRAPHER_INTENTS, "feature-adoption"],
    tags: ["Negocio fotográfico", "Digitales", "Fotógrafos"],
    intro: "Automatizar la entrega libera tiempo y mejora la experiencia del cliente.",
    sections: [
      "Entrega digital automática",
      "Emails transaccionales",
      "Menos WhatsApp manual",
      "Integración con pagos",
      "Errores a evitar",
      "Checklist de automatización",
    ],
    imageScene:
      "Photographer relaxing while automated order confirmation emails send, studio sunset light",
  }),
  article({
    title: "Cómo evitar perder ventas por WhatsApp",
    slug: "como-evitar-perder-ventas-por-whatsapp",
    categorySlug: CAT,
    excerpt:
      "Por qué centralizar la venta en la plataforma reduce fricción, errores y ventas perdidas.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Negocio fotográfico", "Fotógrafos"],
    intro: "WhatsApp ayuda a comunicar, pero no debería ser tu única herramienta de cobro y entrega.",
    sections: [
      "Riesgos de vender solo por chat",
      "Pagos y comprobantes",
      "Entrega desordenada",
      "Profesionalismo percibido",
      "Flujo recomendado",
      "Plantillas de mensaje con link",
    ],
    imageScene:
      "Photographer overwhelmed by WhatsApp notifications while proper checkout link ready on laptop",
  }),
  article({
    title: "Vendé tus fotos sin pagar suscripción mensual",
    slug: "vende-fotos-sin-suscripcion-mensual",
    categorySlug: CAT,
    excerpt:
      "Empezá a vender fotografías online sin suscripción mensual: cargá eventos, publicá galerías y pagá comisión solo cuando concretás una venta.",
    seoDescription:
      "ComprameLaFoto es gratis para empezar: sin abono mensual ni costo fijo por galería. Solo pagás comisión cuando vendés fotos online en Argentina.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Negocio fotográfico", "Fotógrafos", "Digitales"],
    intro:
      "Muchos fotógrafos frenan ante suscripciones mensuales. ComprameLaFoto cobra comisión solo cuando vendés.",
    sections: [
      "Sin suscripción en la práctica",
      "Comparación con costos fijos",
      "Perfiles ideales",
      "Venta automatizada",
      "Modelo alineado al crecimiento",
      "Primeros pasos",
    ],
    imageScene:
      "Argentine photographer smiling at laptop in home studio, sales notification on screen, warm natural window light, hyperrealistic documentary photography",
    imageAltSubject: "Fotógrafo revisando ventas online sin preocuparse por una suscripción mensual",
    seoGoalNotes: "Adquisición fotógrafos; enlazar registro, venta digital y retiro de ganancias.",
  }),
  article({
    title: "Cómo conseguir eventos y nuevos clientes como fotógrafo usando ComprameLaFoto",
    slug: "como-conseguir-eventos-y-clientes-como-fotografo",
    categorySlug: CAT,
    excerpt:
      "Configurá tu perfil para recibir convocatorias cerca de tu ubicación, evaluar oportunidades y conseguir nuevos clientes para tu negocio fotográfico.",
    seoDescription:
      "Descubrí cómo configurar tu perfil en ComprameLaFoto para recibir convocatorias cerca de tu ubicación, evaluar oportunidades y conseguir nuevos clientes para tu negocio fotográfico.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Negocio fotográfico", "Fotógrafos", "Eventos colaborativos", "Organizadores"],
    intro:
      "ComprameLaFoto conecta fotógrafos con organizadores mediante geolocalización y convocatorias de eventos.",
    sections: [
      "Tipos de oportunidades",
      "Configurar perfil y radio de cobertura",
      "Geolocalización y convocatorias",
      "Canales de aviso",
      "Evaluar si vale la pena",
      "Comisiones del organizador",
      "Rentabilidad y postulación",
      "De la cobertura a la venta",
    ],
    imageScene:
      "Professional photographer at desk reviewing event invitation on laptop, DSLR and calendar on table, natural window light, documentary realistic photography, horizontal 16:9",
    imageAltSubject: "Fotógrafo analizando convocatoria de evento en su computadora",
    seoGoalNotes:
      "SEO: convocatorias fotógrafos, eventos cerca, geolocalización, conseguir clientes fotografía, ComprameLaFoto organizadores; enlazar eventos colaborativos, comisiones, marketplace y registro.",
  }),
];
