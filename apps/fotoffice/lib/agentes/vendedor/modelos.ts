import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, prisma } from "@repo/db";
import type { sendTransactionalEmail } from "@/lib/communications/send-email";
import type { DepsTelegramApi } from "@/lib/telegram/api";
import { cambiarBotones, destinoAgentes, mandarMensaje } from "../canal";
import type { DepsClaude } from "../claude";
import { escaparHtml } from "../periodista/mensaje";
import { inicioDelDiaArgentino } from "../periodista/horario";
import { anotarGasto, leerAjustesVendedor, puedeGastar } from "./ajustes";
import { sigueApto } from "./aptos";
import { tecladoModelo, tecladoRespuesta, type AccionVendedor } from "./botones";
import { leerConocimiento } from "./clf";
import { reenviarADaniel, responder } from "./entrante";
import { mensajeEsperaDaniel, mensajeModelo } from "./mensajes";
import { datosParaPrompt } from "./prompts";
import { clasificarYResponder, redactarModelo } from "./redactor";
import { CASILLA_DANIEL, GRUPOS, GRUPOS_DE_CLUBES, ROTULO_GRUPO, type Grupo } from "./tipos";

/**
 * Los modelos del primer correo de cada grupo y los botones de Telegram del Vendedor.
 *
 * - Un grupo tiene a lo sumo un modelo PROPUESTO y uno vigente (APROBADO sin `reemplazadoEn`); los dos
 *   los cuidan índices únicos parciales en la base. Mientras el nuevo está propuesto, sigue vigente el
 *   anterior; al aprobar el nuevo, el anterior queda reemplazado.
 * - Cada paso que cambia un estado lo hace con un `updateMany` condicional: un botón tocado dos veces
 *   (o un aviso repetido de Telegram) no hace nada la segunda vez.
 * - Los modelos de clubes y organizadores de eventos no se proponen ni se aprueban mientras la página
 *   /clubes de CLF no esté publicada.
 */

export const MAX_CORRECCIONES_VENDEDOR = 5;
/** Tiempo que se le da a Claude para redactar o corregir, si quien llama no pone un `hasta`. */
const PLAZO_CLAUDE_MS = 120_000;

export type DnxVendedorModelo = NonNullable<Awaited<ReturnType<typeof prisma.dnxVendedorModelo.findFirst>>>;

export type DepsModelos = {
  ahora?: () => Date;
  claude?: DepsClaude;
  enviar?: typeof sendTransactionalEmail;
  telegram?: DepsTelegramApi;
  /** Instante (ms) hasta el que puede esperar a Claude. */
  hasta?: number;
};

type Resultado = { ok: boolean; texto: string };

const esGrupo = (g: string): g is Grupo => (GRUPOS as readonly string[]).includes(g);
const rotulo = (g: string) => (esGrupo(g) ? ROTULO_GRUPO[g] : g);
const ahoraDe = (deps: DepsModelos) => (deps.ahora ?? (() => new Date()))();
const hastaDe = (deps: DepsModelos) => deps.hasta ?? Date.now() + PLAZO_CLAUDE_MS;
const sinPaginaDeClubes = (grupo: string, publicada: boolean) => !publicada && (GRUPOS_DE_CLUBES as readonly string[]).includes(grupo);

const TEXTO_CLUBES_SIN_PAGINA = "La página de clubes todavía no está publicada: este modelo no se puede aprobar hasta que la publiques.";

const SELECCION_CONTACTO = { id: true, nombre: true, ciudad: true, provincia: true, tipo: true, nichos: true, web: true } as const;

