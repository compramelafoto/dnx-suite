/**
 * Envía imagen por WhatsApp Cloud API.
 * La URL debe ser públicamente accesible (WhatsApp la descargará).
 */

import { formatPhoneForWhatsApp } from "./formatPhone";

const DEFAULT_API_VERSION = process.env.WHATSAPP_API_VERSION || "v19.0";

export type SendImageResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export async function sendImageMessage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<SendImageResult> {
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

  if (!imageUrl || !imageUrl.startsWith("http")) {
    return { success: false, error: "URL de imagen inválida" };
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  try {
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: toFormatted,
      type: "image",
      image: { link: imageUrl },
    };
    if (caption && caption.trim()) {
      (body.image as Record<string, string>).caption = caption.trim().slice(0, 1024);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
