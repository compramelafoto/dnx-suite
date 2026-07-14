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
    primaryCta: { label: "Conocé cómo funciona", href: "#como-funciona" } satisfies HomeLink,
    secondaryCta: { label: "Próximas maratones", href: "#proximas" } satisfies HomeLink,
  },

  whatIs: {
    id: "que-es",
    eyebrow: "Qué es",
    title: "Clickaton es una experiencia fotográfica.",
    lead: "La maratón es el formato. El crecimiento de la mirada y la creación de comunidad son el propósito.",
    paragraphs: [
      "Es una maratón fotográfica: durante un período delimitado, salís a recorrer un territorio con consignas que despiertan la observación.",
      "La jornada invita a mirar, crear y entregar fotografías. También es un espacio de encuentro, intercambio y aprendizaje entre personas de distintos niveles.",
      "Cada edición define su duración, recorrido, consignas y modalidad. Las reglas específicas se publican en las bases de esa Clickaton.",
    ],
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
    lead: "Este es el flujo conceptual de una Clickaton. La inscripción y la carga real se activarán cuando exista la integración con FotoRank.",
    note: "Explicación conceptual — sin formularios ni pagos en esta etapa.",
    steps: [
      {
        title: "Elegís una Clickaton",
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
    note: "Las fechas se van a comunicar por los canales oficiales de Clickaton. No publicamos sedes, cupos ni precios inventados.",
    cta: { label: "Ver próximas maratones", href: "#proximas" } satisfies HomeLink,
  },

  learning: {
    id: "aprender",
    eyebrow: "Pedagogía",
    title: "Aprender mientras participás.",
    lead: "Clickaton no se limita a competir. Busca construir progresivamente un espacio pedagógico alrededor de cada experiencia.",
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
  },

  community: {
    id: "comunidad",
    eyebrow: "Comunidad",
    title: "Una red de miradas en movimiento.",
    lead: "Clickaton reúne a quienes salen a observar, crear y compartir: participantes, fotógrafos, jurados, docentes, clubes, asociaciones, organizadores y ciudades.",
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
      href: "#proximas",
      note: "Próximamente — sin formulario activo todavía.",
    },
  },

  venues: {
    id: "organiza",
    eyebrow: "Sedes",
    title: "Organizá una Clickaton.",
    lead: "Proyectamos una red de sedes con una metodología y una identidad compartidas.",
    body: "En el futuro, distintas ciudades podrán postularse para organizar una edición oficial con acompañamiento, herramientas y lineamientos comunes.",
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
      label: "Quiero conocer el programa de sedes",
      href: "#organiza",
      note: "Próximamente — información y contacto sin formulario persistente en esta etapa.",
    },
  },

  partnerships: {
    id: "sponsors",
    eyebrow: "Alianzas",
    title: "Sponsors y alianzas.",
    lead: "Estamos construyendo las primeras alianzas de Clickaton.",
    body: "Buscamos acompañamiento de marcas e instituciones que quieran potenciar la fotografía, la creatividad y la comunidad.",
    categories: [
      "Marcas fotográficas",
      "Impresión",
      "Tecnología",
      "Educación",
      "Turismo",
      "Cultura",
      "Medios",
      "Instituciones",
    ],
    cta: {
      label: "Quiero acompañar el proyecto",
      href: "#sponsors",
      note: "Próximamente — sin planes comerciales ni logos inventados.",
    },
  },

  manifesto: {
    id: "manifiesto",
    eyebrow: "Manifiesto",
    lines: [
      "No importa solamente la cámara que llevás.",
      "Importa cómo mirás.",
    ],
    body: "Cada ciudad guarda historias, luces, gestos y detalles que suelen pasar desapercibidos. Clickaton es una invitación a salir, observar, crear y compartir esas miradas con otras personas.",
  },

  faq: {
    id: "faq",
    eyebrow: "Preguntas",
    title: "Preguntas frecuentes",
    items: [
      {
        question: "¿Necesito ser fotógrafo profesional?",
        answer:
          "No. Clickaton está pensado para distintos niveles. Cada edición podrá definir categorías o modalidades específicas en sus bases.",
      },
      {
        question: "¿Puedo participar con celular?",
        answer:
          "Depende de cada edición. Los dispositivos habilitados se van a indicar en las bases y condiciones de esa Clickaton.",
      },
      {
        question: "¿Todas las Clickaton funcionan igual?",
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
          "Las fechas se anunciarán mediante los canales oficiales de Clickaton. Todavía no publicamos un calendario inventado.",
      },
      {
        question: "¿Puede mi ciudad organizar una edición?",
        answer:
          "Esa es la dirección del proyecto. El programa de sedes se presentará cuando esté listo el acompañamiento y los lineamientos comunes.",
      },
    ],
  },

  finalCta: {
    id: "cta-final",
    title: "La primera Clickaton empieza mucho antes del disparo.",
    body: "Empieza cuando una comunidad decide salir a mirar su ciudad de otra manera.",
    primaryCta: { label: "Conocé las próximas novedades", href: "#proximas" } satisfies HomeLink,
    secondaryCta: { label: "Explorá cómo funciona", href: "#como-funciona" } satisfies HomeLink,
    note: "Sin newsletter ficticia ni captura de correos en esta etapa.",
  },
} as const;

export type HomeContent = typeof homeContent;
