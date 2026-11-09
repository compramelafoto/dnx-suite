import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, prisma } from "@repo/db";
import type { sendTransactionalEmail } from "@/lib/communications/send-email";
import type { DepsTelegramApi } from "@/lib/telegram/api";
import { cambiarEstado } from "../buscador/contactos";
import { destinoAgentes, mandarMensaje } from "../canal";
import type { DepsClaude, FallaClaude } from "../claude";
import { diaArgentino, inicioDelDiaArgentino } from "../periodista/horario";
import { anotarGasto, gastoDelMesVendedor, guardarAjustesVendedor, leerAjustesVendedor, puedeGastar, reclamarAjusteVendedor } from "./ajustes";
import { colaDelDia, sigueApto } from "./aptos";
import { revisarSalud } from "./avisos";
import { cupoDelDia, cupoHastaAhora, enVentanaDeEnvio, MAX_POR_CORRIDA, venceRecordatorio } from "./calendario";
import { bloqueadosEnClf, consultaDiaria, leerConocimiento, type DepsClfVendedor } from "./clf";
import { armarTexto, completarMessageIds, enlaceSeguimiento, enviarCorreoVendedor, urlBajaVendedor, type ResultadoEnvio } from "./correo";
import { procesarEntrantes } from "./entrante";
import { armarInforme, guardarInforme, informePendiente, mesAnterior, PREFIJO_AVISO_INFORME, resumenDelDia, textoInforme, tocaInforme, tocaResumen } from "./informe";
import { mensajePausa, mensajeSeSumo } from "./mensajes";
import { modeloVigente, proponerModelo } from "./modelos";
import { datosParaPrompt } from "./prompts";
import { adaptarCorreo, redactarRecordatorio } from "./redactor";
import { AUTOR_VENDEDOR, CURSO_POR_GRUPO, GRUPOS, LANDING_POR_GRUPO, ROTULO_GRUPO, type Grupo } from "./tipos";

/**
 * Motor del Vendedor: lo llama el cron cada 15 minutos. En cada corrida:
 *
 * 1. Procesa las respuestas que el webhook no terminó (siempre, aunque esté en pausa) y completa los
 *    Message-ID de los envíos.
 * 2. Hace la consulta diaria a CLF y avisa por Telegram de cada registro nuevo.
 * 3. Frena si llegó al tope de Claude (avisa una vez por mes), por la salud de la dirección, en
 *    pausa, fuera de 9 a 18 en día hábil o sin el conocimiento de CLF.
 * 4. Manda, dentro del cupo del día (repartido en la jornada, a lo sumo 2 por corrida), en este orden:
 *    los hilos pendientes (el ejemplo aprobado o un reintento), los recordatorios y los primeros
 *    correos de la cola.
 * 5. Propone el modelo de los grupos que todavía no tienen (no consume cupo).
 *
 * Un primer correo nunca sale dos veces:
 * - el hilo es único por contacto (`contactoId` @unique): dos corridas no crean dos hilos;
 * - sólo se envía un hilo PENDIENTE_ENVIO tomado con un `updateMany` condicional sobre `tomadoEn`;
 * - el texto se redacta una vez, se guarda en `borrador` y cada reintento manda ese mismo texto con la
 *   misma clave de idempotencia (`dnx-vendedor:<hiloId>:PRIMERO`): Resend no lo repite;
 * - si ya hay un PRIMERO guardado para el hilo, el reintento sólo termina de marcarlo, sin enviar.
 */

export type DepsMotorVendedor = {
  ahora?: () => Date;
  /** Milisegundos para medir el presupuesto de tiempo (y el plazo de Claude). */
  reloj?: () => number;
  claude?: DepsClaude;
  clf?: DepsClfVendedor;
  enviar?: typeof sendTransactionalEmail;
  telegram?: DepsTelegramApi;
  /** Gancho para las pruebas: corre justo antes de cada envío al contacto. */
  antesDeEnviar?: (contactoId: string) => Promise<void>;
};

export type FrenoVendedor = null | "PAUSADO" | "SALUD" | "TOPE" | "FUERA_DE_HORARIO" | "SIN_CONOCIMIENTO" | "SIN_CLF";

