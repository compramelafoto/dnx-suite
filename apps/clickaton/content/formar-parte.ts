import { routes } from "@/config/navigation";
import { formarParteHeroMetrics } from "@/content/formar-parte-metrics";

/**
 * Landing pública “Formá parte de Clickatón”.
 * Presentación institucional para empresas e instituciones.
 * Sin formularios, sin backend, sin logos inventados, sin precios.
 */
export const formarParteContent = {
  meta: {
    title: "Formá parte de Clickatón | Aliados y Empresas",
    description:
      "Descubrí cómo empresas, instituciones y organizaciones pueden acompañar Clickatón y formar parte de una comunidad que impulsa la fotografía y la cultura.",
  },

  hero: {
    title: "Formá parte de Clickatón",
    subtitle:
      "Una comunidad que sale a descubrir las ciudades a través de la fotografía.",
    cta: {
      label: "Quiero formar parte",
      href: `${routes.contact}?motivo=formar-parte#formulario`,
    },
    image: {
      src: "/images/formar-parte/hero.png",
      alt: "Participantes de espaldas mirando la ciudad, con cámaras y celulares",
    },
    metricsNote:
      "Comunidad ComprameLaFoto — fotógrafos, usuarios, ciudades con fotógrafos y fotografías publicadas.",
    metrics: formarParteHeroMetrics,
  },

  whatIs: {
    eyebrow: "El movimiento",
    title: "¿Qué es Clickatón?",
    paragraphs: [
      "Clickatón es un movimiento que invita a mirar la ciudad con otros ojos. No es únicamente una competencia: es una experiencia colectiva donde la fotografía se vuelve lenguaje, encuentro y cultura.",
      "Salimos a descubrir calles, plazas y rincones. Creamos comunidad entre quienes fotografían, aprenden y comparten. Conectamos personas, difuminamos fronteras entre aficionados y profesionales, y dejamos una huella cultural en cada territorio.",
      "Cada edición es una invitación a recorrer, a contar historias y a construir algo más grande que un evento: una comunidad que vuelve, crece y se reconoce.",
    ],
    image: {
      code: "IMAGEN 01",
      label: "Acreditación",
      src: "/images/formar-parte/imagen-01.png",
      alt: "Mesa de acreditación Clickatón con credenciales, staff y material del evento",
    },
  },

  ecosystem: {
    eyebrow: "Familia de plataformas",
    title: "Integrados a un mismo ecosistema",
    lead: "Clickatón forma parte de una familia de plataformas de información y comunidad fotográfica. Espacios donde circulan fotógrafos de todo el país.",
    body: "Acompañar Clickatón es sumarte a una red viva: información, venta fotográfica, experiencias urbanas y herramientas profesionales, conectadas entre sí.",
    platforms: [
      {
        name: "InfoSpot",
        role: "Información",
        body: "Plataforma de información para la comunidad fotográfica: novedades, convocatorias y contenido que mantiene viva la conversación.",
      },
      {
        name: "ComprameLaFoto",
        role: "Comunidad y venta",
        body: "Donde fotógrafos de todo el país publican, venden y hacen circular su trabajo. La red cotidiana de la comunidad.",
      },
      {
        name: "Clickatón",
        role: "Experiencia",
        body: "La experiencia que sale a la calle: recorrer la ciudad, crear, compartir y construir comunidad a través de la fotografía.",
      },
      {
        name: "Fotoffice",
        role: "Herramientas",
        body: "Espacio de herramientas y gestión para fotógrafos profesionales que sostienen su oficio día a día.",
      },
    ],
  },

  why: {
    eyebrow: "Valor compartido",
    title: "¿Por qué acompañar Clickatón?",
    lead: "Porque tu marca puede vivir donde la comunidad vive: en la calle, en el kit, en la conversación y en el recuerdo.",
    cards: [
      {
        title: "Llegás a miles de fotógrafos",
        body: "Una audiencia activa, creativa y comprometida con la experiencia — no un público pasivo.",
        icon: "users" as const,
      },
      {
        title: "Tu marca vive la experiencia",
        body: "No solo aparece: acompaña el recorrido, el kit, el escenario y los momentos que se comparten.",
        icon: "spark" as const,
      },
      {
        title: "Contenido generado por la comunidad",
        body: "Fotografías, historias y publicaciones nacidas de la participación real de miles de miradas.",
        icon: "camera" as const,
      },
      {
        title: "Presencia física",
        body: "Acreditación, merchandising, arco, stand, escenario: tu marca en el territorio del evento.",
        icon: "map" as const,
      },
      {
        title: "Presencia digital",
        body: "Web, redes, emails e historias que amplifican el relato antes, durante y después.",
        icon: "signal" as const,
      },
      {
        title: "Construís comunidad",
        body: "Formás parte de algo que crece con cada edición y deja cultura, no solo impresiones.",
        icon: "heart" as const,
      },
    ],
  },

  timeline: {
    eyebrow: "El recorrido",
    title: "Así vive un participante Clickatón",
    lead: "En cada paso hay un lugar donde una marca puede acompañar con sentido.",
    steps: [
      {
        title: "Compra su entrada",
        body: "Tu marca puede estar presente en la comunicación de inscripción y en el primer contacto con la experiencia.",
      },
      {
        title: "Recibe su kit",
        body: "Merchandising, mensajes y piezas tangibles que acompañan al participante desde el día uno.",
      },
      {
        title: "Se acredita",
        body: "Credenciales, lanyards y el momento de llegada: presencia física en el umbral del evento.",
      },
      {
        title: "Recorre la ciudad",
        body: "Señalética, mapas y puntos de encuentro donde la marca dialoga con el territorio.",
      },
      {
        title: "Publica historias",
        body: "Contenido espontáneo en redes: tu marca viaja con las historias de quienes viven Clickatón.",
      },
      {
        title: "Sube fotografías",
        body: "La plataforma y los canales digitales pueden integrar menciones y relatos compartidos.",
      },
      {
        title: "Comparte",
        body: "El boca a boca creativo: cada publicación amplifica la experiencia y a quienes la hacen posible.",
      },
      {
        title: "Premiación",
        body: "Escenario, entrega de premios y el cierre emocional donde tu marca puede celebrar junto a la comunidad.",
      },
      {
        title: "Espera la próxima edición",
        body: "El vínculo continúa: newsletters, redes y la anticipación de volver a encontrarse.",
      },
    ],
  },

  presence: {
    eyebrow: "Presencia de marca",
    title: "Tu marca presente durante toda la experiencia",
    lead: "Del espacio del evento a cada pieza del kit: momentos donde tu marca puede vivir junto a la comunidad.",
    /** Collage: plano general → detalle. Hover muestra la etiqueta. */
    collage: [
      {
        id: "stands",
        label: "Zona de Stand",
        description: "Presencia física en la expo: stand, banners y encuentro con participantes.",
        src: "/images/formar-parte/presence/01-stands.png",
        alt: "Zona de stands del evento con espacio para tu marca",
        size: "hero" as const,
      },
      {
        id: "web",
        label: "Visualización Web",
        description: "Tu marca en el sitio y en la comunicación digital de Clickatón.",
        src: "/images/formar-parte/presence/02-web.png",
        alt: "Sitio web de Clickatón con espacio para sponsors",
        size: "wide" as const,
      },
      {
        id: "banner",
        label: "Banners",
        description: "Roll up y cartelería con espacio para aliados oficiales.",
        src: "/images/formar-parte/presence/03-banner.png",
        alt: "Roll up oficial con espacio para tu marca",
        size: "portrait" as const,
      },
      {
        id: "remeras",
        label: "Remeras",
        description: "Frente y espalda de la remera oficial con integración de sponsors.",
        src: "/images/formar-parte/presence/04-remeras.png",
        alt: "Remeras oficiales frente y espalda con sponsors",
        size: "pair" as const,
      },
      {
        id: "credenciales",
        label: "Credenciales",
        description: "Acreditación, credenciales y material de llegada al evento.",
        src: "/images/formar-parte/presence/09-acreditacion.png",
        alt: "Mesa de acreditación con credenciales del evento",
        size: "pair" as const,
      },
      {
        id: "bolsa",
        label: "Bolsa de Kit",
        description: "La bolsa del kit del participante, visible durante toda la jornada.",
        src: "/images/formar-parte/presence/05-bolsa.png",
        alt: "Bolsa ecológica del kit con espacio para tu marca",
        size: "square" as const,
      },
      {
        id: "agenda",
        label: "Agenda",
        description: "Agenda del participante con las marcas que acompañan la edición.",
        src: "/images/formar-parte/presence/06-agenda.png",
        alt: "Agenda del participante con marcas que acompañan",
        size: "square" as const,
      },
      {
        id: "botella",
        label: "Botella",
        description: "Botella térmica del kit con espacio para tu marca.",
        src: "/images/formar-parte/presence/07-botella.png",
        alt: "Botella térmica con branding y espacio para tu marca",
        size: "square" as const,
      },
    ],
  },

  touchpoints: {
    eyebrow: "Alcance",
    title: "¿Cuántas veces puede ver una persona tu marca?",
    lead: "Una sola alianza puede acompañar el viaje completo del participante.",
    steps: [
      "Antes del evento",
      "Redes sociales",
      "Web",
      "Inscripción",
      "Email",
      "Acreditación",
      "Remera",
      "Credencial",
      "Stand",
      "Premiación",
      "Fotos",
      "Videos",
      "Publicaciones posteriores",
    ],
    highlight: {
      line1: "Una sola alianza.",
      line2: "Decenas de puntos de contacto.",
    },
  },

  allies: {
    eyebrow: "Comunidad de marcas",
    title: "Nuestros Aliados",
    lead: "Marcas y plataformas que ya forman parte del ecosistema y acompañan la experiencia.",
    ctaNote: "Tu empresa también puede sumarse como Aliado Fundador.",
    logos: [
      {
        name: "Info Spot",
        src: "/images/formar-parte/allies/infospot.png",
        scale: "xl" as const,
      },
      {
        name: "ComprameLaFoto",
        src: "/images/formar-parte/allies/compramelafoto.png",
        scale: "xl" as const,
      },
      {
        name: "Fotoffice",
        src: "/images/formar-parte/allies/fotoffice.png",
        scale: "xl" as const,
      },
      {
        name: "FotoRank",
        src: "/images/formar-parte/allies/fotorank.png",
        scale: "xl" as const,
      },
      {
        name: "COPY express",
        src: "/images/formar-parte/allies/copy-express.png",
        scale: "xl" as const,
      },
      {
        name: "DVV",
        src: "/images/formar-parte/allies/dvv.png",
        scale: "xl" as const,
      },
      {
        name: "Mucha Escuela",
        src: "/images/formar-parte/allies/mucha-escuela.png",
        scale: "xl" as const,
      },
    ],
  },

  levels: {
    eyebrow: "Formas de acompañar",
    title: "Elegí cómo querés formar parte",
    lead: "Cada alianza ofrece distintos niveles de participación y visibilidad dentro de la experiencia Clickatón.",
    scrollHint: "Deslizá para comparar los niveles →",
    legend: [
      { symbol: "check" as const, label: "Disponible" },
      { symbol: "dash" as const, label: "No incluido" },
      { symbol: "star" as const, label: "Destacado" },
    ],
    tiers: [
      {
        id: "colaborador" as const,
        metal: "bronze" as const,
        metalLabel: "Bronze",
        name: "Aliado Colaborador",
        highlight: false,
      },
      {
        id: "oficial" as const,
        metal: "silver" as const,
        metalLabel: "Silver",
        name: "Aliado Oficial",
        highlight: false,
      },
      {
        id: "fundador" as const,
        metal: "gold" as const,
        metalLabel: "Gold",
        name: "Aliado Fundador",
        highlight: true,
        badge: "Mayor visibilidad",
      },
    ],
    /** Disponibilidad por nivel — sin cantidades ni precios. */
    rows: [
      {
        benefit: "Presencia en la web oficial",
        colaborador: "yes" as const,
        oficial: "yes" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Logo en página de aliados",
        colaborador: "yes" as const,
        oficial: "yes" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Logo en página de la maratón",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Presencia en redes sociales",
        colaborador: "yes" as const,
        oficial: "yes" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Menciones durante la campaña",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Presencia en newsletter",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Logo en cartelería del evento",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Logo en banners",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Logo en escenario",
        colaborador: "no" as const,
        oficial: "no" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Logo en arco de largada",
        colaborador: "no" as const,
        oficial: "no" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Logo en photocall",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Logo en credenciales",
        colaborador: "no" as const,
        oficial: "no" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Logo en lanyards",
        colaborador: "no" as const,
        oficial: "no" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Logo en pulseras",
        colaborador: "no" as const,
        oficial: "no" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Logo en mapa del evento",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Logo en kit de bienvenida",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Logo en bolsa ecológica",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Logo en agenda oficial",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Logo en botella térmica",
        colaborador: "no" as const,
        oficial: "no" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Logo en remera oficial (espalda)",
        colaborador: "no" as const,
        oficial: "no" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Stand institucional",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Entrega de productos promocionales",
        colaborador: "yes" as const,
        oficial: "yes" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Entrega de merchandising propio",
        colaborador: "yes" as const,
        oficial: "yes" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Espacio para activaciones",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Posibilidad de brindar premios",
        colaborador: "yes" as const,
        oficial: "yes" as const,
        fundador: "yes" as const,
      },
      {
        benefit: "Presencia durante la premiación",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Reconocimiento como Aliado Fundador",
        colaborador: "no" as const,
        oficial: "no" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Prioridad para futuras ediciones",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Exclusividad por rubro (si corresponde)",
        colaborador: "no" as const,
        oficial: "no" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Participación en acciones especiales",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "star" as const,
      },
      {
        benefit: "Acceso anticipado a futuras convocatorias",
        colaborador: "no" as const,
        oficial: "yes" as const,
        fundador: "star" as const,
      },
    ],
  },

  faq: {
    eyebrow: "FAQ",
    title: "Preguntas frecuentes",
    items: [
      {
        question: "¿Puedo acompañar una sola ciudad?",
        answer:
          "Sí. Podés acompañar una sede específica o conversar una presencia en varias ciudades según objetivos y capacidad.",
      },
      {
        question: "¿Puedo aportar productos?",
        answer:
          "Sí. Productos, kits, insumos o experiencias para participantes son formas valiosas de acompañar Clickatón.",
      },
      {
        question: "¿Puedo regalar premios?",
        answer:
          "Sí. Los premios y reconocimientos pueden integrarse a la premiación o a momentos especiales de la edición.",
      },
      {
        question: "¿Puedo tener un stand?",
        answer:
          "Sí. El espacio de encuentro permite stands institucionales para conversar con la comunidad durante la acreditación y la jornada.",
      },
      {
        question: "¿Hay exclusividad por rubro?",
        answer:
          "Puede conversarse según el rubro y la edición. No hay un esquema cerrado: cada alianza se diseña con criterio y coherencia.",
      },
      {
        question: "¿Cómo funciona el merchandising?",
        answer:
          "El merchandising forma parte de la experiencia del participante. Las integraciones de marca se definen en conjunto, respetando la identidad de Clickatón.",
      },
    ],
  },

  final: {
    line1: "Las mejores fotografías empiezan con un clic.",
    line2: "Las mejores alianzas también.",
    cta: {
      label: "Quiero formar parte de Clickatón",
      href: `${routes.contact}?motivo=formar-parte#formulario`,
    },
  },
} as const;

export type FormarParteIconId =
  (typeof formarParteContent.why.cards)[number]["icon"];
