import { routes } from "@/config/navigation";

export const contactPageContent = {
  meta: {
    title: "Contacto",
    description:
      "Motivos de contacto institucionales de Clickaton. Los canales oficiales se publicarán próximamente.",
  },
  hero: {
    eyebrow: "Contacto",
    title: "Escribinos cuando abramos los canales oficiales.",
    description:
      "Estamos preparando las vías de comunicación institucionales. Mientras tanto, podés recorrer el sitio y conocer el proyecto.",
  },
  status: "Los canales oficiales se publicarán próximamente.",
  reasons: [
    { title: "Participar", body: "Consultas sobre próximas ediciones y cómo sumarte." },
    { title: "Organizar una sede", body: "Interés en el programa de sedes y acompañamiento." },
    { title: "Sponsors", body: "Alianzas de marca, educación, cultura o tecnología." },
    { title: "Prensa", body: "Cobertura, entrevistas y material institucional." },
    { title: "Alianzas", body: "Instituciones, clubes y organizaciones afines." },
    { title: "Consultas generales", body: "Otras preguntas sobre Clickaton." },
  ],
  links: [
    { label: "Ver maratones", href: routes.marathons },
    { label: "Organizá una", href: routes.organize },
    { label: "Sponsors", href: routes.sponsors },
  ],
  note: "No publicamos correo, teléfono, dirección ni redes inventadas.",
} as const;