function esUnicoRepetido(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

export function modeloVigente(grupo: Grupo): Promise<DnxVendedorModelo | null> {
  return prisma.dnxVendedorModelo.findFirst({ where: { grupo, estado: "APROBADO", reemplazadoEn: null } });
}

// --- Proponer ---------------------------------------------------------------------------------

export type MotivoSinPropuesta = "YA_HAY_PROPUESTO" | "CLUBES_SIN_PAGINA" | "YA_PROPUESTO_HOY" | "TOPE" | "SIN_CONOCIMIENTO" | "CLAUDE" | "SIN_TELEGRAM";

/**
 * Redacta con Claude el modelo de un grupo a partir de un contacto de ejemplo y se lo manda a Daniel
 * por Telegram con Aprobar / Corregir / Descartar. Un grupo se propone a lo sumo una vez por día
 * argentino (si Daniel lo descartó, el próximo sale mañana).
 */
export async function proponerModelo(
  grupo: Grupo,
  contactoId: string,
  deps: DepsModelos = {},
): Promise<{ ok: true; modeloId: string } | { ok: false; motivo: MotivoSinPropuesta }> {
  const ahora = ahoraDe(deps);
  const ajustes = await leerAjustesVendedor();
  if (sinPaginaDeClubes(grupo, ajustes.paginaClubesPublicada)) return { ok: false, motivo: "CLUBES_SIN_PAGINA" };
  const propuesto = await prisma.dnxVendedorModelo.findFirst({ where: { grupo, estado: "PROPUESTO" }, select: { id: true } });
  if (propuesto) return { ok: false, motivo: "YA_HAY_PROPUESTO" };
  const deHoy = await prisma.dnxVendedorModelo.findFirst({ where: { grupo, creadoEn: { gte: inicioDelDiaArgentino(ahora) } }, select: { id: true } });
  if (deHoy) return { ok: false, motivo: "YA_PROPUESTO_HOY" };

  const gasto = await puedeGastar(ahora);
  if (!gasto.ok) return { ok: false, motivo: "TOPE" };
  const conocimiento = await leerConocimiento();
  if (!conocimiento) return { ok: false, motivo: "SIN_CONOCIMIENTO" };
  const destino = await destinoAgentes();
  if (!destino) return { ok: false, motivo: "SIN_TELEGRAM" };
  const contacto = await prisma.dnxContacto.findUnique({ where: { id: contactoId }, select: SELECCION_CONTACTO });
  if (!contacto) throw new Error("Vendedor: el contacto de ejemplo del modelo no existe");

  const r = await redactarModelo({ grupo, contacto: datosParaPrompt(contacto), conocimiento: conocimiento.texto }, { ...deps.claude, hasta: hastaDe(deps) });
  if (!r.ok) {
    await anotarGasto({ usd: r.uso.costoUsd ?? 0, motivo: "MODELO" });
    return { ok: false, motivo: "CLAUDE" };
  }
  const v = r.valor;
  let modeloId: string;
  try {
    const m = await prisma.dnxVendedorModelo.create({
      data: { grupo, estado: "PROPUESTO", asunto: v.asunto, cuerpo: v.cuerpo, indicaciones: v.indicaciones, landing: v.landing, contactoEjemploId: contacto.id, creadoEn: ahora },
      select: { id: true },
    });
    modeloId = m.id;
  } catch (e) {
    await anotarGasto({ usd: r.uso.costoUsd ?? 0, motivo: "MODELO" });
    // Otro proceso propuso el mismo grupo mientras Claude redactaba: gana el primero.
    if (esUnicoRepetido(e)) return { ok: false, motivo: "YA_HAY_PROPUESTO" };
    throw e;
  }
  await anotarGasto({ usd: r.uso.costoUsd ?? 0, motivo: "MODELO", modeloId });

  const html = mensajeModelo({ grupo: rotulo(grupo), contacto, asunto: v.asunto, cuerpo: v.cuerpo, landing: v.landing, indicaciones: v.indicaciones });
  const enviado = await mandarMensaje(destino.token, destino.chatId, html, tecladoModelo(modeloId), deps.telegram ?? {}).catch(() => null);
  if (!enviado?.ok) {
    // Sin mensaje nadie puede aprobarlo: se descarta para no trabar el grupo, y mañana se propone de nuevo.
    await prisma.dnxVendedorModelo.updateMany({ where: { id: modeloId, estado: "PROPUESTO" }, data: { estado: "DESCARTADO" } });
    return { ok: false, motivo: "SIN_TELEGRAM" };
  }
  await prisma.dnxVendedorModelo.update({ where: { id: modeloId }, data: { telegramMessageId: enviado.resultado.messageId } });
  return { ok: true, modeloId };
}

// --- Aprobar y descartar ----------------------------------------------------------------------

class YaResuelto extends Error {}

export async function aprobarModelo(id: string, deps: DepsModelos = {}): Promise<Resultado> {
  const ahora = ahoraDe(deps);
  const m = await prisma.dnxVendedorModelo.findUnique({ where: { id }, select: { id: true, grupo: true, estado: true, asunto: true, cuerpo: true, contactoEjemploId: true } });
  if (!m) return { ok: false, texto: "No encontré ese modelo." };
  if (m.estado !== "PROPUESTO") return { ok: false, texto: "Ese modelo ya no está propuesto (se aprobó o se descartó)." };
  const ajustes = await leerAjustesVendedor();
  if (sinPaginaDeClubes(m.grupo, ajustes.paginaClubesPublicada)) return { ok: false, texto: TEXTO_CLUBES_SIN_PAGINA };

  // Primero se reemplaza el vigente (el único parcial no admite dos vigentes) y después se aprueba el
  // nuevo, condicionado a que siga propuesto. Si ya no lo está, se deshace todo.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.dnxVendedorModelo.updateMany({
        where: { grupo: m.grupo, estado: "APROBADO", reemplazadoEn: null, id: { not: m.id } },
        data: { reemplazadoEn: ahora },
      });
      const a = await tx.dnxVendedorModelo.updateMany({
        where: { id: m.id, estado: "PROPUESTO" },
        data: { estado: "APROBADO", aprobadoPor: "DANIEL", aprobadoEn: ahora },
      });
      if (a.count !== 1) throw new YaResuelto();
    });
  } catch (e) {
    if (e instanceof YaResuelto) return { ok: false, texto: "Ese modelo ya no está propuesto (se aprobó o se descartó)." };
    throw e;
  }

  const ejemplo = m.contactoEjemploId ? await encolarEjemplo({ ...m, contactoEjemploId: m.contactoEjemploId }) : "SIN_EJEMPLO";
  const detalle =
    ejemplo === "ENCOLADO"
      ? "El correo del contacto de ejemplo queda listo para salir."
      : ejemplo === "NO_APTO"
        ? "Al contacto de ejemplo ya no le escribo (dejó de ser apto)."
        : "";
  return { ok: true, texto: `✅ Aprobado el modelo de ${rotulo(m.grupo)}: desde ahora sus correos salen solos. ${detalle}`.trim() };
}

