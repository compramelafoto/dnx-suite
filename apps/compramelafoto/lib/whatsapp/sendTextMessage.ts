/**
 * Envía mensaje de texto por WhatsApp Cloud API.
 */

import { formatPhoneForWhatsApp } from "./formatPhone";

const DEFAULT_API_VERSION = process.env.WHATSAPP_API_VERSION || "v19.0";

export type SendTextResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export async function sendTextMessage(
  to: string,
  text: string
): Promise<SendTextResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = DEFAULT_API_VERSION;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: "WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN son requeridos" };
  }

  const toFormatted = formatPhoneForWhatsApp(to);
  if (!toFormatted || toFormatted.length < 10) {
    return { success: false, error: "Teléfono inválido" };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toFormatted,
        type: "text",
        text: { body: text },
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = data?.error?.message || data?.error?.error_user_msg || `HTTP ${response.status}`;
      return { success: false, error: errMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
