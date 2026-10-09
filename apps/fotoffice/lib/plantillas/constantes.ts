/** Canales por los que sale un mensaje. */
export const CANALES = ["EMAIL", "WHATSAPP"] as const;
export type Canal = (typeof CANALES)[number];

/**
 * Tipo de ficha de una plantilla. GENERAL sirve en cualquier ficha y sólo usa variables comunes.
 * PRESUPUESTO (etapa 2) no es una ficha: es el envío de un presupuesto, que sale desde la consulta
 * con las variables de la consulta más las del presupuesto (`[presupuesto_enlace]`, etc.).
 * PEDIDO (etapa 3) tampoco es una ficha: es el envío del enlace de un pedido o de un recibo, que
 * sale al contacto del pedido con las variables comunes más las del pedido (`[pedido_enlace]`, etc.).
 * CITA (etapa 4, Agenda) tampoco es una ficha: es el recordatorio automático de una cita al contacto
 * que participa, con las variables comunes más las de la cita (`[cita_titulo]`, `[cita_fecha]`, etc.).
 * CONTRATO (etapa 5) tampoco es una ficha: reserva el tipo de los correos automáticos de un contrato (envío,
 * código, recordatorio y firmado). Los textos de los contratos mismos NO viven acá: están en
 * `FotofficeContratoPlantilla` (Configuración → Contratos → Plantillas) y usan su propio catálogo de variables
 * (`lib/contratos/variables.ts`).
 */
export const TIPOS_PLANTILLA = ["GENERAL", "CLIENTE", "SOCIO", "CONSULTA", "PRESUPUESTO", "PEDIDO", "CITA", "CONTRATO"] as const;
export type TipoPlantilla = (typeof TIPOS_PLANTILLA)[number];

/** Estado de un mensaje en el registro (`FotofficeMessage.status`). */
export const ESTADOS_MENSAJE = ["SENT", "FAILED", "OPENED_WHATSAPP"] as const;
export type EstadoMensaje = (typeof ESTADOS_MENSAJE)[number];

/**
 * Claves de las plantillas automáticas (`FotofficeMessageTemplate.systemKey`).
 * - `CONSULTA_AUTORESPUESTA`: respuesta a quien consultó por el formulario público.
 * - `CONSULTA_AVISO_EQUIPO`: aviso interno al responsable de una consulta nueva (etapa 1). Va
 *   sólo a usuarios del equipo, con el remitente de FOTOFFICE: no se registra como mensaje de la
 *   ficha, no cuenta en ningún tope diario ni en la regla de una respuesta cada 24 h.
 * - `PRESUPUESTO_SEGUIMIENTO`: recordatorio a la persona de un presupuesto enviado que no
 *   respondió (etapa 2, Entrega B). Lo manda la tarea diaria `lib/presupuestos/seguimiento.ts`
 *   si la organización encendió el seguimiento en Configuración → Presupuestos.
 * - `RECIBO_DE_PAGO`: el recibo de un cobro registrado, al contacto del pedido (etapa 3). Nace
 *   encendido; sale después de registrar el cobro (`lib/pedidos/recibos.ts`) y nunca lo frena.
 * - `RECORDATORIO_CUOTA`: aviso al contacto del pedido de una cuota con saldo que vence pronto
 *   (etapa 3, Entrega B1). Lo manda la tarea diaria `lib/pedidos/recordatorios.ts` si la
 *   organización encendió los recordatorios en Configuración → Pedidos.
 * - `RECORDATORIO_CITA`: aviso a los contactos con correo que participan de una cita próxima (etapa 4,
 *   Agenda). Lo manda la tarea horaria `lib/agenda/recordatorios.ts` si la organización encendió el
 *   recordatorio en Configuración → Agenda (apagado por omisión).
 * - `CONTRATO_ENVIO`, `CONTRATO_CODIGO`, `CONTRATO_RECORDATORIO` y `CONTRATO_FIRMADO` (etapa 5, Contratos):
 *   los correos del circuito de firma a cada firmante (enlace, código de verificación, recordatorio y
 *   PDF firmado). Son transaccionales: sin el freno de 24 h por dirección, con el tope diario de
 *   automáticos. Los manda `lib/contratos/correos.ts`; el del código NO guarda el código en el registro.
 */
