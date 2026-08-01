/**
 * Hechos públicos de ficha / landing para Clickatón Argentina 2026.
 * Solo marketing + cronograma operativo visible. No abre ventas.
 */
import {
  ARGENTINA_2026_RULES,
  ARGENTINA_2026_SCHEDULE,
  ARGENTINA_2026_TIMEZONE,
  CAMERA_CLOCK_WARNING_ES,
  CLICKATON_TERMS_VERSION,
} from "./argentina-2026";
import { ARGENTINA_2026_SHIRT_BENEFIT_COPY } from "@/lib/catalog/domain/first-n-benefit";
import type { PublicScheduleItem } from "@/types/marathon";

export const ARGENTINA_2026_PUBLIC_CITY = "Rosario";
export const ARGENTINA_2026_PUBLIC_PROVINCE = "Santa Fe";
/** Lugar de acreditación aprobado. Dirección postal exacta: config humana pendiente. */
export const ARGENTINA_2026_PUBLIC_VENUE_NAME = "Complejo Cultural Fontanarrosa";
export const ARGENTINA_2026_VENUE_ADDRESS_CONFIG_REQUIRED =
  "VENUE ADDRESS HUMAN CONFIG REQUIRED" as const;

export function argentina2026PublicSchedule(): PublicScheduleItem[] {
  const S = ARGENTINA_2026_SCHEDULE;
  return [
    {
      id: "cka26-accreditation",
      title: "Acreditación",
      description: "Retiro de credencial y kit según disponibilidad del beneficio.",
      startAt: new Date(S.accreditationOpenIso).toISOString(),
      endAt: new Date(S.accreditationCloseIso).toISOString(),
      location: ARGENTINA_2026_PUBLIC_VENUE_NAME,
      publicBeforeEvent: true,
      type: "briefing",
    },
    {
      id: "cka26-talk",
      title: "Charla introductoria",
      description: "Briefing previo / al inicio de la ventana de captura.",
      startAt: new Date(S.talkOpenIso).toISOString(),
      endAt: new Date(S.talkCloseIso).toISOString(),
      location: ARGENTINA_2026_PUBLIC_VENUE_NAME,
      publicBeforeEvent: true,
      type: "briefing",
    },
    {
      id: "cka26-capture",
      title: "Ventana válida de captura",
      description:
        "Fotografías válidas: tomadas desde las 16:00 y antes de las 20:00 (hora Argentina). La hora de subida no valida la captura.",
      startAt: new Date(S.captureOpenIso).toISOString(),
      endAt: new Date(S.captureCloseIso).toISOString(),
      location: "Rosario",
      publicBeforeEvent: true,
      type: "start",
    },
    {
      id: "cka26-upload",
      title: "Ventana de carga",
      description:
        "Podés seleccionar, revelar y subir desde las 16:00 hasta las 22:00. Entre 20:00 y 22:00 solo obras capturadas en la ventana válida.",
      startAt: new Date(S.uploadOpenIso).toISOString(),
      endAt: new Date(S.uploadCloseIso).toISOString(),
      location: "Rosario",
      publicBeforeEvent: true,
      type: "deadline",
    },
    {
      id: "cka26-upload-close",
      title: "Cierre de entrega",
      description: "A las 22:00 no se aceptan nuevos envíos (reloj del servidor).",
      startAt: new Date(S.uploadCloseIso).toISOString(),
      endAt: new Date(S.uploadCloseIso).toISOString(),
      location: "Rosario",
      publicBeforeEvent: true,
      type: "deadline",
    },
  ];
}

export function argentina2026PublicFaq() {
  return [
    {
      question: "¿Cuándo y dónde es?",
      answer:
        "Sábado 19 de septiembre de 2026 en Rosario, Santa Fe. Acreditación 14:00–16:00, charla introductoria 16:00–16:30, captura válida 16:00–20:00, carga habilitada 16:00–22:00 (hora Argentina).",
    },
    {
      question: "¿Hasta cuándo puedo subir fotos?",
      answer:
        "Hasta las 22:00. Entre las 20:00 y las 22:00 ya no son válidas fotos nuevas tomadas fuera de la ventana de captura; sí podés seleccionar, revelar y cargar las tomadas entre 16:00 y 20:00.",
    },
    {
      question: "¿Qué pasa si la hora de mi cámara está mal?",
      answer: CAMERA_CLOCK_WARNING_ES,
    },
    {
      question: "¿Cuánto cuesta la inscripción?",
      answer:
        "El precio vigente lo define la fase activa (primera etapa: $25.000 ARS). Se confirma en el resumen antes de pagar.",
    },
    {
      question: "¿Incluye remera?",
      answer: ARGENTINA_2026_SHIRT_BENEFIT_COPY,
    },
    {
      question: "¿Cuántas consignas hay?",
      answer: `${ARGENTINA_2026_RULES.totalPrompts} consignas. Mínimo competitivo: ${ARGENTINA_2026_RULES.competitiveMinValidPrompts} obras válidas (con captura dentro de la ventana 16:00–20:00).`,
    },
    {
      question: "¿Dónde veo mi QR?",
      answer: "En Mi cuenta, una vez confirmada la inscripción y el pago.",
    },
  ];
}

export const ARGENTINA_2026_PUBLIC_META = {
  timezone: ARGENTINA_2026_TIMEZONE,
  termsVersion: CLICKATON_TERMS_VERSION,
  city: ARGENTINA_2026_PUBLIC_CITY,
  province: ARGENTINA_2026_PUBLIC_PROVINCE,
} as const;