/** Crea el hilo del contacto de ejemplo con el modelo como borrador, si sigue apto y no tiene hilo. */
async function encolarEjemplo(m: { id: string; grupo: string; asunto: string; cuerpo: string; contactoEjemploId: string }): Promise<"ENCOLADO" | "NO_APTO" | "SIN_EJEMPLO"> {
  const ya = await prisma.dnxVendedorHilo.findUnique({ where: { contactoId: m.contactoEjemploId }, select: { id: true } });
  if (ya) return "NO_APTO";
  if (await sigueApto(m.contactoEjemploId)) return "NO_APTO";
  try {
    await prisma.dnxVendedorHilo.create({
      data: {
        contactoId: m.contactoEjemploId, grupo: m.grupo, modeloId: m.id, estado: "PENDIENTE_ENVIO",
        token: randomBytes(16).toString("base64url"), borrador: { asunto: m.asunto, cuerpo: m.cuerpo },
      },
    });
  } catch (e) {
    if (esUnicoRepetido(e)) return "NO_APTO";
    throw e;
  }
  return "ENCOLADO";
}

export async function descartarModelo(id: string): Promise<Resultado> {
  const d = await prisma.dnxVendedorModelo.updateMany({ where: { id, estado: "PROPUESTO" }, data: { estado: "DESCARTADO" } });
  if (d.count !== 1) return { ok: false, texto: "Ese modelo ya no está propuesto (se aprobó o se descartó)." };
  return { ok: true, texto: "❌ Descartado. Mañana te propongo otro modelo para ese grupo." };
}

// --- Correcciones -----------------------------------------------------------------------------

/**
 * Si un mensaje de Telegram es del Vendedor: un modelo PROPUESTO o un hilo ESPERA_DANIEL con ese
 * `telegramMessageId`. Las respuestas a los demás mensajes siguen yendo al Periodista.
 */