export const CLAVES_AUTOMATICO = [
  "CONSULTA_AUTORESPUESTA", "CONSULTA_AVISO_EQUIPO", "PRESUPUESTO_SEGUIMIENTO", "RECIBO_DE_PAGO", "RECORDATORIO_CUOTA", "RECORDATORIO_CITA",
  "CONTRATO_ENVIO", "CONTRATO_CODIGO", "CONTRATO_RECORDATORIO", "CONTRATO_FIRMADO",
] as const;
export type ClaveAutomatico = (typeof CLAVES_AUTOMATICO)[number];

export const ETIQUETA_CANAL: Record<Canal, string> = { EMAIL: "Correo", WHATSAPP: "WhatsApp" };
export const ETIQUETA_TIPO_PLANTILLA: Record<TipoPlantilla, string> = {
  GENERAL: "General",
  CLIENTE: "Cliente",
  SOCIO: "Socio",
  CONSULTA: "Consulta",
  PRESUPUESTO: "Presupuesto",
  PEDIDO: "Pedido",
  CITA: "Cita",
  CONTRATO: "Contrato",
};
export const ETIQUETA_ESTADO_MENSAJE: Record<EstadoMensaje, string> = {
  SENT: "Enviado",
  FAILED: "Falló",
  OPENED_WHATSAPP: "Abierto en WhatsApp",
};

export const MIN_NOMBRE_PLANTILLA = 1;
export const MAX_NOMBRE_PLANTILLA = 80;
export const MAX_ASUNTO = 200;
export const MAX_CUERPO: Record<Canal, number> = { EMAIL: 10_000, WHATSAPP: 4_000 };
/** Plantillas activas (no archivadas) por canal y organización. */
export const MAX_PLANTILLAS_ACTIVAS_POR_CANAL = 100;
/** Correos enviados a mano por día (de Buenos Aires) y organización. Los automáticos no cuentan acá. */
export const TOPE_CORREOS_DIA = 200;
/**
 * Correos automáticos por día (de Buenos Aires) y organización, aparte de los manuales: el
 * formulario público es abierto y alguien podría usarlo para disparar respuestas en masa.
 */
export const TOPE_AUTOMATICOS_DIA = 50;
/**
 * Avisos internos de consulta nueva al equipo (`CONSULTA_AVISO_EQUIPO`) por día (de Buenos Aires)
 * y organización. Tienen su propio tope: no cuentan en el de manuales ni en el de automáticos.
 * Pasado el tope sólo se crea la tarea "Responder consulta".
 */
export const TOPE_AVISOS_EQUIPO_DIA = 100;
/** Autor que figura en el registro de los avisos al equipo. */
export const AUTOR_AVISO_EQUIPO = "Aviso al equipo";
/**
 * Reserva de un envío automático todavía sin completar (`FotofficeMessage.errorCode`). Pasado
 * `VIDA_RESERVA_MS` se la da por abandonada (el proceso murió entre reservar y mandar): ya no
 * frena nada y no se muestra.
 */
export const CODIGO_ENVIO_EN_CURSO = "EN_CURSO";
export const VIDA_RESERVA_MS = 60 * 60 * 1000;
/** Una sola respuesta automática por dirección de correo y organización en este lapso. */
export const VENTANA_UNA_AUTORESPUESTA_MS = 24 * 60 * 60 * 1000;

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

/** Clave de la variable de firma. */
export const CLAVE_FIRMA = "firma";
/**
 * Lo que deja `completar` donde iba `[firma]`. Lo reemplaza el render (HTML o texto) sin escaparlo.
 * Usa un carácter de uso privado (U+E000) que `completar` borra de todo lo demás, así nadie lo falsifica.
 */
export const CARACTER_MARCADOR = "";
export const MARCADOR_FIRMA = `${CARACTER_MARCADOR}firma${CARACTER_MARCADOR}`;
