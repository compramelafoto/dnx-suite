import type { ReadinessResult } from "@/lib/readiness/domain/readiness";

/** Una sola fuente para la ruta: la usan el mail y la propia página. */
export function readinessPath(
  editionSlug: string,
  registrationId: string,
  token: string,
): string {
  return `/maratones/${editionSlug}/preparate/${registrationId}?t=${encodeURIComponent(token)}`;
}

/** Cuánto vive el enlace del mail. El evento es el 12/12/2026. */
export const READINESS_TOKEN_TTL_MS = 120 * 24 * 60 * 60 * 1000;

type ReadinessResultCopy = {
  /** Título corto: qué pasó. */
  title: string;
  /** Qué hacer al respecto, en un lenguaje que no da nada técnico por sentado. */
  whatToDo: string;
};

/**
 * Todo el texto que lee el participante en la pantalla "Preparate": el título
 * y la explicación de la pantalla, el pedido de sacar la foto ahora, el
 * párrafo del mail y un mensaje por cada resultado posible del chequeo.
 *
 * Vive en un solo lugar porque lo consumen tres cosas — el mail, la propia
 * pantalla y el componente que muestra el resultado — y escrito tres veces,
 * diverge.
 *
 * Nota sobre `results.CLOCK_OFF`: el mensaje es general a propósito. Cuántos
 * minutos está corrido el reloj es un dato de cada intento
 * (`clockDeltaMinutes` en `ReadinessVerdict`, tarea 1), no un texto fijo, así
 * que quien muestre este resultado tiene que mostrar ese número junto a este
 * mensaje.
 */
export const readinessCopy = {
  title: "Probá tu teléfono antes de la Clickatón",

  intro:
    "Al final de la jornada armamos tu Clickatón: el mapa de tu recorrido, tus kilómetros y tus fotos. Para armarlo necesitamos que cada foto tenga bien puestos el lugar y la hora en que la sacaste. Este chequeo tarda un minuto y te dice si tu teléfono ya está listo.",

  takePhotoNow:
    "Sacá la foto ahora mismo, no elijas una vieja de tu galería. El chequeo del reloj compara el momento en que se sacó la foto contra la hora real: con una foto de otro día no vamos a poder decirte nada.",

  /** El párrafo que va en el mail de confirmación. */
  emailParagraph:
    "Antes de la Clickatón conviene que revises una cosa: que tu teléfono guarde el lugar donde sacás cada foto. Te lleva un minuto y de eso depende el resumen de tu recorrido al final de la jornada.",

  results: {
    READY: {
      title: "Todo listo",
      whatToDo:
        "Tu teléfono guarda la ubicación en cada foto y tiene la hora bien puesta. No tenés que hacer nada más antes de la Clickatón.",
    },
    NO_GPS: {
      title: "Tus fotos salen sin ubicación",
      whatToDo:
        "Hay que encender el geoetiquetado — que tu teléfono guarde en cada foto el lugar donde la sacaste — y volver a probar. Mirá las instrucciones de tu sistema acá abajo.",
    },
    CLOCK_OFF: {
      title: "El reloj no está en hora",
      whatToDo:
        "El reloj de tu teléfono no coincide con la hora real. Activá la hora automática en los ajustes de fecha y hora: el día de la Clickatón, la hora de cada foto decide si vale o no.",
    },
    TOO_SMALL: {
      title: "La foto es más chica de lo que acepta el concurso",
      whatToDo:
        "Revisá la calidad configurada en tu cámara y elegí la opción de mayor resolución. Después sacá una foto nueva y volvé a probar.",
    },
    NO_CAPTURE_DATE: {
      title: "La foto no trae la hora en que se sacó",
      whatToDo:
        "Esto pasa seguido con fotos descargadas o reenviadas por WhatsApp u otra app de mensajería: pierden esa información en el camino. Sacá una foto nueva directamente con la cámara y volvé a probar.",
    },
    FAILED: {
      title: "No pudimos leer la foto",
      whatToDo: "Probá de nuevo con otra foto, sacada directamente con la cámara.",
    },
  } satisfies Record<ReadinessResult, ReadinessResultCopy>,

  /** Textos del componente que mide la foto (`ReadinessCheckCard`). */
  check: {
    takePhotoButtonLabel: "Sacar la foto ahora",
    measuring: "Midiendo tu foto…",
    retry: "Probar de nuevo",
    lastCheckLabel: "Resultado de tu última prueba",
    readError:
      "No pudimos leer esa foto. Probá de nuevo, sacándola directamente con la cámara.",
    /** `submitReadinessCheckAction`: faltó algún campo del `FormData`. */
    missingDataMessage: "Faltan datos para completar el chequeo.",
    /** `submitReadinessCheckAction`: el token no es de propósito "readiness", o venció. */
    invalidTokenMessage: "El enlace no es válido o venció.",
    /** `submitReadinessCheckAction`: la inscripción no existe o no es de esa edición. */
    registrationNotFoundMessage: "No encontramos esa inscripción.",
  },

  /** Textos del pedido de permiso de ubicación (`LocationPermissionCard`). */
  locationPermission: {
    title: "Permiso de ubicación del navegador",
    needsConsentFirst:
      "Antes de pedir este permiso hace falta que autorices el uso de tu ubicación.",
    goToAccountLabel: "Ir a Mi cuenta",
    askButtonLabel: "Dar permiso de ubicación",
    asking: "Pidiendo el permiso…",
    granted:
      "Listo: el navegador ya tiene permiso para ubicar tu recorrido en este teléfono.",
    denied:
      "No diste el permiso. Podés habilitarlo más adelante desde los ajustes del sitio en tu navegador: es opcional y tu inscripción no depende de esto.",
  },

  /** El enlace venció (meses de anticipación: el mail llega mucho antes del evento). */
  expiredLink: {
    title: "Este enlace venció",
    whatToDo:
      "Los enlaces para probar el teléfono tienen un plazo. Podés pedir uno nuevo desde Mi cuenta, dentro del detalle de tu inscripción.",
    goToAccountLabel: "Ir a Mi cuenta",
    backToEditionLabel: "Volver a la maratón",
  },
};

/**
 * El mensaje del reloj desfasado es dinámico (`clockDeltaMinutes` de
 * `ReadinessVerdict`, tarea 1): no puede vivir como texto fijo en
 * `results.CLOCK_OFF`. Se arma acá, en una sola frase, para anteponerla al
 * texto genérico en vez de mostrar dos mensajes sueltos.
 */
export function clockDeltaLeadIn(deltaMinutes: number): string {
  const minutos = Math.abs(Math.round(deltaMinutes));
  const direccion = deltaMinutes < 0 ? "atrasado" : "adelantado";
  return `Va ${minutos} ${minutos === 1 ? "minuto" : "minutos"} ${direccion}.`;
}
