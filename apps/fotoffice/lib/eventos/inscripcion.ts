/**
 * La inscripción del asistente: lo que completa desde su enlace personal o desde la página pública
 * del evento. Módulo PURO (lo usan la acción y las pantallas): validación, consentimientos y los
 * límites de la foto.
 *
 * Es el paso "participante + revisión" del asistente de inscripción de Clickatón, sin el pago (acá
 * se paga en la tienda) y con los textos legales de FOTOFFICE.
 */

/**
 * Versión de los textos que se aceptan. Se guarda con cada inscripción: si los textos cambian, se
 * sube la versión y queda claro qué aceptó cada uno.
 */
export const CONSENT_VERSION = "fotoffice-evento-2026-11-02";

export function textoTerminos(organizacion: string, evento: string): string {
  return `Acepto las condiciones de participación de ${evento} y que ${organizacion} use mis datos para gestionar mi inscripción y mi acreditación.`;
}

export function textoUsoDeImagen(organizacion: string): string {
  return `Acepto que ${organizacion} use mi foto y mi nombre en mi credencial y en la placa de bienvenida, y que la publique en sus redes sociales.`;
}

/** Foto del inscripto: el navegador la achica a 1600 px; viaja dentro del envío (tope 4 MB). */
export const FORMATOS_FOTO_INSCRIPTO = ["image/jpeg", "image/png", "image/webp"] as const;
export const LADO_MAX_FOTO_INSCRIPTO = 1600;
/** Menos de esto no alcanza para una placa de 1080 px que se vea bien. */
export const LADO_MIN_FOTO_INSCRIPTO = 400;

export type CampoInscripcion = "nombre" | "email" | "telefono" | "dni" | "instagram" | "foto" | "terminos" | "imagen";

export type DatosInscripcion = {
  nombre: string;
  email: string | null;
  telefono: string | null;
  dni: string | null;
  instagram: string | null;
  aceptaTerminos: boolean;
  aceptaImagen: boolean;
};

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function texto(v: FormDataEntryValue | null, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
}

/** "@Juan.Perez", "instagram.com/juan.perez/" o "juan.perez" → "juan.perez". */
export function normalizarInstagram(v: string | null): string | null {
  if (!v) return null;
  const t = v
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@+/, "")
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(t) ? t : null;
}

/**
 * Valida lo que mandó el formulario. `pideFoto` y `tieneFoto` deciden si falta la foto: quien ya
 * la subió puede corregir sus datos sin volver a mandarla. `correoObligatorio`: en la página
 * pública el correo es la forma de volver a su entrada.
 */
export function validarInscripcion(
  fd: FormData,
  opciones: { pideFoto: boolean; tieneFoto: boolean; correoObligatorio: boolean },
): { ok: true; datos: DatosInscripcion } | { ok: false; errores: Partial<Record<CampoInscripcion, string>> } {
  const errores: Partial<Record<CampoInscripcion, string>> = {};
  const nombre = texto(fd.get("nombre"), 120);
  const email = texto(fd.get("email"), 160)?.toLowerCase() ?? null;
  const telefono = texto(fd.get("telefono"), 40);
  const dni = texto(fd.get("dni"), 20)?.replace(/[.\s]/g, "") ?? null;
  const instagramCrudo = texto(fd.get("instagram"), 80);
  const instagram = normalizarInstagram(instagramCrudo);
  const aceptaTerminos = fd.get("terminos") === "on";
  const aceptaImagen = fd.get("imagen") === "on";

  if (!nombre || nombre.length < 3) errores.nombre = "Escribí tu nombre y apellido.";
  if (email && !CORREO.test(email)) errores.email = "Ese correo no parece válido.";
  if (!email && opciones.correoObligatorio) errores.email = "Necesitamos tu correo para mandarte tu entrada.";
  if (dni && !/^\d{6,9}$/.test(dni)) errores.dni = "Escribí el DNI sólo con números.";
  if (instagramCrudo && !instagram) errores.instagram = "Ese usuario de Instagram no es válido.";
  if (opciones.pideFoto && !opciones.tieneFoto) errores.foto = "Subí una foto tuya: es para tu credencial y tu placa de bienvenida.";
  if (!aceptaTerminos) errores.terminos = "Para inscribirte tenés que aceptar las condiciones.";
  if ((opciones.tieneFoto || opciones.pideFoto) && !aceptaImagen) {
    errores.imagen = "Para hacer tu placa de bienvenida necesitamos tu permiso para usar la foto.";
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, datos: { nombre: nombre!, email, telefono, dni, instagram, aceptaTerminos, aceptaImagen } };
}

/** Lo que se guarda como prueba de lo que aceptó. */
export function consentimientosDe(d: DatosInscripcion, organizacion: string, evento: string) {
  return {
    terminos: d.aceptaTerminos ? textoTerminos(organizacion, evento) : null,
    usoDeImagen: d.aceptaImagen ? textoUsoDeImagen(organizacion) : null,
  };
}