export async function esMensajeDelVendedor(messageId: string): Promise<boolean> {
  const [m, h] = await Promise.all([
    prisma.dnxVendedorModelo.findFirst({ where: { telegramMessageId: messageId, estado: "PROPUESTO" }, select: { id: true } }),
    prisma.dnxVendedorHilo.findFirst({ where: { telegramMessageId: messageId, estado: "ESPERA_DANIEL" }, select: { id: true } }),
  ]);
  return Boolean(m || h);
}

type Destino = { token: string; chatId: string };

/** Daniel respondió a un mensaje del Vendedor: rehace el modelo o la respuesta propuesta con su pedido. */
export async function corregirVendedor(respondeA: string, pedido: string, deps: DepsModelos = {}): Promise<void> {
  const destino = await destinoAgentes();
  if (!destino) return;
  const decir = (html: string) => mandarMensaje(destino.token, destino.chatId, html, null, deps.telegram ?? {});
  try {
    const modelo = await prisma.dnxVendedorModelo.findFirst({ where: { telegramMessageId: respondeA, estado: "PROPUESTO" } });
    if (modelo) return void (await corregirModelo(modelo, pedido, destino, decir, deps));
    const hilo = await prisma.dnxVendedorHilo.findFirst({
      where: { telegramMessageId: respondeA, estado: "ESPERA_DANIEL" },
      select: { id: true, contactoId: true, grupo: true, propuesta: true, correcciones: true, telegramMessageId: true },
    });
    if (hilo) return void (await corregirRespuesta(hilo, pedido, destino, decir, deps));
    await decir("Ese mensaje ya no espera una corrección (se aprobó, se envió o se descartó).");
  } catch (e) {
    console.error("[agentes][vendedor] no se pudo corregir", { detalle: e instanceof Error ? e.message : "error desconocido" });
    await decir("No pude corregirlo por un error interno.").catch(() => undefined);
  }
}

type Decir = (html: string) => Promise<unknown>;

async function corregirModelo(m: DnxVendedorModelo, pedido: string, destino: Destino, decir: Decir, deps: DepsModelos): Promise<void> {
  const ahora = ahoraDe(deps);
  if (m.correcciones >= MAX_CORRECCIONES_VENDEDOR) {
    return void (await decir(`Ese modelo ya se corrigió ${MAX_CORRECCIONES_VENDEDOR} veces (es el tope). Descartalo y mañana te propongo otro.`));
  }
  if (!esGrupo(m.grupo)) return void (await decir("Ese modelo tiene un grupo que no conozco."));
  const contacto = m.contactoEjemploId
    ? await prisma.dnxContacto.findUnique({ where: { id: m.contactoEjemploId }, select: SELECCION_CONTACTO })
    : null;
  if (!contacto) return void (await decir("No encuentro el contacto de ejemplo de ese modelo. Descartalo y mañana te propongo otro."));
  if (!(await puedeGastar(ahora)).ok) return void (await decir("Llegué al tope de gasto de Claude del mes: no puedo corregirlo."));
  const conocimiento = await leerConocimiento();
  if (!conocimiento) return void (await decir("Todavía no tengo cargado lo que sé de CompraMeLaFoto: no puedo corregirlo."));

  // Reclamo: si Telegram repite el aviso, la segunda vez no hace nada.
  const reclamo = await prisma.dnxVendedorModelo.updateMany({
    where: { id: m.id, estado: "PROPUESTO", correcciones: m.correcciones },
    data: { correcciones: m.correcciones + 1 },
  });
  if (reclamo.count !== 1) return;
  await decir("✍️ Rehaciendo el modelo con tu pedido…");

  const r = await redactarModelo(
    { grupo: m.grupo, contacto: datosParaPrompt(contacto), conocimiento: conocimiento.texto, indicacion: pedido, anterior: { asunto: m.asunto, cuerpo: m.cuerpo } },
    { ...deps.claude, hasta: hastaDe(deps) },
  );
  await anotarGasto({ usd: r.uso.costoUsd ?? 0, motivo: "CORRECCION", modeloId: m.id });
  if (!r.ok) return void (await decir(`No pude rehacerlo: ${escaparHtml(r.motivo)} Probá de nuevo respondiendo al mensaje.`));
  const v = r.valor;
  const cambio = await prisma.dnxVendedorModelo.updateMany({
    where: { id: m.id, estado: "PROPUESTO" },
    data: { asunto: v.asunto, cuerpo: v.cuerpo, indicaciones: v.indicaciones, landing: v.landing },
  });
  if (cambio.count !== 1) return void (await decir("Mientras lo rehacía, el modelo se aprobó o se descartó: no cambié nada."));

  const html = mensajeModelo({ grupo: rotulo(m.grupo), contacto, asunto: v.asunto, cuerpo: v.cuerpo, landing: v.landing, indicaciones: v.indicaciones });
  await mandarNuevo(destino, html, tecladoModelo(m.id), m.telegramMessageId, deps, (messageId) =>
    prisma.dnxVendedorModelo.update({ where: { id: m.id }, data: { telegramMessageId: messageId } }),
  );
}

