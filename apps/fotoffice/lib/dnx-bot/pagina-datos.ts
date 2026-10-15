import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/content";
import { DIAS_DE_RETENCION } from "./limpieza";

/**
 * «Cómo cuidamos tus datos» (/ayuda/dnx-bot-datos), el enlace del aviso de privacidad de DNX Bot.
 * Cada punto está verificado contra el código (ver pagina-datos.test.ts):
 * - la conversación se guarda en `BotConversation`/`BotMessage` del workspace y no hay ninguna
 *   pantalla que la muestre a otra persona (ni del estudio, ni de la plataforma);
 * - el perfil de precios se lee y se guarda sólo con `configurar` (dueño y administradores);
 * - los presupuestos siguen los permisos de Presupuestos y al cliente nunca le llegan los costos
 *   (`itemSinDatosInternos`);
 * - del cliente al modelo va el nombre de pila y el mensaje redactado (`redactar.ts`);
 * - las escrituras pasan por «Confirmar» y no hay herramienta de envío (`arquitectura.test.ts`);
 * - la limpieza a 90 días corre en `/api/cron/adjuntos` (`limpieza.ts`).
 */
export const TITULO_DATOS = "Cómo cuidamos tus datos";

export const INTRO_DATOS =
  "DNX Bot te ayuda a calcular cuánto cobrar y a armar tus presupuestos. Esto es lo que pasa con lo que le contás.";

export const SECCIONES_DATOS: readonly { titulo: string; puntos: readonly string[] }[] = [
  {
    titulo: "Qué se guarda",
    puntos: [
      "La conversación con el bot queda guardada en la cuenta de tu estudio en FOTOFFICE.",
      "Lo que confirmás con el bot —tu perfil de precios, los presupuestos que arma— queda en tu estudio, igual que si lo cargaras a mano.",
    ],
  },
  {
    titulo: "Quién lo ve",
    puntos: [
      "La conversación: sólo vos. No hay ninguna pantalla donde otra persona la pueda leer, ni siquiera alguien de tu estudio.",
      "Tu perfil de precios: vos, y el dueño y los administradores de tu estudio.",
      "Los presupuestos: las personas de tu estudio con permiso en Presupuestos. Tu cliente ve un presupuesto sólo cuando vos se lo enviás, y nunca ve tus costos ni tu ganancia.",
      "No lo ven otros fotógrafos ni otros estudios que usan FOTOFFICE.",
      "El equipo de DNX lo mira sólo si nos pedís ayuda.",
    ],
  },
  {
    titulo: "Quién procesa lo que escribís",
    puntos: [
      "Para contestarte, el bot usa la inteligencia artificial de Anthropic (Claude). Anthropic recibe el texto de la conversación para responder y, según las condiciones del servicio que contratamos, no lo usa para entrenar sus modelos.",
    ],
  },
  {
    titulo: "Los datos de tus clientes",
    puntos: [
      "Del cliente, al bot sólo le llega el nombre de pila. Si el mensaje de una consulta trae un correo, un teléfono, un DNI o un enlace, se tapan antes de mandarlo.",
      "Lo que escribas vos en el chat sí le llega tal cual: no hace falta que pongas datos de contacto de nadie.",
    ],
  },
  {
    titulo: "Nada sin tu confirmación",
    puntos: [
      "El bot no guarda ni cambia nada hasta que tocás «Confirmar».",
      "Nunca le manda mensajes a tus clientes: te deja el texto listo y lo enviás vos, desde la pantalla de siempre.",
    ],
  },
  {
    titulo: "Cuándo se borra",
    puntos: [
      `Las conversaciones se borran solas después de ${DIAS_DE_RETENCION} días sin actividad.`,
      `Si querés que las borremos antes, escribinos a ${LEGAL_CONTACT_EMAIL}.`,
    ],
  },
];
