/**
 * Contenido editorial provisional de la Home fundacional.
 */

export const homeContent = {
  hero: {
    eyebrow: "Maratón Fotográfica Internacional",
    title: "Salí a buscar el instante.",
    description:
      "Una experiencia fotográfica que combina creatividad, desafío, aprendizaje y comunidad.",
    primaryCta: { label: "Cómo funciona", href: "#como-funciona" },
    secondaryCta: {
      label: "Próximas maratones",
      href: "#proximas-maratones",
    },
  },
  concept: {
    id: "que-es",
    title: "Qué es Clickaton",
    lead: "La fotografía como aventura. El tiempo como desafío. La ciudad como escenario. La comunidad como protagonista.",
    pillars: [
      {
        title: "Fotografía como aventura",
        body: "Salís a la calle con una misión creativa y volvés con una mirada distinta.",
      },
      {
        title: "Tiempo como desafío",
        body: "El reloj marca el ritmo: cada instante cuenta y cada decisión importa.",
      },
      {
        title: "Ciudad como escenario",
        body: "Calles, gente y luz cotidiana se convierten en el set de tu historia.",
      },
      {
        title: "Comunidad como protagonista",
        body: "Competís, aprendés y celebrás junto a fotógrafos de todos los niveles.",
      },
    ],
  },
  upcoming: {
    id: "proximas-maratones",
    title: "Próximas maratones",
    status: "Próximamente",
    message:
      "Estamos preparando el lanzamiento. Pronto vas a poder conocer fechas, sedes y cómo participar.",
    note: "Sin ciudades, cupos ni precios inventados: el catálogo real llegará con la integración a FotoRank.",
  },
  howItWorks: {
    id: "como-funciona",
    title: "Cómo funciona",
    lead: "Una jornada simple de seguir, intensa de vivir.",
    steps: [
      {
        title: "Inscripción",
        body: "Te sumás a una maratón y elegís cómo participar cuando abramos las fechas.",
      },
      {
        title: "Consignas",
        body: "Recibís o liberás consignas creativas que guían tu recorrido.",
      },
      {
        title: "Recorrido fotográfico",
        body: "Explorás la ciudad contra el reloj, buscando el instante justo.",
      },
      {
        title: "Carga de fotografías",
        body: "Subís tus tomas para formar parte de la experiencia y la evaluación.",
      },
      {
        title: "Evaluación y aprendizaje",
        body: "El juzgamiento y la devolución te ayudan a crecer como fotógrafo.",
      },
      {
        title: "Comunidad y resultados",
        body: "Celebrás resultados, compartís historias y seguís conectado.",
      },
    ],
  },
  community: {
    id: "comunidad",
    title: "Comunidad y aprendizaje",
    lead: "Clickaton no se limita a competir.",
    body: "El propósito es pedagógico: mejorar la mirada, practicar bajo presión creativa y compartir con otros. Se admitirán distintos niveles y tipos de equipo. Los detalles de perfiles, insignias y galerías se definirán en etapas posteriores.",
  },
  finalCta: {
    title: "El próximo instante se acerca.",
    body: "Enterate de futuras fechas y del lanzamiento de la primera edición.",
    ctaLabel: "Conocé Clickaton",
    ctaHref: "#proximas-maratones",
    note: "La lista de espera y el newsletter se activarán cuando exista infraestructura real.",
  },
} as const;
