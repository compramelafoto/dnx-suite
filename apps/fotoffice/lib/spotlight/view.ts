import { normalizeArgentineWhatsappNumber } from "@/lib/portfolio/whatsapp";
import { etiquetaRed, urlDeUsuario } from "@/lib/membership/social";
import { placaInitials, placaPhoto, placaSpecialty, placaZone } from "@/lib/placas/values";
import {
  answeredQuestions,
  colleaguePhrase,
  spotlightWhatsappMessage,
  type AboutMe,
} from "./about";

/**
 * Qué muestra la tarjeta del Socio de la semana, según quién mira.
 *
 * Módulo puro, y la única puerta: el portal y el sitio público arman su tarjeta desde acá, así
 * las reglas de privacidad viven en un solo lugar y se pueden probar:
 *
 * - **Portal** (socios con sesión): todo lo que contestó, sus redes, y WhatsApp **sólo si lo
 *   aceptó** y tiene un teléfono que sirva.
 * - **Sitio público**: sólo si dio permiso para aparecer en público (`directoryOptIn`), y nunca
 *   teléfono, WhatsApp ni correo.
 */

export type SpotlightMemberData = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  profilePhotoUrl: string | null;
  city: string | null;
  province: string | null;
  studioCity: string | null;
  studioProvince: string | null;
  specialties: string[];
  businessName: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  youtube: string | null;
  linkedin: string | null;
  directoryOptIn: boolean;
};

export type SpotlightCardView = {
  firstName: string;
  fullName: string;
  businessName: string | null;
  photoUrl: string | null;
  initials: string;
  zone: string | null;
  specialty: string | null;
  answers: { key: string; pregunta: string; respuesta: string }[];
  proudPhotoUrl: string | null;
  colleaguePhrase: string | null;
  whatsappUrl: string | null;
  links: { label: string; url: string }[];
  portfolioPath: string | null;
  /** Quien mira es el destacado. */
  isViewer: boolean;
  /** No completó «Más sobre mí»: al destacado se le ofrece completarlo. */
  aboutEmpty: boolean;
};

export function buildSpotlightCard(input: {
  member: SpotlightMemberData;
  about: AboutMe | null;
  portfolioPath: string | null;
  institution: string;
  audience: "portal" | "public";
  viewerMemberId?: string | null;
}): SpotlightCardView | null {
  const { member: m, about, audience } = input;
  if (audience === "public" && !m.directoryOptIn) return null;

  const respuestas = answeredQuestions(about);
  const links: { label: string; url: string }[] = [];
  if (m.instagram) links.push({ label: etiquetaRed("instagram"), url: urlDeUsuario("instagram", m.instagram) });
  if (m.tiktok) links.push({ label: etiquetaRed("tiktok"), url: urlDeUsuario("tiktok", m.tiktok) });
  if (m.facebook) links.push({ label: etiquetaRed("facebook"), url: m.facebook });
  if (m.youtube) links.push({ label: etiquetaRed("youtube"), url: m.youtube });
  if (m.linkedin) links.push({ label: etiquetaRed("linkedin"), url: m.linkedin });
  if (m.website) links.push({ label: "Sitio web", url: m.website });

  let whatsappUrl: string | null = null;
  if (audience === "portal" && about?.whatsappOptIn) {
    const numero = normalizeArgentineWhatsappNumber(m.phone);
    if (numero) {
      const texto = spotlightWhatsappMessage({ firstName: m.firstName, institution: input.institution });
      whatsappUrl = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    }
  }

  return {
    firstName: m.firstName.trim(),
    fullName: `${m.firstName} ${m.lastName}`.trim(),
    businessName: m.businessName?.trim() || null,
    photoUrl: placaPhoto(m),
    initials: placaInitials(m.firstName, m.lastName),
    zone: placaZone(m),
    specialty: placaSpecialty(m.specialties),
    answers: respuestas,
    proudPhotoUrl: about?.proudPhotoUrl ?? null,
    colleaguePhrase: colleaguePhrase(m.firstName, about),
    whatsappUrl,
    links,
    portfolioPath: input.portfolioPath,
    isViewer: audience === "portal" && input.viewerMemberId === m.id,
    aboutEmpty: respuestas.length === 0,
  };
}