export type ResultadoVendedor = { respuestas: number; enviados: number; recordatorios: number; propuestos: number; frenadoPor: FrenoVendedor };

/** Una toma más vieja que esto es de una corrida que se cortó (una corrida dura a lo sumo 5 minutos). */
const TOMA_VENCE_MS = 10 * 60_000;
/** No se empieza un envío con menos de esto: alcanza para una llamada a Claude (pide 15 s) y el envío. */
const MARGEN_MS = 30_000;
const MAX_INTENTOS = 3;
const MAX_PROPUESTAS_POR_CORRIDA = 2;

type Hilo = {
  id: string; contactoId: string; grupo: string; modeloId: string | null; token: string; estado: string; borrador: unknown;
  intentos: number; recordadoEn: Date | null; ultimaRespuestaEn: Date | null; recordatorioCancelado: boolean;
  registradoEn: Date | null; modoManual: boolean; enviadoEn: Date | null;
};
const SELECCION_HILO = {
  id: true, contactoId: true, grupo: true, modeloId: true, token: true, estado: true, borrador: true, intentos: true,
  recordadoEn: true, ultimaRespuestaEn: true, recordatorioCancelado: true, registradoEn: true, modoManual: true, enviadoEn: true,
} as const;
const SELECCION_CONTACTO = {
  id: true, email: true, telefono: true, estado: true, nombre: true, ciudad: true, provincia: true, tipo: true, nichos: true, web: true,
} as const;

type Borrador = { asunto: string; cuerpo: string };

function leerBorrador(v: unknown): Borrador | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const b = v as Record<string, unknown>;
  return typeof b.asunto === "string" && typeof b.cuerpo === "string" && b.cuerpo.trim() !== "" ? { asunto: b.asunto, cuerpo: b.cuerpo } : null;
}

const esGrupo = (g: string): g is Grupo => (GRUPOS as readonly string[]).includes(g);

/** Pura: si a un hilo enviado le toca el (único) recordatorio. */
export function debeRecordar(
  h: {
    estado: string; recordadoEn: Date | null; ultimaRespuestaEn: Date | null; recordatorioCancelado: boolean;
    registradoEn: Date | null; modoManual: boolean; enviadoEn: Date | null;
  },
  contactoEstado: string,
  ahora: Date,
): boolean {
  if (h.estado !== "ENVIADO") return false;
  if (h.recordadoEn || h.ultimaRespuestaEn || h.recordatorioCancelado || h.registradoEn || h.modoManual) return false;
  if (contactoEstado !== "CONTACTADO") return false;
  return h.enviadoEn !== null && venceRecordatorio(h.enviadoEn, ahora);
}

/** Cómo terminó un intento de envío. `PARAR`: falla de todo un servicio, no se sigue enviando en esta corrida. */
type Fin = "ENVIADO" | "SALTEADO" | "PARAR" | "SIN_CLF" | "TOPE";

type Ctx = {
  ahora: Date;
  reloj: () => number;
  hasta: number;
  claude: DepsClaude;
  deps: DepsMotorVendedor;
  conocimiento: string;
};

const quedaTiempo = (ctx: Ctx) => ctx.hasta - ctx.reloj() >= MARGEN_MS;

function libre(ahora: Date) {
  return { OR: [{ tomadoEn: null }, { tomadoEn: { lt: new Date(ahora.getTime() - TOMA_VENCE_MS) } }] };
}

/** Suelta la toma del hilo para que otra corrida lo retome. */
async function soltar(hiloId: string): Promise<void> {
  await prisma.dnxVendedorHilo.updateMany({ where: { id: hiloId }, data: { tomadoEn: null } }).catch(() => undefined);
}

/** Un intento fallido del primer correo: el hilo sigue pendiente; al tercero se cierra como FALLO. */
async function fallo(h: Hilo, motivo: string): Promise<void> {
  const intentos = h.intentos + 1;
  console.error("[agentes][vendedor] no salió un primer correo", { hiloId: h.id, intentos, motivo });
  await prisma.dnxVendedorHilo.update({
    where: { id: h.id },
    data: intentos >= MAX_INTENTOS ? { intentos, tomadoEn: null, estado: "CERRADO", cierre: "FALLO" } : { intentos, tomadoEn: null },
  });
}

