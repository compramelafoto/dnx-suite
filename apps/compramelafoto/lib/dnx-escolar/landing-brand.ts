/**
 * Marca de la landing escolar: quién la firma (DNX Estudio en /dnx/escolar, o el fotógrafo
 * en /<handler>/escolar) y cómo se lo contacta.
 *
 * Todo es puro (sin Prisma, React ni red) para poder probarlo con node:test.
 */

import { DNX_ESCOLAR_SOURCE } from "./lead-notes";

/** Origen de las solicitudes que llegan por la landing escolar de un fotógrafo. */
export const PHOTOGRAPHER_ESCOLAR_SOURCE = "escolar-fotografo";

/** Color de los botones cuando el fotógrafo no tiene uno usable (el mismo de /dnx/escolar). */
export const ESCOLAR_DEFAULT_ACCENT = "#18181b";

export type EscolarBrand = {
  /** Handler público del fotógrafo; null en /dnx/escolar (los avisos van a la casilla de DNX). */
  photographerHandler: string | null;
  /** Origen que se guarda con la solicitud (ver `buildSchoolLeadNotes`). */
  source: string;
  /** Nombre con el que se presenta ante el colegio ("DNX Estudio", "Estudio Pérez"…). */
  nombre: string;
  logoUrl: string | null;
  /** Línea opcional debajo de los botones del hero (responsable, descripción, ciudad). */
  firma: string | null;
  /** Texto del encabezado del hero, por ejemplo la zona de trabajo. */
  zona: string;
  direccion: string | null;
  localidad: string | null;
  telefonoVisible: string | null;
  whatsappUrl: string | null;
  email: string | null;
  mailtoUrl: string | null;
  /** Color de botones y números. Siempre un hex oscuro, para que el texto blanco se lea. */
  accent: string;
  /** Beneficio "servicio local" (sólo si hay datos para afirmarlo). */
  beneficioLocal: { titulo: string; texto: string } | null;
};

function cleanText(value: string | null | undefined, max = 160): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
  return text ? text : null;
}

/** Handler válido para buscar al fotógrafo (minúsculas, letras, números y guiones). */
export function sanitizePhotographerHandler(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(value) ? value : null;
}

/**
 * Número de WhatsApp en formato internacional para wa.me. Asume Argentina cuando el número
 * viene sin código de país (10 dígitos: característica + número, o con 0 adelante).
 * Devuelve null si no parece un teléfono.
 */
export function normalizeWhatsappForLink(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  const internacional = raw.trim().startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("54")) {
    // 54 + 9 + característica + número. Si falta el 9 de celulares, se agrega.
    if (!digits.startsWith("549") && digits.length === 12) digits = `549${digits.slice(2)}`;
  } else if (!internacional) {
    // Número local: sólo se acepta característica + número (10 dígitos, con o sin 0).
    // Con "15" u otros formatos no se adivina, para no armar un enlace a otra persona.
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length !== 10) return null;
    digits = `549${digits}`;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function buildWhatsappUrl(raw: string | null | undefined, nombre: string): string | null {
  const digits = normalizeWhatsappForLink(raw);
  if (!digits) return null;
  const text = `Hola ${nombre}, escribo desde un colegio y quiero consultar por fotografía escolar.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function buildMailtoUrl(email: string | null | undefined): string | null {
  const clean = cleanText(email, 254);
  if (!clean || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(clean)) return null;
  return `mailto:${clean}?subject=${encodeURIComponent("Consulta fotografía escolar")}`;
}

/** Luminancia relativa (WCAG) de un hex #rrggbb. */
function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * Usa el color principal del fotógrafo sólo si el texto blanco encima se lee bien
 * (contraste ≥ 4.5:1). Si no, cae al negro de la landing de DNX.
 */
export function pickAccentColor(input: string | null | undefined): string {
  if (typeof input !== "string") return ESCOLAR_DEFAULT_ACCENT;
  let hex = input.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(hex)) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  if (!/^#[0-9a-f]{6}$/.test(hex)) return ESCOLAR_DEFAULT_ACCENT;
  const contrastWithWhite = 1.05 / (relativeLuminance(hex) + 0.05);
  return contrastWithWhite >= 4.5 ? hex : ESCOLAR_DEFAULT_ACCENT;
}

/** /dnx/escolar: la misma marca y los mismos datos que tenía la landing original. */
export const DNX_ESCOLAR_BRAND: EscolarBrand = {
  photographerHandler: null,
  source: DNX_ESCOLAR_SOURCE,
  nombre: "DNX Estudio",
  logoUrl: "/dnx/logo-dnx.png",
  firma: "Daniel A. Cuart, fotógrafo profesional y docente · Estudio en Funes",
  zona: "Para colegios privados · Rosario, Funes, Roldán y alrededores",
  direccion: "San José 1672, Local 5",
  localidad: "Funes, Santa Fe",
  telefonoVisible: "341 374-8324",
  whatsappUrl: `https://wa.me/5493413748324?text=${encodeURIComponent(
    "Hola DNX, escribo desde un colegio y quiero consultar por fotografía escolar.",
  )}`,
  email: "dnxfotografia@gmail.com",
  mailtoUrl: `mailto:dnxfotografia@gmail.com?subject=${encodeURIComponent("Consulta fotografía escolar")}`,
  accent: ESCOLAR_DEFAULT_ACCENT,
  beneficioLocal: {
    titulo: "Servicio local",
    texto: "Estudio con lugar de atención en Funes, cerca de Rosario y Roldán.",
  },
};

/** Datos públicos del fotógrafo que usa la landing (los mismos que muestra su página pública). */
export type EscolarPhotographerProfile = {
  publicPageHandler: string;
  name: string | null;
  companyName: string | null;
  /** Ya normalizado a URL pública. */
  logoUrl: string | null;
  whatsapp: string | null;
  phone: string | null;
  companyAddress: string | null;
  city: string | null;
  primaryColor: string | null;
};

export function buildPhotographerEscolarBrand(p: EscolarPhotographerProfile): EscolarBrand {
  const companyName = cleanText(p.companyName, 120);
  const personName = cleanText(p.name, 120);
  const nombre = companyName || personName || "Tu fotógrafo";
  const city = cleanText(p.city, 120);
  const direccion = cleanText(p.companyAddress, 200);
  const telefono = cleanText(p.whatsapp, 40) || cleanText(p.phone, 40);

  const firmaPartes: string[] = [];
  if (personName && companyName && personName.toLowerCase() !== companyName.toLowerCase()) firmaPartes.push(personName);
  if (city) firmaPartes.push(city);

  return {
    photographerHandler: p.publicPageHandler.toLowerCase(),
    source: PHOTOGRAPHER_ESCOLAR_SOURCE,
    nombre,
    logoUrl: cleanText(p.logoUrl, 2048),
    firma: firmaPartes.length > 0 ? firmaPartes.join(" · ") : null,
    zona: city ? `Para colegios e instituciones · ${city} y alrededores` : "Para colegios e instituciones educativas",
    direccion,
    localidad: city,
    telefonoVisible: telefono,
    whatsappUrl: buildWhatsappUrl(cleanText(p.whatsapp, 40) || cleanText(p.phone, 40), nombre),
    // El email de la cuenta es el de inicio de sesión: no se publica. Las consultas del formulario
    // le llegan al fotógrafo por correo sin exponerlo.
    email: null,
    mailtoUrl: null,
    accent: pickAccentColor(p.primaryColor),
    beneficioLocal: city
      ? { titulo: "Atención cercana", texto: `${nombre} trabaja en ${city} y alrededores.` }
      : null,
  };
}
