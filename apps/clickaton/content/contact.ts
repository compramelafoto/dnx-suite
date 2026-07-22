import { routes } from "@/config/navigation";
import { CONTACT_REASON_OPTIONS } from "@/lib/contact/reasons";

export const contactPageContent = {
  meta: {
    title: "Contacto",
    description:
      "Escribinos para formar parte, alianzas, sedes, prensa u otras consultas institucionales de Clickatón.",
  },
  hero: {
    eyebrow: "Contacto",
    title: "Contanos cómo querés sumarte.",
    description:
      "Completá el formulario y tu mensaje llega a la casilla del equipo Clickatón. Te respondemos por email.",
  },
  status: "Formulario activo — tus datos llegan al equipo Clickatón.",
  reasons: CONTACT_REASON_OPTIONS.map((reason) => ({
    title: reason.label,
    body: reason.description,
  })),
  links: [
    { label: "Ver maratones", href: routes.marathons },
    { label: "Organizá una", href: routes.organize },
    { label: "Formá parte", href: routes.joinUs },
  ],
  note: "Usamos tus datos solo para responder esta consulta.",
} as const;