type HiloCorreccion = { id: string; contactoId: string; grupo: string; propuesta: unknown; correcciones: number; telegramMessageId: string | null };

function leerPropuesta(p: unknown): { texto: string; entranteId: string } | null {
  if (!p || typeof p !== "object") return null;
  const { texto, entranteId } = p as Record<string, unknown>;
  return typeof texto === "string" && typeof entranteId === "string" ? { texto, entranteId } : null;
}

const PASOS_CONVERSACION = ["PRIMERO", "RECORDATORIO", "RESPUESTA"];

async function corregirRespuesta(h: HiloCorreccion, pedido: string, destino: Destino, decir: Decir, deps: DepsModelos): Promise<void> {
  const ahora = ahoraDe(deps);
  if (h.correcciones >= MAX_CORRECCIONES_VENDEDOR) {
    return void (await decir(`Esa respuesta ya se corrigió ${MAX_CORRECCIONES_VENDEDOR} veces (es el tope). Tocá «Lo contesto yo» y contestala desde Gmail.`));
  }
  const propuesta = leerPropuesta(h.propuesta);
  if (!propuesta) return void (await decir("No tengo una respuesta propuesta para corregir. Tocá «Lo contesto yo» y contestala desde Gmail."));
  if (!esGrupo(h.grupo)) return void (await decir("Ese hilo tiene un grupo que no conozco."));
  const grupo = h.grupo;
  const [contacto, entrante] = await Promise.all([
    prisma.dnxContacto.findUnique({ where: { id: h.contactoId }, select: SELECCION_CONTACTO }),
    prisma.dnxVendedorCorreo.findUnique({ where: { id: propuesta.entranteId }, select: { id: true, texto: true, de: true } }),
  ]);
  if (!contacto || !entrante) return void (await decir("No encuentro el contacto o su correo. Tocá «Lo contesto yo»."));
  if (!(await puedeGastar(ahora)).ok) return void (await decir("Llegué al tope de gasto de Claude del mes: no puedo corregirla."));
  const conocimiento = await leerConocimiento();
  if (!conocimiento) return void (await decir("Todavía no tengo cargado lo que sé de CompraMeLaFoto: no puedo corregirla."));

  const reclamo = await prisma.dnxVendedorHilo.updateMany({
    where: { id: h.id, estado: "ESPERA_DANIEL", correcciones: h.correcciones },
    data: { correcciones: h.correcciones + 1 },
  });
  if (reclamo.count !== 1) return;
  await decir("✍️ Rehaciendo la respuesta con tu pedido…");

  const delHilo = await prisma.dnxVendedorCorreo.findMany({
    where: { hiloId: h.id },
    orderBy: { creadoEn: "asc" },
    select: { id: true, direccion: true, paso: true, clase: true, texto: true },
  });
  const historial = delHilo
    .filter(
      (x) =>
        x.id !== entrante.id &&
        ((x.direccion === "SALIDA" && PASOS_CONVERSACION.includes(x.paso ?? "")) ||
          (x.direccion === "ENTRADA" && x.clase !== "AUTOMATICA" && x.clase !== "REBOTE")),
    )
    .map((x) => ({ direccion: x.direccion === "SALIDA" ? ("SALIDA" as const) : ("ENTRADA" as const), texto: x.texto }));

  const r = await clasificarYResponder(
    { contacto: datosParaPrompt(contacto), grupo, conocimiento: conocimiento.texto, historial, entrante: entrante.texto, indicacion: pedido },
    { ...deps.claude, hasta: hastaDe(deps) },
  );
  await anotarGasto({ usd: r.uso.costoUsd ?? 0, motivo: "CORRECCION", hiloId: h.id });
  if (!r.ok) return void (await decir(`No pude rehacerla: ${escaparHtml(r.motivo)} Probá de nuevo respondiendo al mensaje.`));
  const texto = r.valor.respuesta;
  if (texto === null) {
    return void (await decir(`Con tu indicación la clasifiqué como ${r.valor.clase} y no tengo respuesta para proponerte. Tocá «Lo contesto yo».`));
  }
  const cambio = await prisma.dnxVendedorHilo.updateMany({
    where: { id: h.id, estado: "ESPERA_DANIEL" },
    data: { propuesta: { texto, entranteId: entrante.id } },
  });
  if (cambio.count !== 1) return void (await decir("Mientras la rehacía, el hilo dejó de esperarte: no cambié nada."));

  const html = mensajeEsperaDaniel({
    nombre: contacto.nombre,
    de: entrante.de,
    grupo: rotulo(grupo),
    entrante: entrante.texto,
    propuesta: texto,
    motivo: `Versión corregida (${h.correcciones + 1} de ${MAX_CORRECCIONES_VENDEDOR}).`,
  });
  await mandarNuevo(destino, html, tecladoRespuesta(h.id, { conPropuesta: true }), h.telegramMessageId, deps, (messageId) =>
    prisma.dnxVendedorHilo.update({ where: { id: h.id }, data: { telegramMessageId: messageId } }),
  );
}

