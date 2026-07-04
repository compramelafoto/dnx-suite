/**
 * Envía un mensaje de WhatsApp usando template aprobado (Meta Cloud API).
 * Requiere: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_API_VERSION
 */

const DEFAULT_API_VERSION = "v19.0";

export type SendWhatsAppTemplateParams = {
  to: string;
  templateName: string;
  bodyVariables?: string[];
  buttonVariables?: string[];
  languageCode?: string;
};

export async function sendWhatsAppTemplate(params: SendWhatsAppTemplateParams) {
  const {
    to,
    templateName,
    bodyVariables = [],
    buttonVariables = [],
    languageCode = "es_AR",
  } = params;

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;

  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID es requerido para enviar templates de WhatsApp");
  }
  if (!accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN es requerido para enviar templates de WhatsApp");
  }

  const components: Array<{ type: string; parameters?: Array<{ type: string; text: string }>; sub_type?: string; index?: number }> = [];

  if (bodyVariables.length > 0) {
    components.push({
      type: "body",
      parameters: bodyVariables.map((v) => ({
        type: "text",
        text: String(v),
      })),
    });
  }

  if (buttonVariables.length > 0) {
    components.push({
      type: "button",
      sub_type: "url",
      index: 0,
      parameters: buttonVariables.map((v) => ({
        type: "text",
        text: String(v),
      })),
    });
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ""),
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components: components.length > 0 ? components : undefined,
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    let errorDetail = text;
    try {
      const parsed = JSON.parse(text);
      errorDetail = parsed.error?.message || parsed.error?.error_user_msg || JSON.stringify(parsed);
    } catch {
      // usar text como está
    }
    throw new Error(`WhatsApp API error ${response.status}: ${errorDetail}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { ok: true };
  }
}
