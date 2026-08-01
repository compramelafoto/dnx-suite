import { routes } from "@/config/navigation";

/**
 * Página institucional `/sobre` — Sobre Clickatón.
 * Contenido estático configurable (equipo, redes, CTAs).
 */

export const CLICKATON_INSTAGRAM = {
  handle: "@clickaton.ok",
  href: "https://www.instagram.com/clickaton.ok/",
} as const;

export const COMPRAME_LA_FOTO_URL = "https://compramelafoto.com";

export const DNX_INSTAGRAM = {
  handle: "@dnxfotografia",
  href: "https://www.instagram.com/dnxfotografia/",
} as const;

export type TeamMemberSocial = {
  handle: string;
  href: string;
};

export type TeamMemberData = {
  id: "tammy" | "rodrigo" | "daniel";
  name: string;
  specialties: string;
  bio: readonly string[];
  roleTitle: string;
  role: readonly string[];
  roleHighlight?: string;
  /** Remate destacado opcional al final del bloque de rol. */
  roleClosingHighlight?: string;
  /** Enlace opcional a CLF dentro de la bio (solo Dani). */
  clfMention?: { label: string; href: string };
  image: {
    src: string | null;
    alt: string;
    placeholderCode: string;
    placeholderLabel: string;
  };
  socials: readonly TeamMemberSocial[];
};

