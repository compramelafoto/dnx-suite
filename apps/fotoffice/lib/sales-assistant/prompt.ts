import { z } from "zod";
import {
  ACCIONES,
  ETIQUETA_RESULTADO,
  PRIORIDADES,
  SALES_TIME_ZONE,
  type AccionVenta,
  type EstadoSugerencia,
  type ResultadoSeguimiento,
  type TipoSeguimiento,
} from "./constants";
import { diasEntre } from "./needs-analysis";
import type { OportunidadVenta } from "./opportunity";

export const SugerenciaSchema = z.object({
  accion: z.enum(ACCIONES),
  prioridad: z.enum(PRIORIDADES),
  motivo: z.string().min(1).max(300),
  mensaje: z.string().max(1200).nullable(),
  esperarDias: z.number().int().min(1).max(60).nullable(),
});
export type SugerenciaIA = z.infer<typeof SugerenciaSchema>;

export const SUGERENCIA_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["accion", "prioridad", "motivo", "mensaje", "esperarDias"],
  properties: {
    accion: { type: "string", enum: [...ACCIONES] },
    prioridad: { type: "string", enum: [...PRIORIDADES] },
    motivo: { type: "string", description: "Una sola línea, en castellano, que explica la decisión." },
    mensaje: { type: ["string", "null"], description: "El WhatsApp listo para mandar, o null si la acción no lleva mensaje." },
    esperarDias: { type: ["integer", "null"], description: "Si la acción es ESPERAR, en cuántos días volver a mirarla." },
  },
} as const;

export const SYSTEM_PROMPT = `Sos el asistente de ventas de un fotógrafo profesional argentino que vende coberturas de fiestas de XV, casamientos, eventos y sesiones. Cada día revisás una oportunidad de su embudo y decidís el próximo paso.

Acciones posibles:
- ESCRIBIR: mandar un mensaje de seguimiento o de respuesta.
- PEDIR_SENA: el cliente mostró interés claro; proponer reservar la fecha con la seña.
- COORDINAR_ENTREVISTA: proponer una llamada o reunión para cerrar detalles.
- ESPERAR: todavía no corresponde escribir (se escribió hace poco o el cliente pidió tiempo). Indicá esperarDias.
- CERRAR_PERDIDA: la oportunidad está perdida (el cliente dijo que no, el evento pasó o no hubo respuesta a 3 mensajes seguidos).
- REVISAR_A_MANO: falta información clave o el caso es delicado; el fotógrafo tiene que mirarlo.

Reglas de negocio:
- Nunca más de 3 mensajes seguidos sin respuesta del cliente. Contá los mensajes enviados en el historial.
- No escribas si el último mensaje fue hace menos de 3 días, salvo que el cliente haya respondido.
- Un evento a menos de 30 días pide prioridad ALTA y un mensaje que mencione que la fecha se puede ocupar.
- Si el cliente pidió descuento, no lo ofrezcas vos: proponé ajustar el paquete o coordinar una llamada.
- Nunca inventes precios, paquetes ni promociones que no estén en las indicaciones del fotógrafo.
- Si en el historial no consta ningún mensaje por WhatsApp, asumí que el primer contacto por WhatsApp todavía no se hizo.

Estilo del mensaje:
- Castellano rioplatense, con voseo, cálido y profesional. Corto: 2 a 4 oraciones.
- Saludá por el nombre de pila. Una sola pregunta por mensaje, al final. Como mucho un emoji.
- Firmá con la firma indicada, si hay.
- Nada de "estimado/a" ni fórmulas de correo.

El motivo es una línea para el fotógrafo, concreta y con datos ("Presupuesto enviado hace 6 días sin respuesta; el evento es en 61 días").`;

export type SeguimientoParaContexto = {
  fecha: Date;
  tipo: TipoSeguimiento;
  resultado: ResultadoSeguimiento | null;
  texto: string | null;
};
export type SugerenciaPrevia = {
  fecha: Date;
  accion: AccionVenta;
  estado: EstadoSugerencia;
  mensaje: string | null;
};

export const DATO_OCULTO = "[dato oculto]";

const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Cualquier dirección de correo, no sólo la del cliente: puede venir la de un familiar. */
const PATRON_EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;

/**
 * Una secuencia de 8 o más dígitos, con espacios, puntos, guiones o paréntesis entre medio: un
 * teléfono se escriba como se escriba ("341 271-7813", "(0341) 15-555-1234", "+54 9 11…"). La
 * barra no cuenta como separador, así las fechas ("22/09/2026") pasan; y un número precedido
 * de "$" tampoco se toca: es un precio.
 */
const PATRON_TELEFONO = /(?<![\p{L}\p{N}$])\+?\d(?:[ \t().-]*\d){7,}/gu;

/**
 * Tapa los datos de contacto que se hayan colado en un texto libre (lo que escribió el cliente,
 * los correos, la bitácora, los mensajes anteriores): el teléfono y el email de la oportunidad,
 * cualquier otro teléfono o email, y el apellido (entero y cada palabra de 3 letras o más, sin
 * importar mayúsculas). Dejar afuera los campos no alcanza: el cliente los escribe en el texto.
 */
