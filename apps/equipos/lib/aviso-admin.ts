import { sendPortalEmail, type PortalEmailTemplate } from "@/lib/correo";

/**
 * Correo al administrador. Nunca rompe la operación que lo origina: si falta `ADMIN_EMAIL`, si el
 * envío tira error o si el proveedor responde `{ success: false }`, se registra y se sigue.
 * Devuelve `true` sólo cuando el correo salió.
 */
export async function avisarAlAdmin(
  origen: string,
  template: PortalEmailTemplate,
  data: Record<string, string>,
): Promise<boolean> {
  const to = process.env.ADMIN_EMAIL?.trim();
  if (!to) {
    console.warn(`[${origen}] ADMIN_EMAIL no configurado; no se envía "${template}".`);
    return false;
  }
  try {
    const res = await sendPortalEmail(to, template, data);
    if (!res.success) {
      console.error(`[${origen}] No se pudo enviar el aviso "${template}" al admin.`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[${origen}] No se pudo enviar el aviso "${template}":`, err);
    return false;
  }
}