/** Las fallas de Claude que no son de este pedido (servicio caído o sin tiempo) no gastan un intento. */
const fallaDeServicio = (f: FallaClaude | undefined) => f === "SERVICIO" || f === "SIN_TIEMPO";

async function avisarTelegram(html: string, deps: DepsMotorVendedor): Promise<boolean> {
  try {
    const destino = await destinoAgentes();
    if (!destino) {
      console.error("[agentes][vendedor] no hay chat de Telegram vinculado para avisar");
      return false;
    }
    await mandarMensaje(destino.token, destino.chatId, html, null, deps.telegram ?? {});
    return true;
  } catch {
    console.error("[agentes][vendedor] no se pudo avisar por Telegram");
    return false;
  }
}

const usd = (n: number) => `USD ${n.toFixed(2).replace(".", ",")}`;

// --- Primer correo ----------------------------------------------------------------------------

/**
 * Manda el primer correo de un hilo PENDIENTE_ENVIO que esta corrida ya tomó (`tomadoEn`). Redacta
 * el texto sólo si el hilo todavía no tiene borrador; si lo tiene, manda ese mismo.
 */
async function enviarPrimero(hiloId: string, ctx: Ctx, o: { revisarClf: boolean }): Promise<Fin> {
  const h = (await prisma.dnxVendedorHilo.findUnique({ where: { id: hiloId }, select: SELECCION_HILO })) as Hilo | null;
  if (!h || h.estado !== "PENDIENTE_ENVIO") return "SALTEADO";

  // Un reintento de un envío que ya salió (y se guardó): sólo falta marcarlo.
  const ya = await prisma.dnxVendedorCorreo.findFirst({ where: { hiloId: h.id, paso: "PRIMERO", direccion: "SALIDA" }, select: { id: true } });
  if (ya) {
    await marcarEnviado(h, ctx.ahora);
    return "SALTEADO";
  }

  const c = await prisma.dnxContacto.findUnique({ where: { id: h.contactoId }, select: SELECCION_CONTACTO });
  if (!c || c.estado === "NO_CONTACTAR") {
    await cerrarPorBaja(h.id);
    return "SALTEADO";
  }
  if (!esGrupo(h.grupo) || !c.email) {
    await borrarHilo(h.id);
    return "SALTEADO";
  }
  const grupo = h.grupo;
  const motivo = await sigueApto(c.id);
  if (motivo) {
    // Nunca se le mandó nada: el hilo se borra y, si vuelve a ser apto, la cola lo encuentra de nuevo.
    await borrarHilo(h.id);
    return "SALTEADO";
  }
  if (o.revisarClf) {
    const bloqueados = await bloqueadosEnClf([{ id: c.id, email: c.email, telefono: c.telefono }], ctx.deps.clf);
    if (!(bloqueados instanceof Set)) {
      await soltar(h.id);
      return "SIN_CLF";
    }
    if (bloqueados.has(c.id)) {
      await prisma.dnxVendedorHilo.update({ where: { id: h.id }, data: { estado: "CERRADO", cierre: "YA_ERA_USUARIO", tomadoEn: null } });
      return "SALTEADO";
    }
  }

  let borrador = leerBorrador(h.borrador);
  let modeloId = h.modeloId;
  if (!borrador) {
    const modelo = await modeloVigente(grupo);
    if (!modelo) {
      await borrarHilo(h.id);
      return "SALTEADO";
    }
    if (!(await puedeGastar(ctx.ahora)).ok) {
      await soltar(h.id);
      return "TOPE";
    }
    const r = await adaptarCorreo(
      { modelo: { asunto: modelo.asunto, cuerpo: modelo.cuerpo, indicaciones: modelo.indicaciones }, contacto: datosParaPrompt(c), conocimiento: ctx.conocimiento },
      { ...ctx.claude, hasta: ctx.hasta },
    );
    await anotarGasto({ usd: r.uso.costoUsd ?? 0, motivo: "CORREO", hiloId: h.id });
    if (!r.ok) {
      if (fallaDeServicio(r.falla)) {
        await soltar(h.id);
        return "PARAR";
      }
      await fallo(h, r.motivo);
      return "SALTEADO";
    }
    borrador = r.valor;
    modeloId = modelo.id;
    // Se guarda antes de enviar: un reintento manda este mismo texto (la misma clave con otro texto, Resend la rechaza).
    await prisma.dnxVendedorHilo.update({ where: { id: h.id }, data: { borrador, modeloId } });
  }

  const urlBaja = urlBajaVendedor(c.email);
  if (!urlBaja) {
    console.error("[agentes][vendedor] falta la dirección pública de FOTOFFICE o la clave para firmar la baja");
    await soltar(h.id);
    return "PARAR";
  }
  const modelo = modeloId ? await prisma.dnxVendedorModelo.findUnique({ where: { id: modeloId }, select: { landing: true } }) : null;
  const texto = armarTexto(
    borrador.cuerpo,
    {
      ENLACE: enlaceSeguimiento(modelo?.landing ?? LANDING_POR_GRUPO[grupo], h.token),
      CURSO: enlaceSeguimiento(CURSO_POR_GRUPO[grupo], h.token),
    },
    urlBaja,
  );

  await ctx.deps.antesDeEnviar?.(c.id);
  const envio = await enviarCorreoVendedor(
    {
      hiloId: h.id, contactoId: c.id, para: c.email, asunto: borrador.asunto, texto, paso: "PRIMERO",
      claveIdempotencia: `dnx-vendedor:${h.id}:PRIMERO`,
    },
    { enviar: ctx.deps.enviar },
  );
  return terminarEnvio(h, envio, ctx);
}

