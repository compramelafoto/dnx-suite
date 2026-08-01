/**
 * FAQ del funnel de inscripción — Clickatón Argentina 2026.
 * Fuente de verdad: Bases y Condiciones v2 + hechos públicos de la edición.
 * No inventa políticas: alinear con `legal-funnel.ts` y `argentina-2026*.ts`.
 */
import {
  ARGENTINA_2026_MERCH,
  ARGENTINA_2026_RULES,
  ARGENTINA_2026_SCHEDULE,
  CAMERA_CLOCK_WARNING_ES,
} from "@/config/editions/argentina-2026";
import {
  ARGENTINA_2026_PUBLIC_CITY,
  ARGENTINA_2026_PUBLIC_PROVINCE,
  ARGENTINA_2026_PUBLIC_VENUE_NAME,
} from "@/config/editions/argentina-2026-public-facts";
import { ARGENTINA_2026_SHIRT_BENEFIT_COPY } from "@/lib/catalog/domain/first-n-benefit";

const eventDay = "sábado 19 de septiembre de 2026";
const captureWindow = "16:00 y las 20:00";
const uploadClose = "22:00";

export const registrationExperienceFaq = {
  title: "Preguntas frecuentes",
  items: [
    {
      question: "¿Cuándo y dónde es esta edición?",
      answer: `Clickatón Argentina 2026 es el ${eventDay} en ${ARGENTINA_2026_PUBLIC_CITY}, ${ARGENTINA_2026_PUBLIC_PROVINCE}. Acreditación de 14:00 a 16:00 en ${ARGENTINA_2026_PUBLIC_VENUE_NAME}. Charla introductoria 16:00–16:30. Captura válida ${captureWindow}; carga habilitada hasta las ${uploadClose} (hora Argentina).`,
    },
    {
      question: "¿Puedo participar con celular?",
      answer: `Sí. Podés fotografiar con celular u otro dispositivo admitido, siempre que las fotos se tomen dentro de la ventana válida de captura (${captureWindow}, hora Argentina) y cumplan las Bases de esta edición. Verificá la fecha y hora del dispositivo antes del evento: la organización puede controlar el horario por metadatos.`,
    },
    {
      question: "¿Necesito experiencia previa?",
      answer: `No. La edición está pensada para distintos niveles. Hay ${ARGENTINA_2026_RULES.totalPrompts} consignas (1 foto por consigna). Para competir necesitás al menos ${ARGENTINA_2026_RULES.competitiveMinValidPrompts} obras válidas tomadas dentro de la ventana de captura.`,
    },
    {
      question: "¿Cómo y hasta cuándo entrego las fotografías?",
      answer: `El día del evento elegís y subís tus imágenes por la plataforma. La carga está habilitada desde las 16:00 hasta las ${uploadClose}. Entre las 20:00 y las ${uploadClose} ya no son válidas fotos nuevas tomadas fuera de la ventana de captura: sí podés seleccionar, revelar y cargar las tomadas entre las ${captureWindow}. A las ${uploadClose} se cierra la entrega.`,
    },
    {
      question: "¿Qué pasa si la hora de mi cámara o celular está mal?",
      answer: CAMERA_CLOCK_WARNING_ES,
    },
    {
      question: "¿Incluye remera de regalo?",
      answer: ARGENTINA_2026_SHIRT_BENEFIT_COPY,
    },
    {
      question: "¿Qué pasa si llueve o hay mal tiempo?",
      answer:
        "El mal tiempo no cancela automáticamente el evento. Si hace falta ajustar la operación por clima, seguridad u otras razones, la organización lo comunica por los canales oficiales. Revisá también las Bases y los avisos del día.",
    },
    {
      question: "¿Cuánto cuesta y puedo pedir devolución?",
      answer: `El precio es el de la fase vigente al momento del pago (primera etapa: $${(ARGENTINA_2026_MERCH.ticketPricePesos).toLocaleString("es-AR")} ARS). Lo ves confirmado en el resumen antes de pagar. Salvo obligación legal en contrario, la inscripción paga confirmada no es reembolsable por desistimiento unilateral. Si el organizador cancela o reprograma, se informa la opción aplicable por canales oficiales.`,
    },
    {
      question: "¿Dónde veo mi QR y mi credencial?",
      answer:
        "Cuando el pago esté confirmado, tu QR y credencial digitales quedan en Mi cuenta. El QR es personal e intransferible y se usa para la acreditación en sede.",
    },
  ],
} as const;

/** Referencia del cronograma canónico (evita drift silencioso en docs). */
export const registrationExperienceFaqScheduleRef = {
  eventDateLocal: ARGENTINA_2026_SCHEDULE.eventDateLocal,
  captureOpenIso: ARGENTINA_2026_SCHEDULE.captureOpenIso,
  captureCloseIso: ARGENTINA_2026_SCHEDULE.captureCloseIso,
  uploadCloseIso: ARGENTINA_2026_SCHEDULE.uploadCloseIso,
} as const;