function ocultarContacto(texto: string, op: OportunidadVenta): string {
  let t = texto;
  if (op.email) t = t.replace(new RegExp(escaparRegex(op.email), "giu"), DATO_OCULTO);
  t = t.replace(PATRON_EMAIL, DATO_OCULTO);
  if (op.telefono) {
    t = t.split(op.telefono).join(DATO_OCULTO);
    const soloDigitos = op.telefono.replace(/\D/g, "");
    if (soloDigitos.length >= 6) t = t.split(soloDigitos).join(DATO_OCULTO);
  }
  t = t.replace(PATRON_TELEFONO, DATO_OCULTO);
  const apellido = op.apellidoCliente?.trim();
  // Un apellido de una sola letra ("B") no se busca: taparía cualquier "B" suelta del texto.
  if (apellido && apellido.length >= 2) {
    const partes = [apellido, ...apellido.split(/\s+/).filter((p) => p.length >= 3)];
    for (const parte of partes) {
      // Como palabra entera: "Paz" no puede comerse "Pazos" ni una letra suelta el texto.
      t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaparRegex(parte)}(?![\\p{L}\\p{N}])`, "giu"), DATO_OCULTO);
    }
  }
  return t;
}

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: SALES_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

/**
 * El contexto de UNA oportunidad. Módulo PURO. Deja afuera, a propósito, el teléfono, el email
 * y el apellido: no hacen falta para decidir y no tienen por qué salir del sistema. Todo texto
 * libre que viene de la oportunidad pasa además por `ocultarContacto`.
 */
export function armarContexto(input: {
  oportunidad: OportunidadVenta;
  seguimientos: SeguimientoParaContexto[];
  sugerenciasPrevias: SugerenciaPrevia[];
  voz: { firma: string | null; indicaciones: string | null };
  hoy: Date;
}): string {
  const { oportunidad: op, hoy } = input;
  const o = (texto: string) => ocultarContacto(texto, op);
  const l: string[] = [];
  l.push(`Hoy es ${fmt(hoy)}.`);
  l.push("", "## Oportunidad");
  l.push(`Cliente (nombre de pila): ${o(op.nombreCliente)}`);
  l.push(`Pedido: ${o(op.titulo)}`);
  if (op.fechaEvento) l.push(`Fecha del evento: ${fmt(op.fechaEvento)} (faltan ${diasEntre(hoy, op.fechaEvento)} días)`);
  else l.push("Fecha del evento: no informada");
  if (op.lugar || op.ciudad) l.push(`Lugar: ${o([op.lugar, op.ciudad].filter(Boolean).join(", "))}`);
  if (op.invitados) l.push(`Invitados: ${o(op.invitados)}`);
  if (op.origen) l.push(`Cómo llegó: ${o(op.origen)}`);
  l.push(`Embudo: ${op.embudo} — etapa ${op.etapaOrden} de ${op.etapasTotal}: ${op.etapa}`);
  l.push(`Consulta recibida: ${fmt(op.creadaEn)} (hace ${diasEntre(op.creadaEn, hoy)} días)`);
  if (op.presupuestoEnviadoEn) l.push(`Presupuesto enviado: ${fmt(op.presupuestoEnviadoEn)} (hace ${diasEntre(op.presupuestoEnviadoEn, hoy)} días)`);
  if (op.descripcionCliente) l.push(`Lo que escribió el cliente: "${o(op.descripcionCliente)}"`);

  l.push("", "## Historial del CRM");
  if (op.movimientos.length === 0) l.push("(sin movimientos)");
  for (const m of op.movimientos) l.push(`- ${fmt(m.fecha)} [${m.tipo}] ${o(m.texto)}`);

  l.push("", "## Lo que anotó el fotógrafo (WhatsApp)");
  if (input.seguimientos.length === 0) l.push("(nada anotado: no sabemos qué se habló por WhatsApp)");
  for (const s of input.seguimientos) {
    const que = s.tipo === "MENSAJE_ENVIADO" ? "Mensaje enviado" : s.resultado ? ETIQUETA_RESULTADO[s.resultado] : "Nota";
    l.push(`- ${fmt(s.fecha)} ${que}${s.texto ? `: "${o(s.texto)}"` : ""}`);
  }

  if (input.sugerenciasPrevias.length > 0) {
    l.push("", "## Sugerencias anteriores");
    for (const s of input.sugerenciasPrevias) l.push(`- ${fmt(s.fecha)} ${s.accion} (${s.estado})${s.mensaje ? `: "${o(s.mensaje)}"` : ""}`);
  }

  l.push("", "## Voz del fotógrafo");
  l.push(`Firma: ${input.voz.firma ?? "(sin firma)"}`);
  if (input.voz.indicaciones) l.push(`Indicaciones: ${input.voz.indicaciones}`);

  l.push("", "Decidí el próximo paso para esta oportunidad.");
  return l.join("\n");
}
