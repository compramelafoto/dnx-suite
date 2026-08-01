import { routes } from "@/config/navigation";

/**
 * Contenido editorial de la Home MVP de lanzamiento.
 * Centralizado para revisión y futura migración a CMS / FotoRank.
 */

export type HomeLink = {
  label: string;
  href: string;
};

export const homeContent = {
  hero: {
    id: "inicio",
    eyebrow: "Maratón Fotográfica Internacional",
    title: "Salí a buscar el instante.",
    description:
      "Una experiencia que transforma la ciudad en escenario y cada consigna en una oportunidad para crear, aprender y compartir.",
    tagline: "Fotografía + creatividad + comunidad",
    primaryCta: { label: "Conocé cómo funciona", href: routes.howItWorks } satisfies HomeLink,
    secondaryCta: { label: "Próximas maratones", href: routes.marathons } satisfies HomeLink,
  },

  whatIs: {
    id: "que-es",
    eyebrow: "Qué es",
    title: "Clickatón es una experiencia fotográfica.",
    lead: "La maratón es el formato. El crecimiento de la mirada y la creación de comunidad son el propósito.",
    paragraphs: [
      "Es una maratón fotográfica: durante un período delimitado, salís a recorrer un territorio con consignas que despiertan la observación.",
      "La jornada invita a mirar, crear y entregar fotografías. También es un espacio de encuentro, intercambio y aprendizaje entre personas de distintos niveles.",
      "Cada edición define su duración, recorrido, consignas y modalidad. Las reglas específicas se publican en las bases de esa Clickatón.",
    ],
    image: {
      src: "/images/home/what-is-community.jpg",
      alt: "Comunidad de fotógrafos con remeras Clickatón fotografiando en la ciudad",
      caption: "Competencia, aprendizaje y comunidad en movimiento.",
    },
  },

  pillars: {
    id: "pilares",
    eyebrow: "Pilares",
    title: "Cuatro ideas que sostienen cada edición.",
    items: [
      {
        title: "Fotografía como aventura",
        body: "Salís con una misión creativa y volvés con una mirada distinta sobre lo cotidiano.",
      },
      {
        title: "El tiempo como desafío",
        body: "El reloj ordena la experiencia: cada decisión cuenta y cada instante puede convertirse en una historia.",
      },
      {
        title: "La ciudad como escenario",
        body: "Calles, luces, gestos y detalles se transforman en el territorio creativo de la jornada.",
      },
      {
        title: "La comunidad como protagonista",
        body: "Participás junto a otras personas que también quieren mirar mejor, crear y compartir.",
      },
    ],
  },

  howItWorks: {
    id: "como-funciona",
    eyebrow: "Cómo funciona",
    title: "Un recorrido claro, una experiencia intensa.",
    lead: "Este es el flujo conceptual de una Clickatón. La inscripción y la carga real se activarán cuando exista la integración con FotoRank.",
    note: "Explicación conceptual — sin formularios ni pagos en esta etapa.",
    steps: [
      {
        title: "Elegís una Clickatón",
        body: "Conocés la edición, su territorio y la propuesta creativa de esa jornada.",
      },
      {
        title: "Te inscribís",
        body: "Cuando abramos inscripciones, vas a poder sumarte según las bases de cada edición.",
      },
      {
        title: "Recibís las consignas",
        body: "Las consignas guían tu mirada y te desafían a probar nuevas formas de observar.",
      },
      {
        title: "Salís a fotografiar",
        body: "Recorrés, buscás y decidís. La ciudad se convierte en tu escenario.",
      },
      {
        title: "Subís tus imágenes",
        body: "Entregás tus fotografías para formar parte de la experiencia y la evaluación.",
      },
      {
        title: "Compartís, aprendés y descubrís",
        body: "Los resultados, el intercambio y la comunidad cierran el ciclo de la edición.",
      },
    ],
  },

  upcoming: {
    id: "proximas",
    eyebrow: "Agenda",
    title: "Próximas maratones",
    status: "Próximamente",
    message: "Próximamente anunciaremos las primeras ciudades y fechas.",
    note: "Las fechas se van a comunicar por los canales oficiales de Clickatón. No publicamos sedes, cupos ni precios inventados.",
    cta: { label: "Ver próximas maratones", href: routes.marathons } satisfies HomeLink,
  },

  /** Novedades del banner superior (además de ediciones publicadas). */
  spotlightNews: [
    {
      id: "news-how",
      eyebrow: "Novedad",
      title: "Así funciona una Clickatón",
      description:
        "Consignas, tiempos y recorrido: un mapa claro para vivir la maratón fotográfica.",
      href: routes.howItWorks,
      ctaLabel: "Cómo funciona",
    },
    {
      id: "news-community",
      eyebrow: "Comunidad",
      title: "Formá parte desde el comienzo",
      description:
        "Participantes, jurados, clubes y ciudades: la red de miradas que hace posible cada edición.",
      href: routes.community,
      ctaLabel: "Sumate",
    },
  ] as const,

  learning: {
    id: "aprender",
    eyebrow: "Pedagogía",
    title: "Aprender mientras participás.",
    lead: "Clickatón no se limita a competir. Busca construir progresivamente un espacio pedagógico alrededor de cada experiencia.",
    points: [
      {
        title: "Consignas que abren la mirada",
        body: "Cada consigna invita a probar nuevas formas de observar y contar lo que pasa a tu alrededor.",
      },
      {
        title: "Crecimiento compartido",
        body: "Fotógrafos de distintos niveles pueden practicar, intercambiar y aprender juntos.",
      },
      {
        title: "Más que el equipo",
        body: "La cámara importa, pero la práctica, la observación y el intercambio ayudan a crecer.",
      },
      {
        title: "Contenidos en construcción",
        body: "Cada edición podrá incorporar, de a poco, herramientas, contenidos y espacios de devolución.",
      },
    ],
    disclaimer:
      "No prometemos todavía cursos, mentorías, certificados ni talleres incluidos. La dimensión pedagógica crecerá con el proyecto.",
    image: {
      src: "/images/home/what-is-community.jpg",
      alt: "Participantes con remeras Clickatón compartiendo la experiencia fotográfica",
    },
  },

  community: {
    id: "comunidad",
    eyebrow: "Comunidad",
    title: "Una red de miradas en movimiento.",
    lead: "Clickatón reúne a quienes salen a observar, crear y compartir: participantes, fotógrafos, jurados, docentes, clubes, asociaciones, organizadores y ciudades.",
    roles: [
      "Participantes",
      "Fotógrafos",
      "Jurados",
      "Docentes",
      "Clubes",
      "Asociaciones",
      "Organizadores",
      "Ciudades",
    ],
    cta: {
      label: "Formá parte desde el comienzo",
      href: routes.community,
      note: "Próximamente — sin formulario activo todavía.",
    },
    images: {
      portrait: {
        src: "/images/formar-parte/imagen-01.png",
        alt: "Fotógrafa en recorrido urbano",
      },
      detail: {
        src: "/images/founding-allies/kit.jpg",
        alt: "Kit y materiales de la experiencia Clickatón",
      },
      group: {
        src: "/images/founding-allies/stand.jpg",
        alt: "Stand y expo de marcas Clickatón",
      },
    },
  },

  venues: {
    id: "organiza",
    eyebrow: "Sedes",
    title: "Llevá Clickatón a tu ciudad.",
    lead: "Convertite en Organizador Oficial de Sede y hacé posible la maratón fotográfica en tu territorio.",
    body: "Recibís capacitación, infraestructura, marca y acompañamiento. No es un empleo: es representar a Clickatón en tu ciudad.",
    audience: [
      "Clubes fotográficos",
      "Asociaciones",
      "Instituciones",
      "Municipios",
      "Universidades",
      "Organizadores culturales",
      "Referentes comunitarios",
    ],
    cta: {
      label: "Quiero ser Organizador",
      href: routes.organize,
      note: "Postulate como Organizador Oficial de Sede.",
    },
    image: {
      src: "/images/organizar-sede/hero.jpg",
      alt: "Encuentro de sede local de maratón fotográfica",
      caption: "Sedes, kits y comunidad local.",
    },
  },

  partnerships: {
    id: "aliados",
    eyebrow: "Aliados Fundadores",
    title: "Formá parte de esta historia.",
    lead: "Las mejores experiencias se construyen entre muchos.",
    body: "Buscamos marcas e instituciones que quieran escribir el primer capítulo de Clickatón — con pertenencia, no con publicidad.",
    categories: [
      "Fotografía",
      "Creatividad",
      "Comunidad",
      "Ciudad",
      "Cultura",
      "Aprendizaje",
      "Encuentro",
      "Expo de marcas",
    ],
    cta: {
      label: "Quiero formar parte",
      href: routes.joinUs,
      note: "Conocé cómo empresas e instituciones pueden acompañar Clickatón.",
    },
  },

  manifesto: {
    id: "manifiesto",
    eyebrow: "Manifiesto",
    lines: [
      "No importa solamente la cámara que llevás.",
      "Importa cómo mirás.",
    ],
    body: "Cada ciudad guarda historias, luces, gestos y detalles que suelen pasar desapercibidos. Clickatón es una invitación a salir, observar, crear y compartir esas miradas con otras personas.",
  },

  faq: {
    id: "faq",
    eyebrow: "Preguntas",
    title: "Preguntas frecuentes",
    items: [
      {
        question: "¿Necesito ser fotógrafo profesional?",
        answer:
          "No. Clickatón está pensado para distintos niveles. Cada edición podrá definir categorías o modalidades específicas en sus bases.",
      },
      {
        question: "¿Puedo participar con celular?",
        answer:
          "Depende de cada edición. Los dispositivos habilitados se van a indicar en las bases y condiciones de esa Clickatón.",
      },
      {
        question: "¿Todas las Clickatón funcionan igual?",
        answer:
          "Comparten una identidad y una metodología común, pero cada edición define duración, consignas, recorrido y modalidades propias.",
      },
      {
        question: "¿Cómo se conocen las consignas?",
        answer:
          "Las consignas forman parte de la experiencia de cada edición. El momento y el formato de liberación se comunicarán en las bases oficiales.",
      },
      {
        question: "¿Las fotografías son evaluadas?",
        answer:
          "Sí. La evaluación forma parte del recorrido. Los criterios y el proceso del jurado se publicarán por edición.",
      },
      {
        question: "¿Dónde se anuncian las próximas fechas?",
        answer:
          "Las fechas se anunciarán mediante los canales oficiales de Clickatón. Todavía no publicamos un calendario inventado.",
      },
      {
        question: "¿Puede mi ciudad organizar una edición?",
        answer:
          "Sí. Podés postularte como Organizador Oficial de Sede desde la página Llevá Clickatón a tu ciudad. Allí está el formulario y el detalle del programa.",
      },
    ],
  },

  finalCta: {
    id: "cta-final",
    title: "La primera Clickatón empieza mucho antes del disparo.",
    body: "Empieza cuando una comunidad decide salir a mirar su ciudad de otra manera.",
    primaryCta: { label: "Conocé las próximas novedades", href: routes.marathons } satisfies HomeLink,
    secondaryCta: { label: "Explorá cómo funciona", href: routes.howItWorks } satisfies HomeLink,
    note: "Sin newsletter ficticia ni captura de correos en esta etapa.",
    backgroundImage: {
      src: "/images/hero-city-photographer.jpg",
      alt: "",
    },
  },
} as const;

export type HomeContent = typeof homeContent;
