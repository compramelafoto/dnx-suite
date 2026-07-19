import { routes } from "@/config/navigation";

/**
 * Experiencia pública “Aliados Fundadores”.
 * Sin precios, sin métricas inventadas, sin sponsors confirmados.
 */
export const foundingAlliesContent = {
  meta: {
    title: "Aliados Fundadores",
    description:
      "Formá parte de Clickatón. Una invitación a marcas que quieran construir con nosotros una comunidad fotográfica. Las mejores experiencias se construyen entre muchos.",
  },

  conceptualNote: "Visualizaciones conceptuales. No representan una edición real.",
  brandIntegrationNote: "Ejemplo conceptual de integración de marca.",

  hero: {
    eyebrow: "Aliados Fundadores",
    titleLines: [
      "No buscamos sponsors.",
      "Buscamos marcas",
      "que quieran",
      "formar parte",
      "de esta historia.",
    ],
    subtitle: "Las mejores experiencias se construyen entre muchos.",
    cta: {
      label: "Quiero formar parte",
      href: `${routes.contact}?motivo=aliados`,
    },
    image: {
      src: "/images/founding-allies/hero.jpg",
      alt: "Fotógrafo en la ciudad al atardecer — imagen artística conceptual",
    },
  },

  movement: {
    eyebrow: "El movimiento",
    title: "¿Qué es Clickatón?",
    lead: "No es solo un evento. Es una forma de mirar.",
    body: "Clickatón nace donde se cruzan la fotografía, la creatividad y la ciudad. Un encuentro para aprender, compartir y construir comunidad cultural a través de la mirada.",
    pillars: [
      { label: "Fotografía", body: "Salir a mirar con intención." },
      { label: "Creatividad", body: "Probar, equivocarse, descubrir." },
      { label: "Comunidad", body: "Encontrarse con otras miradas." },
      { label: "Ciudad", body: "Habitar el territorio con los ojos abiertos." },
      { label: "Cultura", body: "Dejar una huella en el relato local." },
      { label: "Aprendizaje", body: "Crecer entre pares y referentes." },
      { label: "Encuentro", body: "Conversar, compartir, celebrar." },
    ],
  },

  whyJoin: {
    eyebrow: "Pertenencia",
    title: "¿Por qué una empresa debería sumarse?",
    lead: "No se trata de comprar un logo en un banner.",
    body: "Se trata de hacer posibles las experiencias que las personas van a recordar.",
    experiences: [
      "La acreditación",
      "El desayuno",
      "El kit",
      "Las remeras",
      "La expo de marcas",
      "Las charlas",
      "Los premios",
      "Las gorras",
      "El escenario",
      "La comunidad",
    ],
  },

  expo: {
    eyebrow: "Espacio de encuentro",
    title: "Expo de marcas",
    lead: "Durante las acreditaciones, un lugar para conocerse.",
    body: "No es solo un stand. Es un espacio donde participantes y marcas conversan sobre productos, servicios, equipamiento, impresión, escuelas, instituciones, tecnología, turismo y cultura.",
    categories: [
      "Productos",
      "Servicios",
      "Equipamiento",
      "Impresión",
      "Escuelas",
      "Instituciones",
      "Tecnología",
      "Turismo",
      "Cultura",
    ],
    image: {
      src: "/images/founding-allies/stand.jpg",
      alt: "Visualización conceptual de stand en expo de marcas Clickatón",
    },
  },

  merch: {
    eyebrow: "Identidad tangible",
    title: "El merchandising",
    lead: "Piezas que cuentan la historia antes de que empiece.",
    items: [
      {
        id: "tee-men",
        title: "Remera masculina",
        src: "/images/founding-allies/tee-men.jpg",
        alt: "Mockup conceptual de remera negra masculina Clickatón",
        span: "normal" as const,
      },
      {
        id: "tee-women",
        title: "Remera femenina",
        src: "/images/founding-allies/tee-women.jpg",
        alt: "Mockup conceptual de remera negra femenina Clickatón",
        span: "normal" as const,
      },
      {
        id: "tee-back-allies",
        title: "Remera — espalda (integración)",
        src: "/images/founding-allies/tee-back-allies.jpg",
        alt: "Mockup conceptual de espalda de remera con integración de marcas — ejemplo visual",
        span: "normal" as const,
      },
      {
        id: "cap",
        title: "Gorra",
        src: "/images/founding-allies/cap.jpg",
        alt: "Mockup conceptual de gorra negra premium Clickatón",
        span: "normal" as const,
      },
      {
        id: "sticker-sheet-a",
        title: "Plancha de stickers",
        src: "/images/founding-allies/sticker-sheet-a.jpg",
        alt: "Plancha conceptual de stickers animados para fotógrafos Clickatón",
        span: "normal" as const,
      },
      {
        id: "sticker-sheet-b",
        title: "Stickers pack fotógrafo",
        src: "/images/founding-allies/sticker-sheet-b.jpg",
        alt: "Segunda plancha conceptual de stickers animados Clickatón",
        span: "normal" as const,
      },
      {
        id: "credential",
        title: "Credencial y lanyard",
        src: "/images/founding-allies/credential.jpg",
        alt: "Mockup conceptual de credencial y lanyard Clickatón",
        span: "normal" as const,
      },
      {
        id: "kit",
        title: "Kit del participante",
        src: "/images/founding-allies/kit.jpg",
        alt: "Mockup conceptual del kit del participante Clickatón",
        span: "wide" as const,
      },
      {
        id: "tote",
        title: "Bolsa ecológica",
        src: "/images/founding-allies/tote.jpg",
        alt: "Mockup conceptual de bolsa ecológica Clickatón",
        span: "normal" as const,
      },
      {
        id: "banner",
        title: "Banner",
        src: "/images/founding-allies/banner.jpg",
        alt: "Mockup conceptual de banner Clickatón",
        span: "wide" as const,
      },
      {
        id: "rollup",
        title: "Roll up",
        src: "/images/founding-allies/rollup.jpg",
        alt: "Mockup conceptual de roll up Clickatón con logo oficial en fondo transparente",
        span: "normal" as const,
      },
      {
        id: "accreditation",
        title: "Mesa de acreditaciones",
        src: "/images/founding-allies/accreditation.jpg",
        alt: "Mockup conceptual de mesa de acreditaciones Clickatón",
        span: "wide" as const,
      },
      {
        id: "tent-back",
        title: "Carpa y back institucional",
        src: "/images/founding-allies/tent-back.jpg",
        alt: "Mockup conceptual de carpa y back institucional Clickatón",
        span: "wide" as const,
      },
      {
        id: "stand",
        title: "Stand",
        src: "/images/founding-allies/stand.jpg",
        alt: "Mockup conceptual de stand Clickatón",
        span: "wide" as const,
      },
    ],
  },

  imagine: {
    eyebrow: "Integración",
    title: "Imaginá tu marca acá",
    lead: "Remera. Gorra. Banner. Credencial. Roll up. Expo. Kit. Stand.",
    body: "Cada pieza puede contar una historia compartida — siempre como visualización conceptual, nunca como promesa de un formato cerrado.",
    highlights: [
      {
        title: "Remera frente",
        src: "/images/founding-allies/tee-men.jpg",
        alt: "Remera con logo oficial Clickatón",
      },
      {
        title: "Remera espalda",
        src: "/images/founding-allies/tee-back-allies.jpg",
        alt: "Ejemplo conceptual de integración de marcas en espalda de remera",
      },
      { title: "Gorra", src: "/images/founding-allies/cap.jpg", alt: "Gorra con isologotipo oficial Clickatón" },
      { title: "Banner", src: "/images/founding-allies/banner.jpg", alt: "Banner con logo oficial Clickatón" },
      { title: "Credencial", src: "/images/founding-allies/credential.jpg", alt: "Credencial con logo oficial Clickatón" },
      { title: "Roll up", src: "/images/founding-allies/rollup.jpg", alt: "Roll up con logo oficial Clickatón en fondo transparente" },
      { title: "Expo", src: "/images/founding-allies/stand.jpg", alt: "Expo con logo oficial Clickatón" },
      { title: "Kit", src: "/images/founding-allies/kit.jpg", alt: "Kit con logo oficial Clickatón" },
    ],
  },

  ways: {
    eyebrow: "Alianzas",
    title: "Formas de participar",
    lead: "Cada alianza se diseña a medida.",
    body: "Sin categorías rígidas de precio. Adaptamos la participación según objetivos, productos, servicios, premios e infraestructura.",
    roles: [
      {
        title: "Aliado",
        body: "Acompañás una pieza concreta de la experiencia y formás parte del relato fundacional.",
      },
      {
        title: "Partner",
        body: "Construís presencia sostenida en la jornada y en los espacios de encuentro.",
      },
      {
        title: "Partner Principal",
        body: "Impulsás el corazón de la edición: comunidad, escenario y momentos clave.",
      },
      {
        title: "Aliado Técnico",
        body: "Sumás conocimiento, equipamiento o infraestructura que hace posible la experiencia.",
      },
    ],
    adapts: ["Objetivos", "Productos", "Servicios", "Premios", "Infraestructura"],
  },

  vision: {
    eyebrow: "Horizonte",
    title: "Nuestra visión",
    lead: "Empezamos en Rosario. Soñamos en red.",
    body: "Queremos crecer con nuevas ciudades, fortalecer la comunidad fotográfica, potenciar la educación y construir una red de organizadores que lleve Clickatón a más territorios.",
    points: [
      { title: "Rosario", body: "El primer capítulo." },
      { title: "Nuevas ciudades", body: "Más miradas, más territorios." },
      { title: "Comunidad", body: "Personas que vuelven y se quedan." },
      { title: "Crecimiento", body: "Sin perder el alma del encuentro." },
      { title: "Fotografía", body: "El oficio y el deseo de mirar." },
      { title: "Educación", body: "Aprender juntos, siempre." },
      { title: "Red de organizadores", body: "Quienes hacen posible cada sede." },
    ],
  },

  final: {
    titleLines: [
      "No estás apoyando",
      "un evento.",
      "Estás ayudando",
      "a construir",
      "la comunidad",
      "fotográfica",
      "que soñamos.",
    ],
    script: "Formá parte del primer capítulo.",
    cta: {
      label: "Quiero conversar",
      href: `${routes.contact}?motivo=aliados`,
    },
  },
} as const;
