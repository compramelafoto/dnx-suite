/**
 * Configuración de entrega por WhatsApp (desde AppConfig).
 */

import { prisma } from "@/lib/prisma";

export type WhatsAppDeliveryConfig = {
  whatsappEnabled: boolean;
  whatsappMaxPhotosToSend: number;
  whatsappSendInitialMessage: boolean;
  whatsappSendFinalMessage: boolean;
  whatsappSendDownloadLinkForLargeOrders: boolean;
  whatsappDeliveryEnabledForPaidOrders: boolean;
};

const DEFAULTS: WhatsAppDeliveryConfig = {
  whatsappEnabled: false,
  whatsappMaxPhotosToSend: 10,
  whatsappSendInitialMessage: true,
  whatsappSendFinalMessage: true,
  whatsappSendDownloadLinkForLargeOrders: true,
  whatsappDeliveryEnabledForPaidOrders: true,
};

export async function getWhatsAppDeliveryConfig(): Promise<WhatsAppDeliveryConfig> {
  try {
    const config = await prisma.appConfig.findUnique({
      where: { id: 1 },
      select: {
        whatsappEnabled: true,
        whatsappMaxPhotosToSend: true,
        whatsappSendInitialMessage: true,
        whatsappSendFinalMessage: true,
        whatsappSendDownloadLinkForLargeOrders: true,
        whatsappDeliveryEnabledForPaidOrders: true,
      },
    });

    if (!config) return DEFAULTS;

    return {
      whatsappEnabled: config.whatsappEnabled ?? DEFAULTS.whatsappEnabled,
      whatsappMaxPhotosToSend: config.whatsappMaxPhotosToSend ?? DEFAULTS.whatsappMaxPhotosToSend,
      whatsappSendInitialMessage: config.whatsappSendInitialMessage ?? DEFAULTS.whatsappSendInitialMessage,
      whatsappSendFinalMessage: config.whatsappSendFinalMessage ?? DEFAULTS.whatsappSendFinalMessage,
      whatsappSendDownloadLinkForLargeOrders:
        config.whatsappSendDownloadLinkForLargeOrders ?? DEFAULTS.whatsappSendDownloadLinkForLargeOrders,
      whatsappDeliveryEnabledForPaidOrders:
        config.whatsappDeliveryEnabledForPaidOrders ?? DEFAULTS.whatsappDeliveryEnabledForPaidOrders,
    };
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    if (msg.includes("whatsappEnabled") || msg.includes("does not exist")) {
      return DEFAULTS;
    }
    throw err;
  }
}