export const sobrePageContent = {
  meta: {
    title: "Sobre Clickatón | Maratón Fotográfica",
    description:
      "Conocé Clickatón, la maratón fotográfica nacida en Rosario que une fotografía, cultura, educación, tecnología y comunidad, con proyección nacional e internacional.",
  },

  hero: {
    title: "Una ciudad. Diez consignas. Miles de miradas.",
    subtitle: "Fotografía, cultura, educación, tecnología y comunidad.",
    lead: "Clickatón es una maratón fotográfica que transforma la ciudad en un gran escenario creativo.",
    body: "Durante una jornada, fotógrafos, estudiantes, aficionados y amantes de la imagen reciben una serie de consignas que los invitan a recorrer, observar, interpretar y fotografiar su entorno desde una mirada propia.",
    image: {
      src: "/images/hero-city-photographer.jpg",
      alt: "Fotógrafo en la ciudad durante una jornada creativa",
    },
  },

  whatIs: {
    title: "¿Qué es Clickatón?",
    paragraphs: [
      "Clickatón es una experiencia fotográfica presencial apoyada por una plataforma tecnológica que permite desarrollar una maratón de fotografía de manera organizada, transparente y dinámica.",
      "Los participantes se acreditan, reciben las consignas en un horario determinado y comienzan a recorrer la ciudad buscando sus propias respuestas visuales.",
      "Cada consigna es una invitación a mirar.",
      "Una misma palabra, concepto o desafío puede generar cientos de interpretaciones completamente diferentes.",
    ],
    highlightLead: "Ahí está una de las principales ideas de Clickatón:",
    highlight:
      "descubrir cuántas historias distintas pueden surgir cuando muchas personas observan una misma ciudad al mismo tiempo.",
    backdrop: "/images/home/what-is-community.jpg",
  },

  origin: {
    title: "¿Cómo nace Clickatón?",
    intro: "Clickatón nace del encuentro de tres mundos que forman parte de nuestro trabajo cotidiano:",
    pillars: ["la fotografía", "la educación", "la tecnología"],
    paragraphs: [
      "La idea surge de imaginar una experiencia capaz de sacar la fotografía de los espacios tradicionales y llevarla directamente a las calles.",
      "Una actividad donde no importe solamente quién realiza la mejor fotografía, sino todo lo que sucede durante el recorrido:",
    ],
    actions: [
      "observar",
      "caminar",
      "descubrir",
      "interpretar",
      "aprender",
      "compartir",
      "crear",
    ],
    closing: [
      "Queremos que cada edición pueda convertirse también en una fotografía colectiva de un determinado lugar y momento.",
      "Las imágenes producidas por cientos de participantes pueden terminar construyendo, entre todas, una enorme memoria visual de cada ciudad.",
    ],
  },

  vision: {
    title: "Nuestra visión",
    intro: "Uno de los grandes objetivos de Clickatón es acercar la fotografía a nuevos públicos y convertirla en una herramienta de:",
    tools: ["expresión", "educación", "integración", "construcción cultural"],
    bondsLead: "Queremos generar vínculos con:",
    bonds: [
      "colegios y escuelas",
      "instituciones educativas",
      "universidades",
      "escuelas de fotografía",
      "centros culturales",
      "municipios",
      "organizaciones sociales",
      "espacios vinculados al arte y la cultura",
    ],
    paragraphs: [
      "Imaginamos Clickatón como una plataforma capaz de generar experiencias fotográficas educativas adaptadas a diferentes edades y contextos.",
      "La fotografía permite trabajar creatividad, observación, identidad, patrimonio, comunicación, historia y territorio.",
      "Por eso buscamos que cada nueva sede no sea solamente una competencia, sino también una oportunidad para poner en valor la cultura local y la identidad de cada comunidad.",
    ],
    note: "Estas alianzas forman parte de nuestra visión y líneas de trabajo; no representan acuerdos ya confirmados.",
    backdrop: "/images/organizar-sede/hero.jpg",
  },

  expansion: {
    title: "De Rosario a todo el país",
    paragraphs: [
      {
        text: "Clickatón nace en Rosario, Santa Fe, pero desde su origen fue pensado como un proyecto capaz de crecer mucho más allá de una única ciudad.",
        bold: ["Rosario, Santa Fe"],
      },
      {
        text: "Nuestra proyección es construir una red de sedes Clickatón en diferentes ciudades de Argentina, generando una comunidad conectada de fotógrafos, estudiantes, aficionados, instituciones, escuelas, comercios, marcas y organizaciones vinculadas a la fotografía y la cultura.",
        bold: ["red de sedes Clickatón en diferentes ciudades de Argentina"],
      },
      {
        text: "Cada ciudad podrá convertirse en una Ciudad Sede Clickatón, con un equipo local encargado de acompañar la organización y adaptar la experiencia a la identidad, los espacios y la realidad cultural de su comunidad.",
        bold: ["Ciudad Sede Clickatón"],
      },
      {
        text: "La intención no es simplemente repetir el mismo evento en distintos lugares.",
        bold: [],
      },
      {
        text: "Queremos que cada sede tenga identidad propia.",
        bold: [],
      },
    ],
    discoverLead: "Que las consignas permitan descubrir:",
    discover: [
      "arquitectura",
      "gente",
      "costumbres",
      "paisajes",
      "historias",
      "identidad local",
    ],
    closing:
      "Y que, edición tras edición, Clickatón pueda generar un enorme registro fotográfico colectivo de las ciudades de nuestro país.",
    federal: {
      title: "Una red federal de fotógrafos",
      paragraphs: [
        "Uno de nuestros principales objetivos es integrar a fotógrafos de todo el territorio argentino.",
        "Imaginamos ediciones realizadas simultánea o progresivamente en diferentes ciudades, conectadas mediante una misma plataforma y una misma comunidad.",
        "Rosario puede ser el punto de partida.",
        "Pero queremos que Clickatón llegue progresivamente a ciudades de todo el país.",
        "La conformación de sedes permitirá además generar nuevos referentes locales y construir alianzas con:",
      ],
      alliances: [
        "instituciones educativas",
        "municipios",
        "espacios culturales",
        "fotógrafos",
        "comercios",
        "empresas",
        "organizaciones de cada región",
      ],
      closing:
        "Así, Clickatón puede convertirse en un gran punto de encuentro nacional para la fotografía.",
    },
    international: {
      title: "El próximo paso: Clickatón Internacional",
      paragraphs: [
        "Nuestra visión no termina en Argentina.",
        "A medida que el proyecto consolide sus primeras ediciones y su red nacional de sedes, queremos comenzar una nueva etapa:",
      ],
      highlight: "convertir Clickatón en una maratón fotográfica internacional.",
      body: [
        "Imaginamos ciudades de diferentes países participando bajo una misma dinámica.",
        "Miles de personas fotografiando durante una misma jornada.",
        "Una misma consigna interpretada desde culturas, paisajes y realidades completamente diferentes.",
        "La tecnología permite pensar Clickatón sin fronteras.",
        "Las consignas pueden liberarse desde la plataforma, las fotografías pueden validarse digitalmente y los jurados pueden evaluar las obras de manera online desde cualquier parte del mundo.",
        "Pero detrás de esa tecnología queremos conservar siempre la esencia del proyecto:",
      ],
      essence: "salir a la calle, observar nuestro entorno y contar una historia a través de una fotografía.",
      trajectory: ["ROSARIO", "ARGENTINA", "LATINOAMÉRICA", "INTERNACIONAL"],
      trajectoryNote: "Visión y proyección futura — no sedes confirmadas ni fechas asociadas.",
      remate: "Primero Rosario. Después Argentina. Y luego, el mundo.",
    },
    backdrop: "/images/formar-parte/hero.png",
  },

  experience: {
    title: "La experiencia Clickatón",
    lead: "Una jornada pensada para recorrer, crear y compartir — de la acreditación a la premiación.",
    steps: [
      {
        title: "Acreditación",
        body: "La jornada comienza varias horas antes de la maratón. Los participantes reciben su acreditación, información del evento e indicaciones, y se encuentran con la comunidad Clickatón.",
      },
      {
        title: "Charlas + Expo",
        body: "Espacio abierto a charlas, capacitaciones, presentaciones, demostraciones e intercambio. Las sedes pueden sumar una Expo Clickatón con stands del sector.",
      },
      {
        title: "Liberación de consignas",
        body: "A la hora establecida (en Argentina 2026: desde las 16:00), la plataforma habilita las consignas. Hasta ese momento permanecen ocultas.",
      },
      {
        title: "Maratón · captura",
        body: "Cada participante interpreta las consignas dentro de la ventana válida de captura (en Argentina 2026: 16:00–20:00). La hora de subida no valida la captura.",
      },
      {
        title: "Carga",
        body: "La plataforma puede permanecer abierta más allá del cierre de captura para seleccionar, revelar y subir (en Argentina 2026: hasta las 22:00).",
      },
      {
        title: "Validación",
        body: "Herramientas tecnológicas —como el análisis de metadatos EXIF— ayudan a verificar que las imágenes se hayan capturado dentro de la ventana válida.",
      },
      {
        title: "Jurado",
        body: "Los jurados evalúan online las obras mediante la infraestructura de Clickatón y FotoRank, centralizando fotografías, puntajes y resultados.",
      },
      {
        title: "Premiación",
        body: "Uno de los momentos centrales de cada encuentro: se destacan finalistas y ganadores de la edición.",
      },
    ],
  },

  expo: {
    title: "Charlas + Expo Clickatón",
    paragraphs: [
      "Durante las horas previas a la maratón pueden realizarse charlas, presentaciones, demostraciones y actividades relacionadas con fotografía, creatividad, tecnología y producción audiovisual.",
      "Cada sede puede contar además con una Expo Clickatón, donde marcas, comercios, laboratorios, escuelas, instituciones y empresas vinculadas al sector puedan presentar sus productos y servicios mediante stands.",
      "De esta manera, fotógrafos, participantes, instituciones y marcas comparten un mismo espacio antes de comenzar la competencia.",
    ],
    highlights: [
      "charlas",
      "capacitaciones",
      "presentaciones",
      "demostraciones",
      "actividades",
      "intercambio entre fotógrafos",
      "presentación de productos y servicios",
    ],
  },

  marathon: {
    title: "¿Cómo funciona la maratón?",
    paragraphs: [
      "A la hora establecida comienza oficialmente Clickatón.",
      "Desde nuestra plataforma se habilitan simultáneamente las consignas de la competencia.",
      "Hasta ese momento permanecen ocultas.",
      "Cada participante puede acceder desde su teléfono a las consignas y comenzar su recorrido.",
      "A partir de ahí comienza el verdadero desafío:",
    ],
    highlight: "interpretar cada consigna y transformarla en una fotografía.",
    closing:
      "En Argentina 2026: captura válida 16:00–20:00; carga habilitada 16:00–22:00. Verificá la fecha y hora de tu cámara antes de empezar.",
  },

  technology: {
    title: "Tecnología al servicio de la transparencia",
    paragraphs: [
      "Cuando cada participante carga sus fotografías, nuestra plataforma puede analizar la información técnica almacenada dentro de los archivos de imagen.",
      "Estos metadatos permiten, entre otras validaciones, comprobar que una fotografía haya sido capturada dentro de la ventana válida (no según la hora de subida).",
      "Esto permite sumar herramientas tecnológicas que ayuden a garantizar una competencia más ordenada, verificable y transparente.",
    ],
    note: "Son herramientas de validación y transparencia: no afirman una garantía absoluta contra todo tipo de fraude ni corrección automática de reloj de cámara.",
  },

  jury: {
    title: "Jurado y calificación",
    paragraphs: [
      "La evaluación se realiza mediante la infraestructura tecnológica de Clickatón y FotoRank.",
      "Los jurados pueden acceder de manera online a las fotografías correspondientes a las categorías o consignas que deben evaluar.",
      "El sistema permite centralizar:",
    ],
    centralizes: [
      "fotografías",
      "participantes",
      "consignas",
      "evaluaciones",
      "puntajes",
      "resultados",
    ],
    closing: [
      "A partir de las evaluaciones se determinan las fotografías destacadas, finalistas y ganadoras de cada edición.",
      "Posteriormente llega uno de los momentos centrales de cada encuentro:",
    ],
    highlight: "la premiación Clickatón.",
  },

  moreThan: {
    title: "Mucho más que una competencia",
    paragraphs: [
      "Sí, Clickatón tiene ganadores.",
      "Sí, hay desafíos.",
      "Sí, hay premios.",
      "Pero creemos que el verdadero valor del proyecto está en todo lo que ocurre alrededor de la competencia.",
      "Una persona puede participar para ganar.",
      "Otra puede participar para aprender.",
      "Otra para conocer gente.",
      "Otra simplemente para ponerse el desafío de salir a fotografiar.",
      "Un estudiante puede descubrir por primera vez la fotografía.",
      "Un fotógrafo profesional puede encontrarse frente a una consigna que lo obligue a mirar de otra manera.",
      "Y cientos de personas pueden recorrer simultáneamente una misma ciudad descubriendo lugares, historias y situaciones que normalmente pasarían inadvertidas.",
    ],
    highlight: "Competimos, aprendemos, recorremos, observamos y creamos juntos.",
    remate: "Eso es Clickatón.",
    backdrop: "/images/home/what-is-community.jpg",
  },

  team: {
    title: "Nuestro equipo",
    lead: "Las personas detrás del proyecto: fotografía, educación, gestión y tecnología al servicio de cada edición y de cada sede.",
    members: [
      {
        id: "tammy",
        name: "Tammy Tamer",
        specialties: "Fotógrafa · Docente · Diseñadora · Creadora de contenido",
        bio: [
          "Tammy Tamer es fotógrafa profesional, docente de fotografía, diseñadora, creadora de contenido e instructora de yoga.",
          "Su experiencia vinculada a la enseñanza, la creatividad y el trabajo con personas es una de las bases sobre las que se construye Clickatón.",
        ],
        roleTitle: "Rol dentro de Clickatón",
        role: [
          "Tammy es ideadora del proyecto y responsable de gran parte de su identidad creativa y pedagógica.",
          "Trabaja especialmente sobre la experiencia que viven los participantes, las dinámicas educativas, las consignas, los contenidos y la manera en que Clickatón puede vincular fotografía, aprendizaje y creatividad.",
          "Su mirada busca que cada edición pueda ser entretenida y competitiva, pero que al mismo tiempo deje una experiencia de aprendizaje.",
        ],
        roleHighlight: "ideadora del proyecto",
        image: {
          src: "/images/sobre/team/tammy-tamer.jpg",
          alt: "Retrato de Tammy Tamer",
          placeholderCode: "FOTO TAMMY",
          placeholderLabel: "Foto oficial de Tammy Tamer",
        },
        socials: [
          {
            handle: "@tammy_tamer",
            href: "https://www.instagram.com/tammy_tamer/",
          },
        ],
      },
      {
        id: "rodrigo",
        name: "Rodrigo Rincón",
        specialties:
          "Fotógrafo · Periodista deportivo · Técnico Superior y Guía de Turismo · Diseñador Web",
        bio: [
          "Rodrigo Rincón desarrolla su actividad dentro de diferentes áreas de la fotografía, incluyendo fotografía deportiva, social y documental.",
          "Su formación como periodista deportivo y Técnico Superior y Guía de Turismo aporta además una mirada especialmente vinculada a la comunicación, los eventos, las personas y el territorio.",
        ],
        roleTitle: "Rol dentro de Clickatón",
        role: [
          "Rodri trabaja principalmente en las áreas de logística, gestión comercial, ventas y relaciones interinstitucionales.",
          "Su tarea es fundamental para conectar Clickatón con instituciones, empresas, sponsors, organizaciones y actores locales, además de participar en la planificación operativa de cada edición.",
        ],
        roleHighlight: "logística, gestión comercial, ventas y relaciones interinstitucionales",
        image: {
          src: "/images/sobre/team/rodrigo-rincon.jpg",
          alt: "Retrato de Rodrigo Rincón",
          placeholderCode: "FOTO RODRI",
          placeholderLabel: "Foto oficial de Rodrigo Rincón",
        },
        socials: [
          {
            handle: "@corner.foto",
            href: "https://www.instagram.com/corner.foto/",
          },
          {
            handle: "@corner.foto.doc",
            href: "https://www.instagram.com/corner.foto.doc/",
          },
        ],
      },
      {
        id: "daniel",
        name: "Daniel Cuart",
        specialties:
          "Fotógrafo profesional · Docente de fotografía · Técnico informático · Emprendedor tecnológico",
        bio: [
          "Daniel Cuart combina desde hace años la fotografía con la tecnología.",
          "Fotógrafo profesional y docente, desarrolla además proyectos digitales vinculados a fotografía, eventos y automatización de procesos.",
          "Es creador de Cómprame la Foto — CLF, una plataforma tecnológica orientada a fotógrafos, organizadores y eventos que permite publicar, gestionar y comercializar contenido fotográfico.",
          "La experiencia desarrollando este tipo de plataformas es también una de las bases tecnológicas sobre las que se construye Clickatón.",
        ],
        clfMention: {
          label: "Cómprame la Foto — CLF",
          href: COMPRAME_LA_FOTO_URL,
        },
        roleTitle: "Rol dentro de Clickatón",
        role: [
          "Dani está a cargo principalmente del área de tecnología, desarrollo e implementación técnica.",
          "Su trabajo incluye el desarrollo de la plataforma de Clickatón, los sistemas de inscripción, acreditación, consignas, carga y validación de fotografías, integración con FotoRank, automatizaciones y soporte tecnológico durante cada edición.",
          "El objetivo es que la tecnología esté presente sin convertirse en protagonista:",
        ],
        roleHighlight: "tecnología, desarrollo e implementación técnica",
        roleClosingHighlight:
          "debe simplificar el evento, hacerlo escalable y ayudar a garantizar una experiencia clara para participantes, organizadores y jurados.",
        image: {
          src: "/images/sobre/team/daniel-cuart.jpg",
          alt: "Retrato de Daniel Cuart",
          placeholderCode: "FOTO DANI",
          placeholderLabel: "Foto oficial de Daniel Cuart",
        },
        socials: [DNX_INSTAGRAM],
      },
    ] satisfies readonly TeamMemberData[],
  },

  closing: {
    title: "Fotografía + Educación + Cultura + Tecnología",
    paragraphs: [
      "Estos cuatro conceptos resumen gran parte de lo que queremos construir.",
      "Queremos que Clickatón pueda recorrer diferentes ciudades.",
      "Que cada sede tenga su propia identidad.",
      "Que cada edición genere miles de fotografías.",
      "Que escuelas y estudiantes puedan participar.",
      "Que fotógrafos puedan conocerse.",
      "Que marcas e instituciones encuentren un espacio donde relacionarse con la comunidad.",
      "Y que las fotografías creadas durante cada edición se conviertan también en parte de la memoria visual de cada lugar.",
    ],
    highlights: [
      "Porque una ciudad puede recorrerse de muchas maneras.",
      "Nosotros elegimos hacerlo mirando.",
    ],
  },

  community: {
    title: "Sumate a la comunidad Clickatón",
    body: "Seguinos para conocer próximas ediciones, participantes, fotografías, actividades y novedades.",
    instagram: CLICKATON_INSTAGRAM,
    ctaLabel: "Seguir a Clickatón en Instagram",
    secondary: [
      { label: "Ver maratones", href: routes.marathons },
      { label: "Formá parte", href: routes.joinUs },
      { label: "Organizar una sede", href: routes.organize },
      { label: "Cómo funciona", href: routes.howItWorks },
    ],
  },

  finalPhrase: {
    lines: [
      "Una ciudad puede iniciar una historia.",
      "Muchas ciudades pueden construir un movimiento.",
    ],
    remate: "Nos encontramos en la próxima consigna.",
  },
} as const;

export type SobrePageContent = typeof sobrePageContent;