/** Manda la versión nueva, le saca los botones a la anterior y guarda el id del mensaje nuevo. */
async function mandarNuevo(
  destino: Destino,
  html: string,
  teclado: Parameters<typeof mandarMensaje>[3],
  anterior: string | null,
  deps: DepsModelos,
  guardar: (messageId: string) => Promise<unknown>,
): Promise<void> {
  const t = deps.telegram ?? {};
  const m = await mandarMensaje(destino.token, destino.chatId, html, teclado, t);
  if (!m.ok) {
    await mandarMensaje(destino.token, destino.chatId, "Guardé la versión nueva, pero Telegram no aceptó el mensaje. Respondé de nuevo al mensaje anterior.", null, t);
    return;
  }
  await guardar(m.resultado.messageId);
  if (anterior) await cambiarBotones(destino.token, destino.chatId, anterior, null, t).catch(() => undefined);
}

// --- Respuestas que esperan a Daniel ----------------------------------------------------------

/** «Enviar»: manda en el hilo la respuesta propuesta. Toma el hilo antes de enviar y, si no sale, lo devuelve. */
export async function enviarRespuestaPropuesta(hiloId: string, deps: DepsModelos = {}): Promise<Resultado> {
  const h = await prisma.dnxVendedorHilo.findUnique({
    where: { id: hiloId },
    select: { id: true, contactoId: true, grupo: true, modeloId: true, token: true, estado: true, propuesta: true },
  });
  if (!h || h.estado !== "ESPERA_DANIEL") return { ok: false, texto: "Esa respuesta ya no espera por vos." };
  const propuesta = leerPropuesta(h.propuesta);
  if (!propuesta) return { ok: false, texto: "No hay una respuesta propuesta para enviar. Tocá «Lo contesto yo»." };
  if (!esGrupo(h.grupo)) return { ok: false, texto: "Ese hilo tiene un grupo que no conozco. Tocá «Lo contesto yo»." };
  const correo = await prisma.dnxVendedorCorreo.findUnique({
    where: { id: propuesta.entranteId },
    select: { id: true, de: true, asunto: true, messageId: true },
  });
  if (!correo) return { ok: false, texto: "No encuentro el correo que contestaba. Tocá «Lo contesto yo»." };
  const contacto = await prisma.dnxContacto.findUnique({ where: { id: h.contactoId }, select: { estado: true } });
  if (contacto?.estado === "NO_CONTACTAR") return { ok: false, texto: "Pidió no recibir más correos. Tocá «Lo contesto yo»." };

  const toma = await prisma.dnxVendedorHilo.updateMany({
    where: { id: h.id, estado: "ESPERA_DANIEL" },
    data: { estado: "RESPONDIO", propuesta: Prisma.DbNull },
  });
  if (toma.count !== 1) return { ok: false, texto: "Esa respuesta ya no espera por vos." };
  const devolver = () =>
    prisma.dnxVendedorHilo.updateMany({
      where: { id: h.id, estado: "RESPONDIO" },
      data: { estado: "ESPERA_DANIEL", propuesta: { texto: propuesta.texto, entranteId: propuesta.entranteId } },
    });

  const delHilo = await prisma.dnxVendedorCorreo.findMany({
    where: { hiloId: h.id },
    orderBy: { creadoEn: "asc" },
    select: { id: true, messageId: true, direccion: true, paso: true },
  });
  let envio: Awaited<ReturnType<typeof responder>>;
  try {
    envio = await responder(h, h.grupo, correo, delHilo, propuesta.texto, { enviar: deps.enviar });
  } catch (e) {
    await devolver();
    throw e;
  }
  if (!envio.ok) {
    await devolver();
    return { ok: false, texto: `No pude mandarla: ${envio.motivo}` };
  }
  return { ok: true, texto: "✅ Enviada en el mismo hilo." };
}