async function terminarEnvio(h: Hilo, envio: ResultadoEnvio, ctx: Ctx): Promise<Fin> {
  if (envio.ok) {
    await marcarEnviado(h, ctx.ahora);
    return "ENVIADO";
  }
  if (envio.motivo === "NO_CONTACTAR") {
    await cerrarPorBaja(h.id);
    return "SALTEADO";
  }
  if (!envio.reintentable) {
    // Falta configuración (la clave de Resend o la firma de la baja): no es culpa del hilo.
    console.error("[agentes][vendedor] no se puede enviar: falta configuración", { motivo: envio.motivo });
    await soltar(h.id);
    return "PARAR";
  }
  await fallo(h, envio.motivo);
  return "SALTEADO";
}

async function marcarEnviado(h: Hilo, ahora: Date): Promise<void> {
  await prisma.dnxVendedorHilo.update({
    where: { id: h.id },
    data: { estado: "ENVIADO", enviadoEn: ahora, borrador: Prisma.DbNull, tomadoEn: null },
  });
  await cambiarEstado(h.contactoId, "CONTACTADO", AUTOR_VENDEDOR);
}

/** Borra un hilo pendiente al que nunca se le mandó nada (sólo si sigue pendiente). */
async function borrarHilo(hiloId: string): Promise<void> {
  await prisma.dnxVendedorHilo.deleteMany({ where: { id: hiloId, estado: "PENDIENTE_ENVIO" } });
}

async function cerrarPorBaja(hiloId: string): Promise<void> {
  await prisma.dnxVendedorHilo.update({ where: { id: hiloId }, data: { estado: "BAJA", cierre: "BAJA", tomadoEn: null } });
}

// --- Recordatorio -----------------------------------------------------------------------------

