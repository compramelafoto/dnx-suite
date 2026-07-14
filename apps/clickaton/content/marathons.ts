import type { MarathonFormat, RegistrationStatus } from "@/types/marathon";
import { routes } from "@/config/navigation";

export const marathonsPageContent = {
  meta: {
    title: "Próximas maratones fotográficas",
    description:
      "Conocé cómo se anunciarán las próximas ediciones de Clickatón: fechas, sedes, categorías, bases e inscripción.",
  },
  hero: {
    eyebrow: "Próximas experiencias",
    title: "Cada ciudad puede convertirse en una Clickatón.",
    description:
      "Las próximas ediciones reunirán fotografía, consignas, recorrido, tiempo limitado y comunidad. Acá vas a encontrar fechas, sedes, categorías, bases e inscripción cuando sean anunciadas oficialmente.",
  },
  empty: {
    message: "Próximamente anunciaremos las primeras ciudades y fechas.",
    note: "No publicamos sedes, cupos ni precios inventados. El catálogo real llegará con la integración a FotoRank.",
    formats: ["individual", "team", "mixed"] as const satisfies readonly MarathonFormat[],
    registrationStatuses: [
      "coming_soon",
      "open",
      "last_places",
      "full",
      "closed",
    ] as const satisfies readonly RegistrationStatus[],
    cardHints: [
      "Nombre de la edición y territorio",
      "Fechas y estado de inscripción",
      "Formato: individual, grupal o mixto",
      "Dispositivos según las bases",
      "Enlace a bases y categorías",
    ],
  },
  notes: {
    title: "Cada edición define sus reglas",
    body: "Duración, cantidad de consignas, dispositivos admitidos y modalidades se publican en las bases de esa Clickatón. Lo que ves acá es el marco común; el detalle lo marca cada edición.",
  },
  ctas: {
    howItWorks: { label: "Cómo funciona", href: routes.howItWorks },
    organize: { label: "Organizá una", href: routes.organize },
  },
  /** Enlace técnico — no es un anuncio de edición. */
  demo: {
    label: "Ver ficha técnica de demostración",
    href: routes.marathonDemo,
    note: "Datos ficticios para validar la presentación pública. No es una maratón anunciada.",
  },
} as const;
