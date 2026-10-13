import "server-only";
import { incidentSignature, sendTelegramMessage } from "@repo/dnx-bot";
import { leerConfigBot, PLATAFORMA_GLOBAL } from "./config";
import { diaArgentino } from "./dia-argentino";
import { liberarMarca, registrarIncidente, reservarMarca } from "./store";

/**
 * Incidentes de DNX Bot en FOTOFFICE (spec §11). Se guardan en `BotIncident` con la plataforma del
 * workspace; los urgentes y nuevos avisan por Telegram con «FOTOFFICE» adelante. El detalle sólo
 * lleva códigos y mensajes de error: nunca datos de clientes ni del perfil de precios.
 */

/** Tope de avisos urgentes por Telegram por proceso y hora: pasado el tope, queda sólo en la base. */
export const MAX_AVISOS_POR_HORA = 5;
const HORA_MS = 60 * 60 * 1000;
let avisos: number[] = [];

function tomarCupo(ahora = Date.now()): boolean {
  avisos = avisos.filter((t) => ahora - t < HORA_MS);
  if (avisos.length >= MAX_AVISOS_POR_HORA) return false;
  avisos.push(ahora);
  return true;
}

/** Sólo para pruebas. */
export function reiniciarCupoDeAvisos(): void {
  avisos = [];
}

export async function reportarIncidente(p: {
  plataforma: string;
  area: string;
  codigo: string;
  ids: Record<string, string | number>;
  detalle: string;
  urgente: boolean;
}): Promise<void> {
  const r = await registrarIncidente({
    plataforma: p.plataforma,
    signature: incidentSignature({ area: p.area, codigo: p.codigo }),
    title: `${p.area}: ${p.codigo}`,
    data: { ids: p.ids, detalle: p.detalle.slice(0, 500) },
    urgent: p.urgente,
  });
  if (p.urgente && r.isNew && tomarCupo()) {
    await sendTelegramMessage(leerConfigBot().telegram, `🐞 FOTOFFICE · Error nuevo de DNX Bot en ${p.area}: ${p.codigo}\n${p.detalle.slice(0, 300)}`);
  }
}

/**
 * El interruptor está prendido pero falta `ANTHROPIC_API_KEY`: el bot queda apagado sin decirle nada
 * a la persona, y llega un aviso por día (marca única en "FOTOFFICE"). Nunca lanza.
 */
export async function avisarSinClave(ahora: Date = new Date()): Promise<void> {
  try {
    const telegram = leerConfigBot().telegram;
    if (!telegram) return;
    const signature = `sin-clave-${diaArgentino(ahora)}`;
    const mia = await reservarMarca({ plataforma: PLATAFORMA_GLOBAL, signature, title: "Falta ANTHROPIC_API_KEY", data: {} });
    if (!mia) return;
    const r = await sendTelegramMessage(
      telegram,
      "🔑 FOTOFFICE · DNX Bot está prendido (FOTOFFICE_BOT_ENABLED=1) pero falta ANTHROPIC_API_KEY: queda apagado hasta cargarla.",
    );
    if (!r.ok) {
      console.error("[dnx-bot] aviso sin clave sin enviar", r.error);
      await liberarMarca({ plataforma: PLATAFORMA_GLOBAL, signature });
    }
  } catch (e) {
    console.error("[dnx-bot] aviso sin clave", e);
  }
}

/**
 * El texto del bot tuvo una cifra que no salió del cálculo ni de la persona (spec §5.4). Una firma
 * por workspace y día; al tercer caso del día, aviso por Telegram. Sólo la cantidad: nunca las
 * cifras (pueden ser gastos personales del perfil).
 */
export async function reportarCifraNoRespaldada(p: {
  plataforma: string;
  ids: Record<string, string | number>;
  cantidad: number;
  ahora?: Date;
}): Promise<void> {
  const dia = diaArgentino(p.ahora ?? new Date());
  const r = await registrarIncidente({
    plataforma: p.plataforma,
    signature: incidentSignature({ area: "cifras", codigo: "cifra_no_respaldada", dia }),
    title: `cifras: cifra_no_respaldada (${dia})`,
    data: { ids: p.ids, cantidad: p.cantidad },
    urgent: false,
  });
  if (r.occurrences === 3 && tomarCupo()) {
    await sendTelegramMessage(
      leerConfigBot().telegram,
      `⚠️ FOTOFFICE · DNX Bot escribió hoy por tercera vez una cifra que no salió del cálculo (${p.plataforma}). Revisar las conversaciones.`,
    );
  }
}