async function enviarRecordatorio(hiloId: string, ctx: Ctx): Promise<Fin> {
  const h = (await prisma.dnxVendedorHilo.findUnique({ where: { id: hiloId }, select: SELECCION_HILO })) as Hilo | null;
  const c = h ? await prisma.dnxContacto.findUnique({ where: { id: h.contactoId }, select: SELECCION_CONTACTO }) : null;
  // Se vuelve a mirar después de tomarlo: pudo contestar, registrarse o darse de baja mientras tanto.
  if (!h || !c || !esGrupo(h.grupo) || !debeRecordar(h, c.estado, ctx.ahora)) {
    if (h) await soltar(h.id);
    return "SALTEADO";
  }
  const grupo = h.grupo;
  // Va en el mismo hilo: sin el Message-ID del primero, espera a que `completarMessageIds` lo traiga.
  const primero = await prisma.dnxVendedorCorreo.findFirst({
    where: { hiloId: h.id, paso: "PRIMERO", direccion: "SALIDA" },
    select: { messageId: true, asunto: true, texto: true, para: true },
  });
  if (!primero?.messageId) {
    await soltar(h.id);
    return "SALTEADO";
  }
  const urlBaja = urlBajaVendedor(primero.para);
  if (!urlBaja) {
    console.error("[agentes][vendedor] falta la dirección pública de FOTOFFICE o la clave para firmar la baja");
    await soltar(h.id);
    return "PARAR";
  }

  let cuerpo = leerBorrador(h.borrador)?.cuerpo ?? null;
  if (!cuerpo) {
    if (!(await puedeGastar(ctx.ahora)).ok) {
      await soltar(h.id);
      return "TOPE";
    }
    const r = await redactarRecordatorio(
      { asuntoOriginal: primero.asunto, cuerpoOriginal: primero.texto, contacto: datosParaPrompt(c), conocimiento: ctx.conocimiento },
      { ...ctx.claude, hasta: ctx.hasta },
    );
    await anotarGasto({ usd: r.uso.costoUsd ?? 0, motivo: "RECORDATORIO", hiloId: h.id });
    if (!r.ok) {
      if (fallaDeServicio(r.falla)) {
        await soltar(h.id);
        return "PARAR";
      }
      // El recordatorio es opcional: si Claude no logra uno válido, no se insiste.
      console.error("[agentes][vendedor] no se pudo redactar un recordatorio", { hiloId: h.id, motivo: r.motivo });
      await prisma.dnxVendedorHilo.update({ where: { id: h.id }, data: { recordatorioCancelado: true, tomadoEn: null } });
      return "SALTEADO";
    }
    cuerpo = r.valor.cuerpo;
    // Guardado: un reintento manda este mismo texto con la misma clave.
    await prisma.dnxVendedorHilo.update({ where: { id: h.id }, data: { borrador: { asunto: primero.asunto, cuerpo } } });
  }

  const modelo = h.modeloId ? await prisma.dnxVendedorModelo.findUnique({ where: { id: h.modeloId }, select: { landing: true } }) : null;
  const texto = armarTexto(
    cuerpo,
    {
      ENLACE: enlaceSeguimiento(modelo?.landing ?? LANDING_POR_GRUPO[grupo], h.token),
      CURSO: enlaceSeguimiento(CURSO_POR_GRUPO[grupo], h.token),
    },
    urlBaja,
  );
  await ctx.deps.antesDeEnviar?.(c.id);
  const envio = await enviarCorreoVendedor(
    {
      hiloId: h.id, contactoId: c.id, para: primero.para, asunto: primero.asunto, texto, paso: "RECORDATORIO",
      claveIdempotencia: `dnx-vendedor:${h.id}:RECORDATORIO`,
      enHilo: { messageId: primero.messageId, referencias: [] },
    },
    { enviar: ctx.deps.enviar },
  );
  if (envio.ok) {
    await prisma.dnxVendedorHilo.update({ where: { id: h.id }, data: { recordadoEn: ctx.ahora, borrador: Prisma.DbNull, tomadoEn: null } });
    // Si contestó mientras tanto, el hilo queda como lo dejó la respuesta.
    await prisma.dnxVendedorHilo.updateMany({ where: { id: h.id, estado: "ENVIADO" }, data: { estado: "RECORDADO" } });
    return "ENVIADO";
  }
  await soltar(h.id);
  if (!envio.reintentable && envio.motivo !== "NO_CONTACTAR") {
    console.error("[agentes][vendedor] no se puede enviar: falta configuración", { motivo: envio.motivo });
    return "PARAR";
  }
  return "SALTEADO";
}

// --- Corrida ----------------------------------------------------------------------------------

