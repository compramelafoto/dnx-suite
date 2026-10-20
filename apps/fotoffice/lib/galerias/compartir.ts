/**
 * Datos de contacto y mensajes para compartir el enlace de una galería (módulo PURO).
 */
import { buildWhatsappUrl } from "@/lib/contact/whatsapp";

/** Correo en minúsculas y sin espacios; null si no es una dirección válida. */
export function correoDeGaleria(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim().toLowerCase();
  if (t === "") return null;
  return t.length <= 254 && /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(t) ? t : undefined;
}

/** Teléfono tal cual lo escribieron pero limpio; null si está vacío, undefined si no es un teléfono. */
export function telefonoDeGaleria(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim();
  if (t === "") return null;
  if (t.length > 30 || !/^[0-9+()\-. ]+$/.test(t)) return undefined;
  const digitos = t.replace(/\D/g, "");
  return digitos.length >= 6 && digitos.length <= 18 ? t : undefined;
}

export function nombreDeClienteDeGaleria(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= 120 ? t : null;
}

/** El texto que se manda por WhatsApp con el enlace personal. */
export function textoWhatsappGaleria(d: { nombre: string; galeria: string; organizacion: string | null; url: string }): string {
  const primero = d.nombre.trim().split(/\s+/)[0] ?? "";
  const saludo = primero ? `Hola ${primero}!` : "Hola!";
  const de = d.organizacion ? ` de ${d.organizacion}` : "";
  return `${saludo} Te paso el enlace a la galería "${d.galeria}"${de} para que elijas tus fotos: ${d.url}\nEs personal: no lo compartas.`;
}

/** Enlace wa.me con el texto, o null si el teléfono no sirve. */
export function enlaceWhatsappGaleria(telefono: string | null, texto: string): string | null {
  return buildWhatsappUrl(telefono, texto);
}