/**
 * «Lo contesto yo»: el hilo pasa a manual y el correo del contacto se reenvía a la casilla de Daniel,
 * con el contacto como responder-a, para que conteste desde Gmail. Si el reenvío falla, vuelve atrás.
 */
export async function loContestoYo(hiloId: string, deps: DepsModelos = {}): Promise<Resultado> {
  const h = await prisma.dnxVendedorHilo.findUnique({ where: { id: hiloId }, select: { id: true, estado: true, propuesta: true } });
  if (!h || h.estado !== "ESPERA_DANIEL") return { ok: false, texto: "Esa respuesta ya no espera por vos." };
  const propuesta = leerPropuesta(h.propuesta);
  const entranteId =
    propuesta?.entranteId ??
    (await prisma.dnxVendedorCorreo.findFirst({ where: { hiloId: h.id, direccion: "ENTRADA" }, orderBy: { creadoEn: "desc" }, select: { id: true } }))?.id;
  if (!entranteId) return { ok: false, texto: "No encuentro el correo del contacto para reenviártelo." };

  const toma = await prisma.dnxVendedorHilo.updateMany({
    where: { id: h.id, estado: "ESPERA_DANIEL" },
    data: { estado: "RESPONDIO", modoManual: true, propuesta: Prisma.DbNull },
  });
  if (toma.count !== 1) return { ok: false, texto: "Esa respuesta ya no espera por vos." };
  try {
    await reenviarADaniel(entranteId, { enviar: deps.enviar });
  } catch {
    await prisma.dnxVendedorHilo.updateMany({
      where: { id: h.id, estado: "RESPONDIO", modoManual: true },
      data: { estado: "ESPERA_DANIEL", modoManual: false, propuesta: propuesta ?? Prisma.DbNull },
    });
    return { ok: false, texto: "No pude reenviártelo a Gmail. Probá de nuevo en un rato." };
  }
  return { ok: true, texto: `🙋 Te lo reenvié a ${CASILLA_DANIEL}: contestá desde ahí. El hilo queda en manual.` };
}

// --- Botones ----------------------------------------------------------------------------------

export async function procesarBotonVendedor(b: { accion: AccionVendedor; id: string }, deps: DepsModelos = {}): Promise<Resultado> {
  try {
    switch (b.accion) {
      case "APROBAR":
        return await aprobarModelo(b.id, deps);
      case "DESCARTAR":
        return await descartarModelo(b.id);
      case "ENVIAR":
        return await enviarRespuestaPropuesta(b.id, deps);
      case "YO":
        return await loContestoYo(b.id, deps);
      case "CORREGIR":
        return { ok: false, texto: "Respondé a este mensaje con lo que querés cambiar." };
    }
  } catch (e) {
    console.error("[agentes][vendedor] no se pudo procesar un botón", { accion: b.accion, detalle: e instanceof Error ? e.message : "error desconocido" });
    return { ok: false, texto: "No pude hacerlo por un error interno." };
  }
}
