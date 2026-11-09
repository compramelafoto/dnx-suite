/**
 * Claves de emparejamiento de Contactos DNX: sirven para detectar que dos registros son el mismo
 * contacto (mismo sitio, mismo Instagram, mismo correo, mismo teléfono o mismo nombre en la misma ciudad).
 * Puro: sin acceso a base ni a la red.
 */
import { correo, esDatoDePrueba, telefonoAr } from "@/lib/alboom/carga/normalizar";

/** Dominios que no identifican a nadie: redes y plataformas donde viven miles de negocios. */
const DOMINIOS_GENERICOS = [
  "instagram.com", "facebook.com", "fb.com", "linktr.ee", "wa.me", "google.com", "sites.google.com",
  "wixsite.com", "blogspot.com", "mercadolibre.com", "mercadolibre.com.ar",
];

function esGenerico(host: string): boolean {
  return DOMINIOS_GENERICOS.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Dominio sin `www.`; `null` si no hay o si es una red/plataforma genérica. */
export function claveDominio(web: string | null): string | null {
  if (!web) return null;
  const t = web.trim();
  if (t === "") return null;
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  if (!host.includes(".") || esGenerico(host)) return null;
  // mercadolibre en cualquier país (.com.mx, .com.uy...)
  if (/(^|\.)mercadolibre\./.test(host)) return null;
  return host;
}

/** Usuario de Instagram en minúsculas, desde una URL o `@usuario`. */
export function claveInstagram(texto: string | null): string | null {
  if (!texto) return null;
  let t = texto.trim();
  if (t === "") return null;
  const m = /instagram\.com\/([^/?#\s]+)/i.exec(t);
  t = m ? m[1]! : t;
  t = t.replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(t)) return null;
  return t;
}

/** Correos de relleno que se cargan para saltear el campo. */
const CORREOS_RELLENO = new Set([
  "no@tiene.com", "notiene@gmail.com", "no@tiene.com.ar", "sin@correo.com", "sincorreo@gmail.com",
  "nada@nada.com", "none@none.com", "na@na.com", "a@a.com",
]);

/** Correo en minúsculas; `null` si es inválido o de relleno. */
export function claveEmail(email: string | null): string | null {
  const { valor } = correo(email);
  if (!valor) return null;
  if (CORREOS_RELLENO.has(valor)) return null;
  if (esDatoDePrueba({ correo: valor, nombres: [] })) return null;
  return valor;
}

/** Teléfono argentino como `+54` + área + número (sin 9 ni 15); `null` si no es legible. */
export function claveTelefono(tel: string | null): string | null {
  if (!tel) return null;
  const { nacional } = telefonoAr(tel, false);
  return nacional ? `+54${nacional}` : null;
}

const GENERICAS = new Set(["fotografia", "fotografo", "fotografa", "foto", "fotos", "estudio", "studio", "ph", "photo", "fotografico", "fotografica"]);

function limpiar(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `nombre|ciudad` sin acentos, mayúsculas ni signos, sin palabras genéricas (si queda alguna otra). `null` sin ciudad. */
export function claveNombreCiudad(nombre: string, ciudad: string | null): string | null {
  if (!ciudad) return null;
  const c = limpiar(ciudad).replace(/\s+/g, " ");
  if (c === "") return null;
  const palabras = limpiar(nombre).split(" ").filter(Boolean);
  const utiles = palabras.filter((p) => !GENERICAS.has(p));
  const final = (utiles.length > 0 ? utiles : palabras).join(" ");
  if (final === "") return null;
  return `${final}|${c}`;
}

export type ClavesContacto = {
  claveDominio: string | null;
  claveInstagram: string | null;
  claveEmail: string | null;
  claveTelefono: string | null;
  claveNombreCiudad: string | null;
};

export function clavesDe(c: {
  web?: string | null; instagram?: string | null; email?: string | null; telefono?: string | null;
  nombre: string; ciudad?: string | null;
}): ClavesContacto {
  return {
    claveDominio: claveDominio(c.web ?? null),
    claveInstagram: claveInstagram(c.instagram ?? null),
    claveEmail: claveEmail(c.email ?? null),
    claveTelefono: claveTelefono(c.telefono ?? null),
    claveNombreCiudad: claveNombreCiudad(c.nombre, c.ciudad ?? null),
  };
}
