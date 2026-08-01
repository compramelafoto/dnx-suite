/**
 * Canales soportados por la plataforma de comunicaciones.
 * Etapa 01: solo Email está cableado vía providers.
 */
export const COMMUNICATION_CHANNELS = [
  "email",
  "whatsapp",
  "push",
  "sms",
  "in_app",
] as const;

export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export function isCommunicationChannel(value: string): value is CommunicationChannel {
  return (COMMUNICATION_CHANNELS as readonly string[]).includes(value);
}