export async function correrVendedor(
  o: { presupuestoMs: number; motivo: "CRON" | "MANUAL" },
  deps: DepsMotorVendedor = {},
): Promise<ResultadoVendedor> {
  const ahoraFn = deps.ahora ?? (() => new Date());
  const reloj = deps.reloj ?? Date.now;
  const hasta = reloj() + o.presupuestoMs;
  const claude: DepsClaude = { ...deps.claude, ahora: deps.claude?.ahora ?? reloj };
  try {
    return await corrida(ahoraFn, reloj, hasta, claude, deps);
  } finally {
    // El resumen diario y el informe mensual corren aunque el envío esté frenado o un paso anterior haya fallado.
    await pasosProgramados(ahoraFn(), deps);
  }
}

/**
 * El resumen diario (desde las 19) y el informe mensual (día 1 desde las 9; si CLF no respondió, se
 * reintenta hasta el día 7). Nunca lanza: un fallo acá no puede tapar el resultado ni el error de la
 * corrida.
 *
 * Cada aviso se RECLAMA antes de enviarlo (compare-and-set sobre los ajustes): dos corridas que se
 * pisan mandan uno solo, y si el envío falla ese aviso se pierde en vez de repetirse sin fin.
 */
export async function pasosProgramados(ahora: Date, deps: DepsMotorVendedor): Promise<void> {
  try {
    const dia = diaArgentino(ahora);
    if (tocaResumen(ahora, await leerAjustesVendedor()) && (await reclamarAjusteVendedor({ resumenDia: dia }, (x) => tocaResumen(ahora, x)))) {
      const texto = await resumenDelDia(ahora);
      if (texto) await avisarTelegram(texto, deps);
    }
  } catch (e) {
    console.error("[agentes][vendedor] falló el resumen diario", e instanceof Error ? e.message : "");
  }
  try {
    const pendiente = (x: Awaited<ReturnType<typeof leerAjustesVendedor>>) => tocaInforme(ahora, x) || informePendiente(ahora, x);
    if (!pendiente(await leerAjustesVendedor())) return;
    const mes = mesAnterior(ahora);
    const informe = await armarInforme(mes, { clf: deps.clf });
    if (informe.ventasDisponibles) {
      if (!(await reclamarAjusteVendedor({ informeMes: mes }, pendiente))) return;
      await guardarInforme(informe);
      await avisarTelegram(textoInforme(informe), deps);
      return;
    }
    // Sin las ventas de CLF no se da por hecho: se reintenta en cada corrida, pero el aviso sale una sola vez.
    // La marca se toma antes de enviar (no salen dos) y se devuelve si el envío falla (no cuenta como avisado).
    const marca = `${PREFIJO_AVISO_INFORME}${mes}`;
    try {
      await prisma.systemSettings.create({ data: { key: marca, value: ahora.toISOString(), description: "Aviso de informe mensual del Vendedor sin ventas de CLF" } });
    } catch {
      return;
    }
    if (!(await avisarTelegram(textoInforme(informe), deps))) await prisma.systemSettings.deleteMany({ where: { key: marca } });
  } catch (e) {
    console.error("[agentes][vendedor] falló el informe mensual", e instanceof Error ? e.message : "");
  }
}

