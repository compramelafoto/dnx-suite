import { routes } from "@/config/navigation";

/**
 * Landing pública “Llevá Clickatón a tu ciudad”.
 * Convocatoria para Organizadores Oficiales de Sede.
 * Formulario: reutiliza ContactForm (motivo=organizar).
 */
export const organizarSedeContent = {
  meta: {
    title: "Convertite en Organizador Oficial | Clickatón",
    description:
      "Llevá la Maratón Fotográfica Internacional a tu ciudad. Organizá una sede oficial, generá ingresos, hacé crecer la comunidad fotográfica y convertite en referente local.",
  },

  hero: {
    title: "Llevá Clickatón a tu ciudad",
    subtitle:
      "Convertite en Organizador Oficial de la Maratón Fotográfica Internacional y hacé historia junto a cientos de fotógrafos.",
    cta: {
      label: "Quiero ser Organizador",
      href: "#formulario",
    },
    image: {
      src: "/images/organizar-sede/hero.jpg",
      alt: "Vista aérea de una ciudad con edificios de altura media, manzanas y tejados",
    },
  },

  about: {
    eyebrow: "El evento",
    title: "¿Qué es Clickatón?",
    body: "Clickatón es la Maratón Fotográfica Internacional: una experiencia colectiva donde fotógrafos de todos los niveles salen a recorrer la ciudad, capturar historias y compartir miradas. No es solo una competencia: es encuentro, cultura y comunidad en las calles.",
  },

  whatIs: {
    eyebrow: "El rol",
    title: "¿Qué es un Organizador Oficial?",
    paragraphs: [
      "No es un empleado. Es el representante oficial de Clickatón en su ciudad: la persona o equipo que hace posible la experiencia local.",
      "Serás quien organice la maratón fotográfica en tu territorio, utilizando toda la infraestructura, marca y metodología desarrolladas por Clickatón.",
      "No estás postulándote a un trabajo: estás asumiendo el liderazgo de un movimiento cultural en tu ciudad.",
    ],
    image: {
      code: "IMAGEN 01",
      label: "Acreditación",
      src: "/images/formar-parte/imagen-01.png",
      alt: "Mesa de acreditación Clickatón con credenciales, staff y material del evento",
    },
  },

  benefits: {
    eyebrow: "Por qué sumarte",
    title: "Beneficios",
    lead: "Más que producir un evento: construir comunidad, generar valor y dejar huella en tu ciudad.",
    cards: [
      {
        title: "Referente local",
        body: "Posicionate como referente de la fotografía en tu ciudad.",
        icon: "star" as const,
      },
      {
        title: "Ingresos por tu trabajo",
        body: "Generá ingresos por tu trabajo al frente de la sede.",
        icon: "wallet" as const,
      },
      {
        title: "Proyecto internacional",
        body: "Participá de un proyecto internacional con identidad compartida.",
        icon: "globe" as const,
      },
      {
        title: "Comunidad fotográfica",
        body: "Desarrollá tu comunidad fotográfica con cada edición.",
        icon: "users" as const,
      },
      {
        title: "Marca reconocida",
        body: "Organizá eventos con una marca reconocida y acompañamiento real.",
        icon: "brand" as const,
      },
      {
        title: "Experiencia única",
        body: "Viví una experiencia única: cultura, calles y cientos de miradas.",
        icon: "spark" as const,
      },
    ],
  },

  receive: {
    eyebrow: "Infraestructura",
    title: "Todo lo que recibís",
    lead: "Capacitación, herramientas y recursos para que organices con claridad y respaldo.",
    cards: [
      {
        title: "Capacitación gratuita",
        body: "Formación del equipo de Clickatón para liderar tu sede con criterio.",
        icon: "book" as const,
      },
      {
        title: "Asesoramiento completo",
        body: "Acompañamiento antes, durante y después del evento.",
        icon: "handshake" as const,
      },
      {
        title: "Sistema de gestión",
        body: "Acceso al sistema de gestión de la maratón.",
        icon: "grid" as const,
      },
      {
        title: "Información transparente",
        body: "Visibilidad clara de participantes e inscriptos.",
        icon: "eye" as const,
      },
      {
        title: "Plataforma de inscripciones",
        body: "Inscripciones completamente desarrolladas, listas para tu ciudad.",
        icon: "ticket" as const,
      },
      {
        title: "Acreditaciones",
        body: "Sistema de acreditaciones para el día del evento.",
        icon: "badge" as const,
      },
      {
        title: "Gestión de pagos",
        body: "Herramientas para administrar cobros e ingresos de la sede.",
        icon: "wallet" as const,
      },
      {
        title: "Ranking",
        body: "Competencia y resultados con ranking oficial.",
        icon: "trophy" as const,
      },
      {
        title: "Jurados",
        body: "Flujo de jurados integrado a la experiencia.",
        icon: "scale" as const,
      },
      {
        title: "Certificados",
        body: "Emisión de certificados para participantes.",
        icon: "certificate" as const,
      },
      {
        title: "QR de participantes",
        body: "Identificación y control con códigos QR.",
        icon: "qr" as const,
      },
      {
        title: "Manual operativo",
        body: "Manual operativo completo paso a paso.",
        icon: "book" as const,
      },
      {
        title: "Manual de Marca",
        body: "Acceso al Manual de Marca oficial de Clickatón.",
        icon: "palette" as const,
      },
      {
        title: "Recursos para redes",
        body: "Recursos gráficos listos para redes sociales.",
        icon: "share" as const,
      },
      {
        title: "Plantillas",
        body: "Plantillas para publicaciones y comunicación.",
        icon: "layout" as const,
      },
      {
        title: "Afiches y flyers",
        body: "Afiches, flyers y piezas para difusión local.",
        icon: "poster" as const,
      },
      {
        title: "Videos promocionales",
        body: "Material audiovisual para potenciar la convocatoria.",
        icon: "video" as const,
      },
      {
        title: "Material institucional",
        body: "Piezas institucionales para presentar Clickatón en tu ciudad.",
        icon: "folder" as const,
      },
    ],
  },

  economics: {
    eyebrow: "Modelo comercial",
    title: "Oportunidades económicas",
    lead: "El Organizador Oficial puede obtener ingresos a través de distintas vías alineadas al modelo de Clickatón.",
    items: [
      "Porcentaje de las inscripciones",
      "Sponsors locales",
      "Acciones comerciales",
      "Merchandising",
      "Futuras actividades relacionadas con Clickatón",
    ],
    note: "Posibilidad de sumar Sponsors locales y recibir la comisión correspondiente según el modelo comercial de Clickatón.",
    disclaimer: "Los porcentajes y condiciones se conversan en la etapa de postulación. No se publican cifras en esta página.",
  },

  who: {
    eyebrow: "Perfiles",
    title: "¿Quién puede organizar?",
    lead: "Si tenés ganas de liderar una experiencia cultural en tu ciudad, este llamado es para vos.",
    profiles: [
      "Fotógrafos",
      "Clubes",
      "Escuelas",
      "Instituciones",
      "Municipios",
      "Centros culturales",
      "Productores",
      "Emprendedores",
      "Asociaciones",
      "Universidades",
    ],
  },

  needs: {
    eyebrow: "Requisitos",
    title: "¿Qué necesitás?",
    lead: "Muy poco. Nosotros te capacitamos.",
    items: [
      { title: "Ganas", body: "La energía para hacer que tu ciudad viva Clickatón." },
      { title: "Compromiso", body: "Responsabilidad con la marca, la comunidad y la calidad." },
      { title: "Tiempo", body: "Disponibilidad para planificar y ejecutar con cuidado." },
      { title: "Trabajo en equipo", body: "Capacidad de sumar personas y coordinar." },
      { title: "Amor por la fotografía", body: "Pasión por el oficio y por compartir miradas." },
    ],
    highlight: "No necesitás experiencia previa. Nosotros te capacitamos.",
  },

  map: {
    eyebrow: "Red de sedes",
    title: "Tu ciudad puede ser la próxima",
    lead: "Una red de ciudades listas para vivir Clickatón — y un lugar esperándote a vos.",
    cities: [
      { name: "Salta" },
      { name: "Tucumán" },
      { name: "Córdoba" },
      { name: "Mendoza" },
      { name: "Rosario" },
      { name: "Buenos Aires" },
      { name: "Mar del Plata" },
      { name: "Bariloche" },
    ],
    highlight: {
      label: "TU CIUDAD AQUÍ",
    },
  },

  how: {
    eyebrow: "El camino",
    title: "Cómo funciona",
    lead: "De la postulación a la maratón: un recorrido claro, acompañado y con sentido.",
    steps: [
      {
        title: "Postulación",
        body: "Completás el formulario y nos contás por qué tu ciudad debería vivir Clickatón.",
      },
      {
        title: "Entrevista",
        body: "Conversamos sobre tu perfil, tu equipo y el potencial de tu territorio.",
      },
      {
        title: "Capacitación",
        body: "Te formamos con la metodología, la marca y las herramientas oficiales.",
      },
      {
        title: "Planificación",
        body: "Definimos fechas, producción local y el plan de difusión de la sede.",
      },
      {
        title: "Lanzamiento",
        body: "Abrimos la convocatoria y activamos la comunidad de tu ciudad.",
      },
      {
        title: "Maratón",
        body: "El día llega: acreditación, recorrido, experiencia y celebración.",
      },
      {
        title: "Resultados",
        body: "Ranking, certificados y el cierre que deja ganas de la próxima edición.",
      },
    ],
  },

  faq: {
    eyebrow: "FAQ",
    title: "Preguntas frecuentes",
    items: [
      {
        question: "¿Es un empleo o un cargo remunerado fijo?",
        answer:
          "No. Sos Organizador Oficial de Sede: representante de Clickatón en tu ciudad. No es un puesto de empleado; es un rol de liderazgo local con oportunidades económicas según el modelo comercial.",
      },
      {
        question: "¿Necesito experiencia previa organizando eventos?",
        answer:
          "No. Te capacitamos y te acompañamos con manuales, herramientas y asesoramiento. Lo esencial es compromiso, ganas y amor por la fotografía.",
      },
      {
        question: "¿Puedo organizar como club, escuela o institución?",
        answer:
          "Sí. Fotógrafos, clubes, escuelas, municipios, centros culturales, productores, asociaciones y universidades pueden postularse.",
      },
      {
        question: "¿Cómo genero ingresos como organizador?",
        answer:
          "Mediante porcentaje de inscripciones, sponsors locales, acciones comerciales, merchandising y actividades relacionadas. Los detalles se conversan en la postulación.",
      },
      {
        question: "¿Clickatón aporta la plataforma y la marca?",
        answer:
          "Sí. Recibís infraestructura: sistema de gestión, inscripciones, acreditaciones, pagos, ranking, jurados, certificados, QR, manuales y recursos gráficos.",
      },
      {
        question: "¿Cuánto tarda el proceso de postulación?",
        answer:
          "Depende de la conversación y de la preparación de cada sede. El camino típico es postulación → entrevista → capacitación → planificación.",
      },
      {
        question: "¿Hay exclusividad territorial?",
        answer:
          "Cada sede se evalúa con criterio. Las condiciones concretas se definen en la etapa de conversación con el equipo de Clickatón.",
      },
    ],
  },

  form: {
    eyebrow: "Postulación",
    title: "Postulate como Organizador Oficial",
    lead: "Completá el formulario. El motivo “Organizar una sede” queda preseleccionado para que el equipo te contacte con el contexto correcto.",
    note: "Nombre, email y mensaje son obligatorios. Usamos el mismo canal de contacto institucional de Clickatón.",
  },

  final: {
    title: "¿Querés que tu ciudad sea la próxima sede?",
    body: "Sumate al equipo de Organizadores Oficiales y llevemos juntos la fotografía a cada rincón del país.",
    cta: {
      label: "Quiero Postularme",
      href: "#formulario",
    },
  },

  /** CTA de contacto externo (fallback / nav secundaria). */
  contactHref: `${routes.contact}?motivo=organizar&source=organizar#formulario`,
} as const;

export type OrganizarSedeIconId =
  | (typeof organizarSedeContent.benefits.cards)[number]["icon"]
  | (typeof organizarSedeContent.receive.cards)[number]["icon"];
