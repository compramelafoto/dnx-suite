import type { ContactBlockConfig, ContactSocial } from "./blocks";
import type { PublicSiteContact } from "./public-site";

/**
 * WhatsApp → enlace `https://wa.me/…`. Los números argentinos se escriben de mil formas
 * («341 341-9869», «0341 …», «+54 341 …»); WhatsApp exige el formato internacional con el 9
 * de celular (`549` + área + número). Si el número ya trae otro código de país, se deja pasar.
 * Devuelve `null` si no hay dígitos suficientes para ser un número.
 */
export function whatsappHref(numero: string, texto?: string): string | null {
  let digits = numero.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  let full: string;
  if (digits.startsWith("54") && digits.length >= 12) {
    // Ya trae el 54: se asegura el 9 de celular («54 341…» → «549 341…»).
    full = digits.startsWith("549") ? digits : `549${digits.slice(2)}`;
  } else {
    const local = digits.startsWith("0") ? digits.slice(1) : digits;
    // 10 dígitos = área + número sin código de país: es argentino.
    full = local.length === 10 ? `549${local}` : digits;
  }
  if (full.length < 8 || full.length > 15) return null;

  const base = `https://wa.me/${full}`;
  const text = texto?.trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Sólo enlaces de Google Maps (corto o completo), siempre por https. */
export function isAllowedMapsUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (host === "maps.app.goo.gl") return u.pathname.length > 1;
    return host === "www.google.com" && (u.pathname === "/maps" || u.pathname.startsWith("/maps/"));
  } catch {
    return false;
  }
}

/** Enlace de red social: https y nada más (nunca `javascript:` ni `data:`). */
export function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

/**
 * Datos de contacto efectivos del bloque. Con `useWorkspaceData`, cada campo que el dueño dejó
 * vacío se completa con el contacto de la institución (el mismo del pie del sitio); lo escrito
 * a mano en el bloque siempre manda. Sin el interruptor no se toma nada de la institución.
 */
export function resolveContactConfig(config: ContactBlockConfig, workspace: PublicSiteContact | undefined): ContactBlockConfig {
  if (!config.useWorkspaceData || !workspace) return config;
  const pick = (own: string | undefined, fallback: string | null) => (own?.trim() ? own : (fallback ?? undefined));

  const socials: ContactSocial[] = [...config.socials];
  const handle = workspace.instagram?.trim();
  if (handle && !socials.some((s) => s.network === "instagram")) {
    const url = /^https?:\/\//i.test(handle) ? handle : `https://instagram.com/${handle.replace(/^@/, "")}`;
    socials.push({ network: "instagram", url });
  }

  const place = [workspace.city, workspace.province].filter(Boolean).join(", ");
  return {
    ...config,
    email: pick(config.email, workspace.email),
    phone: pick(config.phone, workspace.phone),
    whatsapp: pick(config.whatsapp, workspace.whatsapp),
    address: pick(config.address, place || null),
    socials,
  };
}