async function corrida(
  ahoraFn: () => Date,
  reloj: () => number,
  hasta: number,
  claude: DepsClaude,
  deps: DepsMotorVendedor,
): Promise<ResultadoVendedor> {
  const res: ResultadoVendedor = { respuestas: 0, enviados: 0, recordatorios: 0, propuestos: 0, frenadoPor: null };
  const ahora = ahoraFn();

  // 1. Respuestas: siempre, aunque esté en pausa (en pausa pasan todas a Daniel).
  try {
    res.respuestas = (await procesarEntrantes({ hasta }, { ahora: ahoraFn, claude, enviar: deps.enviar, telegram: deps.telegram })).procesados;
  } catch (e) {
    console.error("[agentes][vendedor] falló el procesamiento de respuestas", e instanceof Error ? e.message : "");
  }
  await completarMessageIds({ ahora }).catch(() => 0);

  // 2. Consulta diaria a CLF y aviso de cada registro nuevo.
  const diaria = await consultaDiaria(ahora, deps.clf);
  if (diaria.errores.length > 0) console.error("[agentes][vendedor] consulta diaria a CLF con errores", diaria.errores);
  for (const reg of diaria.registros) {
    const h = await prisma.dnxVendedorHilo.findUnique({ where: { id: reg.hiloId }, select: { contactoId: true, grupo: true } });
    const c = h ? await prisma.dnxContacto.findUnique({ where: { id: h.contactoId }, select: { nombre: true, ciudad: true } }) : null;
    if (!h || !c) continue;
    await avisarTelegram(mensajeSeSumo({ nombre: c.nombre, ciudad: c.ciudad, grupo: esGrupo(h.grupo) ? ROTULO_GRUPO[h.grupo] : h.grupo, via: reg.via }), deps);
  }

  // 3. Tope de Claude: avisa una sola vez por mes.
  if (!(await puedeGastar(ahora)).ok) {
    const ajustes = await leerAjustesVendedor();
    const mes = diaArgentino(ahora).slice(0, 7);
    if (ajustes.avisoTope !== mes) {
      const gastado = await gastoDelMesVendedor(ahora);
      await avisarTelegram(mensajePausa("TOPE", `Llevo gastados ${usd(gastado)} de ${usd(ajustes.topeClaudeUsd)} este mes.`), deps);
      await guardarAjustesVendedor({ avisoTope: mes });
    }
    return { ...res, frenadoPor: "TOPE" };
  }

  // 4. Frenos.
  if ((await revisarSalud(ahora, deps.telegram)).frenado) return { ...res, frenadoPor: "SALUD" };
  const ajustes = await leerAjustesVendedor();
  if (ajustes.pausado) return { ...res, frenadoPor: "PAUSADO" };
  if (!enVentanaDeEnvio(ahora)) return { ...res, frenadoPor: "FUERA_DE_HORARIO" };
  const conocimiento = await leerConocimiento();
  if (!conocimiento) return { ...res, frenadoPor: "SIN_CONOCIMIENTO" };

  const ctx: Ctx = { ahora, reloj, hasta, claude, deps, conocimiento: conocimiento.texto };

  // 5. Envíos dentro del cupo. Los recordatorios cuentan; las respuestas a dudas, no.
  const enviadosHoy = await prisma.dnxVendedorCorreo.count({
    where: { direccion: "SALIDA", paso: { in: ["PRIMERO", "RECORDATORIO"] }, creadoEn: { gte: inicioDelDiaArgentino(ahora) } },
  });
  let disponibles = Math.max(0, Math.min(MAX_POR_CORRIDA, cupoHastaAhora(cupoDelDia(ajustes, ahora), ahora) - enviadosHoy));
  let parar = false;
  let sinClf = false;
  const anotar = (fin: Fin, paso: "PRIMERO" | "RECORDATORIO") => {
    if (fin === "ENVIADO") {
      disponibles--;
      if (paso === "PRIMERO") res.enviados++;
      else res.recordatorios++;
    }
    if (fin === "PARAR") parar = true;
    if (fin === "TOPE") {
      parar = true;
      res.frenadoPor = "TOPE";
    }
    if (fin === "SIN_CLF") {
      sinClf = true;
      res.frenadoPor = "SIN_CLF";
    }
  };
  const seguir = () => disponibles > 0 && !parar && quedaTiempo(ctx);

  // 5.1 Hilos pendientes: el ejemplo de un modelo recién aprobado, o un primer correo que falló.
  const pendientes = await prisma.dnxVendedorHilo.findMany({
    where: { estado: "PENDIENTE_ENVIO", ...libre(ahora) },
    orderBy: { creadoEn: "asc" },
    select: { id: true },
  });
  for (const p of pendientes) {
    if (!seguir() || sinClf) break;
    const toma = await prisma.dnxVendedorHilo.updateMany({ where: { id: p.id, estado: "PENDIENTE_ENVIO", ...libre(ahora) }, data: { tomadoEn: ahora } });
    if (toma.count !== 1) continue;
    anotar(await conRescate(p.id, () => enviarPrimero(p.id, ctx, { revisarClf: true })), "PRIMERO");
  }

  // 5.2 Recordatorios.
  const porRecordar = await prisma.dnxVendedorHilo.findMany({
    where: {
      estado: "ENVIADO", recordadoEn: null, ultimaRespuestaEn: null, recordatorioCancelado: false, registradoEn: null,
      modoManual: false, enviadoEn: { not: null }, ...libre(ahora),
    },
    orderBy: { enviadoEn: "asc" },
    select: SELECCION_HILO,
  });
  for (const h of porRecordar as Hilo[]) {
    if (!seguir()) break;
    const c = await prisma.dnxContacto.findUnique({ where: { id: h.contactoId }, select: { estado: true } });
    if (!c || !debeRecordar(h, c.estado, ahora)) continue;
    const toma = await prisma.dnxVendedorHilo.updateMany({
      where: { id: h.id, estado: "ENVIADO", recordadoEn: null, ...libre(ahora) },
      data: { tomadoEn: ahora },
    });
    if (toma.count !== 1) continue;
    anotar(await conRescate(h.id, () => enviarRecordatorio(h.id, ctx)), "RECORDATORIO");
  }

  // 5.3 Primeros correos de la cola. También trae los grupos sin modelo (paso 6), aunque no quede cupo.
  const { cola, gruposSinModelo } = await colaDelDia(parar || sinClf ? 0 : disponibles, { soloContactoId: ajustes.soloContactoPrueba });
  if (cola.length > 0 && seguir()) {
    const contactos = await prisma.dnxContacto.findMany({
      where: { id: { in: cola.map((x) => x.contactoId) } },
      select: { id: true, email: true, telefono: true },
    });
    const bloqueados = await bloqueadosEnClf(contactos, deps.clf);
    if (!(bloqueados instanceof Set)) {
      res.frenadoPor = "SIN_CLF";
    } else {
      for (const e of cola) {
        if (!seguir()) break;
        try {
          if (bloqueados.has(e.contactoId)) {
            // Ya es usuario de CLF (o se dio de baja allá): el hilo cerrado lo saca de la cola para siempre.
            await crearHilo(e.contactoId, e.grupo, { estado: "CERRADO", cierre: "YA_ERA_USUARIO" });
            continue;
          }
          // Único por contacto: si otra corrida lo creó primero, esta lo saltea.
          const hiloId = await crearHilo(e.contactoId, e.grupo, { estado: "PENDIENTE_ENVIO", tomadoEn: ahora });
          if (!hiloId) continue;
          anotar(await conRescate(hiloId, () => enviarPrimero(hiloId, ctx, { revisarClf: false })), "PRIMERO");
        } catch (err) {
          // Un error con un contacto no aborta la cola ni las propuestas: se sigue con el próximo.
          console.error("[agentes][vendedor] falló un contacto de la cola", { contactoId: e.contactoId, detalle: err instanceof Error ? err.message : "" });
        }
      }
    }
  }

  // 6. Modelos de los grupos que no tienen: no consumen cupo.
  for (const g of gruposSinModelo.slice(0, MAX_PROPUESTAS_POR_CORRIDA)) {
    if (!quedaTiempo(ctx)) break;
    try {
      const p = await proponerModelo(g.grupo, g.contactoId, { ahora: ahoraFn, claude, enviar: deps.enviar, telegram: deps.telegram, hasta });
      if (p.ok) res.propuestos++;
    } catch (e) {
      console.error("[agentes][vendedor] no se pudo proponer un modelo", { grupo: g.grupo, detalle: e instanceof Error ? e.message : "" });
    }
  }
  return res;
}

/** Un error inesperado con un hilo no corta la corrida: el hilo se suelta y lo retoma la próxima. */
async function conRescate(hiloId: string, fn: () => Promise<Fin>): Promise<Fin> {
  try {
    return await fn();
  } catch (e) {
    console.error("[agentes][vendedor] falló un envío", { hiloId, detalle: e instanceof Error ? e.message : "error desconocido" });
    await soltar(hiloId);
    return "SALTEADO";
  }
}

async function crearHilo(
  contactoId: string,
  grupo: Grupo,
  data: { estado: "PENDIENTE_ENVIO"; tomadoEn: Date } | { estado: "CERRADO"; cierre: "YA_ERA_USUARIO" },
): Promise<string | null> {
  try {
    const h = await prisma.dnxVendedorHilo.create({
      data: { contactoId, grupo, token: randomBytes(16).toString("base64url"), ...data },
      select: { id: true },
    });
    return h.id;
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002") return null;
    throw e;
  }
}
