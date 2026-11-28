import { Resend } from "resend";

export type PortalEmailTemplate =
  | "verificacion_aprobada"
  | "verificacion_rechazada"
  | "verificacion_en_revision_admin"
  | "denuncia_recibida"
  | "coincidencia_inventario_admin"
  | "conflicto_serie_admin"
  | "recordatorio_poliza";

type Rendered = { subject: string; html: string; text: string };

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Plantillas en español. Función pura: el asunto de los correos al admin nunca lleva
 * datos personales (los datos van sólo en el cuerpo).
 */
export function renderPortalEmail(
  template: PortalEmailTemplate,
  data: Record<string, string>,
): Rendered {
  const d = (k: string, fallback = ""): string => data[k]?.trim() || fallback;
  const nombre = d("nombre");
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const url = d("url");

  let subject: string;
  let lineas: string[];

  switch (template) {
    case "verificacion_aprobada":
      subject = "Tu identidad quedó verificada";
      lineas = [
        saludo,
        "Verificamos tu identidad. Ya podés usar todas las funciones del portal de equipos verificados.",
      ];
      break;
    case "verificacion_rechazada":
      subject = "No pudimos verificar tu identidad";
      lineas = [
        saludo,
        "No pudimos completar la verificación de tu identidad.",
        d("motivo") ? `Motivo: ${d("motivo")}` : "Podés volver a intentarlo desde el portal.",
      ];
      break;
    case "verificacion_en_revision_admin":
      subject = "Verificación de identidad pendiente de revisión";
      lineas = [
        "Hay una verificación de identidad que necesita revisión manual.",
        d("nombre") ? `Usuario: ${d("nombre")}` : "",
        d("email") ? `Correo: ${d("email")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "denuncia_recibida":
      subject = "Recibimos tu denuncia";
      lineas = [
        saludo,
        "Recibimos tu denuncia y la vamos a revisar. Te avisamos por este medio cuando tengamos novedades.",
        d("referencia") ? `Referencia: ${d("referencia")}` : "",
      ];
      break;
    case "coincidencia_inventario_admin":
      subject = "Coincidencia con un equipo denunciado";
      lineas = [
        "Un equipo cargado en el portal coincide con una denuncia existente.",
        d("detalle") ? `Detalle: ${d("detalle")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "conflicto_serie_admin":
      subject = "Conflicto de número de serie";
      lineas = [
        "Dos usuarios cargaron el mismo número de serie y hace falta resolverlo.",
        d("detalle") ? `Detalle: ${d("detalle")}` : "",
        url ? `Revisar: ${url}` : "",
      ];
      break;
    case "recordatorio_poliza":
      subject = "Tu póliza de seguro está por vencer";
      lineas = [
        saludo,
        "Te recordamos que la póliza de seguro de tus equipos está próxima a vencer.",
        d("fecha") ? `Vence el: ${d("fecha")}` : "",
        url ? `Renovar o actualizar: ${url}` : "",
      ];
      break;
  }

  const partes = lineas.filter((l) => l !== "");
  return {
    subject,
    text: partes.join("\n\n"),
    html: partes.map((l) => `<p>${esc(l)}</p>`).join("\n"),
  };
}

let client: Resend | null = null;

export async function sendPortalEmail(
  to: string,
  template: PortalEmailTemplate,
  data: Record<string, string>,
): Promise<{ success: boolean }> {
  const { subject, html, text } = renderPortalEmail(template, data);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[correo] RESEND_API_KEY no configurada; no se envía "${template}".`);
    return { success: false };
  }
  try {
    client ??= new Resend(apiKey);
    const res = await client.emails.send({
      from: process.env.EMAIL_FROM || "noreply@dnxfotografia.com",
      to,
      subject,
      html,
      text,
    });
    if (res.error) {
      console.error("[correo] Resend devolvió error:", res.error);
      return { success: false };
    }
    return { success: true };
  } catch (err) {
    console.error("[correo] Error enviando correo:", err);
    return { success: false };
  }
}
