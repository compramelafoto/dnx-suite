import "server-only";
import { prisma } from "@repo/db";
import { normalizeContentSlug, parseContentPostCreate, parseContentPostUpdate } from "@repo/content";
import { appUrl } from "@/lib/app-url";
import { createBlogPost, deleteBlogPost, updateBlogPost } from "@/lib/blog/admin-queries";
import { absoluteUrl, BLOG_RESERVED_POST_SLUGS } from "@/lib/blog/public-format";
import { blogWhere } from "@/lib/blog/scope";
import { MAX_LEYENDA_FOTO, type DepsTelegramApi } from "@/lib/telegram/api";
import { cambiarBotones, destinoAgentes, mandarMensaje, mandarPropuesta } from "../canal";
import { frasesCopiadas } from "./copia";
import { diaArgentino, horaDePublicacion, inicioDelDiaArgentino, textoDePublicacion } from "./horario";
import { armarMensajePropuesta, escaparHtml, mensajeDeFallo, tecladoDePropuesta } from "./mensaje";
import { pedidoPorCopia, type TrabajoParaFoto } from "./prompts";
import { buscarYEscribir, reescribir, textoDeLaFuente, type DepsRedactor, type UsoClaude } from "./redactor";
import { notaATiptap, textoDeLaNota, type NotaReescrita } from "./salida";
import { esDireccionPublica } from "./url";

/**
 * El Periodista (spec 2026-11-07): propone una nota para el blog de DNX Estudio, la manda por
 * Telegram y, con la respuesta de Daniel, la publica, la corrige o la descarta. Nada se publica sin
 * el botón de Daniel. Todo tolera que falte la tabla (el SQL se aplica a mano). Nunca lanza.
 *
 * Estados: PREPARANDO (corriendo) → PENDIENTE (esperando a Daniel) → PUBLICADA | DESCARTADA,
 * o FALLO. Cada corrida deja una fila, aunque falle: así se cuenta el tope de 3 por día.
 */

export const AGENTE_PERIODISTA = "PERIODISTA";
export const MAX_CORRIDAS_POR_DIA = 3;
export const MAX_CORRECCIONES = 5;
/** Una corrida que lleva más que esto en PREPARANDO se considera muerta y no frena a la siguiente. */
const PREPARANDO_VIVA_MS = 6 * 60_000;
/** Tiempo total para Claude dentro de una función de 300 s. */
const PLAZO_CLAUDE_MS = 255_000;
const MAX_TEXTO_EXTRACTOS = 40_000;
const NOMBRE_CATEGORIA = "Noticias";
const SLUG_CATEGORIA = "noticias";

/** El workspace de DNX Estudio (su blog y su portfolio). */
export function workspacePeriodista(): string {
  return process.env.FOTOFFICE_PERIODISTA_WORKSPACE_ID?.trim() || "cmv5z6qxwwmmhf0q5gp8qja1j";
}

export type TrabajoElegido = { id: string; titulo: string; fotoUrl: string | null };

/** Lo que se guarda en `datos` (JSON) de la propuesta. */
export type DatosPropuesta = {
  motivo: MotivoCorrida;
  fuenteUrlOriginal?: string;
  fuenteTitulo?: string;
  fuenteMedio?: string | null;
  temaFoto?: string;
  trabajo?: TrabajoElegido | null;
  nota?: NotaReescrita;
  /** Citas de la búsqueda + texto de la página, para revisar copia en las correcciones. */
  extractos?: string[];
  /** Todos los mensajes de Telegram de la propuesta (el último está en `telegramMessageId`). */
  mensajes?: string[];
  uso?: UsoClaude;
  error?: string;
};

export type MotivoCorrida = "CRON" | "MANUAL" | "OTRA";

export type ResultadoCorrida = {
  estado: "CREADA" | "YA_HAY" | "TOPE" | "OCUPADO" | "SIN_CANAL" | "SIN_TABLA" | "FALLO";
  mensaje: string;
  propuestaId?: string;
};

export type DepsPeriodista = DepsTelegramApi & {
  redactor?: DepsRedactor;
  ahora?: () => Date;
  destino?: () => Promise<{ token: string; chatId: string } | null>;
};

const esTablaFaltante = (e: unknown) => (e as { code?: unknown } | null)?.code === "P2021";

function registrar(donde: string, e: unknown): void {
  const codigo = (e as { code?: unknown } | null)?.code;
  if (esTablaFaltante(e)) console.warn(`[agentes][periodista] ${donde}: falta aplicar el SQL de FotofficeAgentePropuesta`);
  else console.error(`[agentes][periodista] ${donde} falló`, { codigo: typeof codigo === "string" ? codigo : null, error: e instanceof Error ? e.name : null });
}

function recortarExtractos(extractos: string[]): string[] {
  const salida: string[] = [];
  let total = 0;
  for (const e of extractos) {
    const t = e.trim();
    if (!t) continue;
    const parte = t.slice(0, MAX_TEXTO_EXTRACTOS - total);
    if (!parte) break;
    salida.push(parte);
    total += parte.length;
  }
  return salida;
}

export function editorDelBorrador(postId: number): string | null {
  const base = appUrl();
  return base ? `${base}/website/blog/${postId}` : null;
}

/** Los trabajos publicados de DNX Estudio que tienen portada (para elegir la foto). */
async function trabajosConFoto(workspaceId: string): Promise<Array<TrabajoParaFoto & { portadaUrl: string }>> {
  try {
    const [trabajos, categorias] = await Promise.all([
      prisma.fotofficeTrabajo.findMany({
        where: { workspaceId, estado: "PUBLICADO", portadaUrl: { not: null } },
        orderBy: [{ fecha: { sort: "desc", nulls: "last" } }, { orden: "asc" }],
        take: 60,
        select: { id: true, titulo: true, categoriaId: true, portadaUrl: true },
      }),
      prisma.fotofficeTrabajoCategoria.findMany({ where: { workspaceId }, select: { id: true, nombre: true } }),
    ]);
    const nombres = new Map(categorias.map((c) => [c.id, c.nombre]));
    return trabajos.flatMap((t) =>
      t.portadaUrl ? [{ id: t.id, titulo: t.titulo, categoria: t.categoriaId ? (nombres.get(t.categoriaId) ?? null) : null, portadaUrl: t.portadaUrl }] : [],
    );
  } catch (e) {
    registrar("trabajosConFoto", e);
    return [];
  }
}

async function categoriaNoticias(workspaceId: string): Promise<number | null> {
  const where = { ...blogWhere(workspaceId), slug: SLUG_CATEGORIA };
  try {
    const existente = await prisma.blogCategory.findFirst({ where, select: { id: true } });
    if (existente) return existente.id;
    const nueva = await prisma.blogCategory.create({ data: { ...blogWhere(workspaceId), name: NOMBRE_CATEGORIA, slug: SLUG_CATEGORIA }, select: { id: true } });
    return nueva.id;
  } catch (e) {
    // Otra corrida la creó al mismo tiempo (unique): se relee.
    const otra = await prisma.blogCategory.findFirst({ where, select: { id: true } }).catch(() => null);
    if (!otra) registrar("categoriaNoticias", e);
    return otra?.id ?? null;
  }
}

/** Un slug libre en el blog: el del título (≤ 55), y si ya existe, con la fecha o un sufijo. */
async function slugLibre(workspaceId: string, titulo: string, dia: string): Promise<string> {
  const base = normalizeContentSlug(titulo).slice(0, 55).replace(/-+$/, "") || "nota";
  const candidatos = [base, `${base.slice(0, 48).replace(/-+$/, "")}-${dia.replace(/-/g, "")}`];
  for (const c of candidatos) {
    if (BLOG_RESERVED_POST_SLUGS.has(c)) continue;
    const existe = await prisma.blogPost.findFirst({ where: { ...blogWhere(workspaceId), slug: c }, select: { id: true } });
    if (!existe) return c;
  }
  return `${base.slice(0, 50).replace(/-+$/, "")}-${Math.random().toString(36).slice(2, 7)}`;
}

function contenidoDelBorrador(nota: NotaReescrita, fuente: { url: string; titulo: string; medio?: string | null }) {
  return {
    title: nota.titulo,
    excerpt: nota.bajada,
    contentJson: notaATiptap(nota.cuerpo, fuente),
    seoTitle: nota.titulo,
    seoDescription: nota.bajada.slice(0, 320),
  };
}

async function marcarFallo(propuestaId: string, datos: DatosPropuesta, motivo: string, ahora: Date): Promise<void> {
  try {
    await prisma.fotofficeAgentePropuesta.update({
      where: { id: propuestaId },
      data: { estado: "FALLO", resueltaEn: ahora, datos: { ...datos, error: motivo } as object },
    });
  } catch (e) {
    registrar("marcarFallo", e);
  }
}

/** Revisa copia contra los extractos; si hay, pide UNA reescritura. Devuelve la nota limpia o el motivo. */
async function sinCopia(
  nota: NotaReescrita,
  fuente: { titulo: string; url: string },
  extractos: string[],
  hasta: number,
  deps: DepsPeriodista,
): Promise<{ ok: true; nota: NotaReescrita } | { ok: false; motivo: string }> {
  const frases = frasesCopiadas(textoDeLaNota(nota), extractos);
  if (frases.length === 0) return { ok: true, nota };
  const r = await reescribir({ nota, fuente, pedido: pedidoPorCopia(frases), hasta }, deps.redactor);
  if (!r.ok) return { ok: false, motivo: `La nota repetía frases de la fuente y no se pudo reescribir (${r.motivo}).` };
  if (frasesCopiadas(textoDeLaNota(r.valor), extractos).length > 0) return { ok: false, motivo: "La nota seguía repitiendo frases textuales de la fuente." };
  return { ok: true, nota: r.valor };
}

/**
 * Una corrida: busca, escribe, crea el borrador y manda la propuesta. `forzar` (el botón de la
 * página Agentes y "Otra noticia") saltea el "ya hay una de hoy", nunca el tope de 3 por día.
 */
export async function correrPeriodista(opciones: { motivo: MotivoCorrida; forzar?: boolean }, deps: DepsPeriodista = {}): Promise<ResultadoCorrida> {
  const ahora = deps.ahora ?? (() => new Date());
  const destino = await (deps.destino ?? destinoAgentes)();
  if (!destino) return { estado: "SIN_CANAL", mensaje: "El canal de Telegram de agentes no está listo (falta el token o vincular el chat)." };
  const workspaceId = workspacePeriodista();

  let propuestaId: string;
  try {
    const desde = inicioDelDiaArgentino(ahora());
    const deHoy = await prisma.fotofficeAgentePropuesta.findMany({
      where: { agente: AGENTE_PERIODISTA, creadaEn: { gte: desde } },
      select: { estado: true, creadaEn: true },
    });
    if (deHoy.some((p) => p.estado === "PREPARANDO" && ahora().getTime() - p.creadaEn.getTime() < PREPARANDO_VIVA_MS)) {
      return { estado: "OCUPADO", mensaje: "El Periodista ya está preparando una nota. Esperá unos minutos." };
    }
    if (!opciones.forzar && deHoy.some((p) => p.estado === "PENDIENTE" || p.estado === "PUBLICADA")) {
      return { estado: "YA_HAY", mensaje: "Ya hay una nota del Periodista de hoy." };
    }
    if (deHoy.length >= MAX_CORRIDAS_POR_DIA) {
      return { estado: "TOPE", mensaje: `El Periodista ya corrió ${MAX_CORRIDAS_POR_DIA} veces hoy (es el tope). Mañana sigue.` };
    }
    const fila = await prisma.fotofficeAgentePropuesta.create({
      data: { agente: AGENTE_PERIODISTA, estado: "PREPARANDO", workspaceId, datos: { motivo: opciones.motivo }, creadaEn: ahora() },
      select: { id: true },
    });
    propuestaId = fila.id;
  } catch (e) {
    registrar("correrPeriodista", e);
    return esTablaFaltante(e)
      ? { estado: "SIN_TABLA", mensaje: "Falta aplicar el SQL de FotofficeAgentePropuesta." }
      : { estado: "FALLO", mensaje: "No se pudo leer la cola de propuestas." };
  }

  const datos: DatosPropuesta = { motivo: opciones.motivo };
  const fallar = async (motivo: string): Promise<ResultadoCorrida> => {
    await marcarFallo(propuestaId, datos, motivo, ahora());
    await mandarMensaje(destino.token, destino.chatId, mensajeDeFallo(motivo), null, deps);
    return { estado: "FALLO", mensaje: motivo, propuestaId };
  };

  try {
    const usadas = await prisma.fotofficeAgentePropuesta.findMany({
      where: { agente: AGENTE_PERIODISTA, fuenteUrl: { not: null } },
      orderBy: { creadaEn: "desc" },
      take: 100,
      select: { fuenteUrl: true },
    });
    const excluidas = [...new Set(usadas.map((u) => u.fuenteUrl).filter((u): u is string => Boolean(u)))];
    const trabajos = await trabajosConFoto(workspaceId);
    const hasta = Date.now() + PLAZO_CLAUDE_MS;

    const r = await buscarYEscribir(
      { hoy: diaArgentino(ahora()), excluidas, trabajos: trabajos.map(({ id, titulo, categoria }) => ({ id, titulo, categoria })), hasta },
      deps.redactor,
    );
    if (!r.ok) {
      datos.uso = r.uso;
      return await fallar(r.motivo);
    }
    const propuesta = r.valor;
    datos.uso = r.uso;
    datos.fuenteUrlOriginal = propuesta.fuenteUrl;
    datos.fuenteTitulo = propuesta.fuenteTitulo;
    datos.fuenteMedio = propuesta.fuenteMedio ?? null;
    datos.temaFoto = propuesta.temaFoto;
    if (excluidas.includes(propuesta.fuenteUrlNormalizada)) return await fallar("Claude eligió una noticia que ya habíamos usado.");

    const pagina = esDireccionPublica(propuesta.fuenteUrl) ? await textoDeLaFuente(propuesta.fuenteUrl, deps.redactor) : "";
    const extractos = recortarExtractos([...r.extractos, pagina]);
    datos.extractos = extractos;
    const fuente = { titulo: propuesta.fuenteTitulo, url: propuesta.fuenteUrl };
    const limpia = await sinCopia({ titulo: propuesta.titulo, bajada: propuesta.bajada, cuerpo: propuesta.cuerpo }, fuente, extractos, hasta, deps);
    if (!limpia.ok) return await fallar(limpia.motivo);
    const nota = limpia.nota;
    datos.nota = nota;

    const elegido = trabajos.find((t) => t.id === propuesta.trabajoId) ?? trabajos[0] ?? null;
    const fotoUrl = elegido ? absoluteUrl(appUrl(), elegido.portadaUrl) : null;
    datos.trabajo = elegido ? { id: elegido.id, titulo: elegido.titulo, fotoUrl } : null;

    const categoryId = await categoriaNoticias(workspaceId);
    const parseado = parseContentPostCreate({
      ...contenidoDelBorrador(nota, { url: propuesta.fuenteUrl, titulo: propuesta.fuenteTitulo, medio: propuesta.fuenteMedio }),
      slug: await slugLibre(workspaceId, nota.titulo, diaArgentino(ahora())),
      status: "DRAFT",
      heroImageUrl: fotoUrl,
      ogImageUrl: fotoUrl,
      categoryId,
    });
    if (!parseado.success) {
      console.error("[agentes][periodista] el borrador no pasó la validación", { campos: parseado.error.issues.map((i) => i.path.join(".")) });
      return await fallar("El borrador no pasó la validación del blog.");
    }
    const post = await createBlogPost(workspaceId, parseado.data);

    const datosMensaje = {
      titulo: nota.titulo,
      bajada: nota.bajada,
      fuenteTitulo: propuesta.fuenteTitulo,
      fuenteMedio: propuesta.fuenteMedio,
      fuenteUrl: propuesta.fuenteUrl,
      editorUrl: editorDelBorrador(post.id),
      trabajoTitulo: elegido?.titulo ?? null,
    };
    const messageId = await mandarPropuesta(
      destino,
      { fotoUrl, leyenda: armarMensajePropuesta(datosMensaje, MAX_LEYENDA_FOTO), texto: armarMensajePropuesta(datosMensaje, 4096), teclado: tecladoDePropuesta(propuestaId) },
      deps,
    );
    datos.mensajes = messageId ? [messageId] : [];
    await prisma.fotofficeAgentePropuesta.update({
      where: { id: propuestaId },
      data: {
        estado: messageId ? "PENDIENTE" : "FALLO",
        fuenteUrl: propuesta.fuenteUrlNormalizada,
        blogPostId: post.id,
        telegramMessageId: messageId,
        datos: (messageId ? datos : { ...datos, error: "Telegram no aceptó el mensaje" }) as object,
        ...(messageId ? {} : { resueltaEn: ahora() }),
      },
    });
    if (!messageId) return { estado: "FALLO", mensaje: "El borrador quedó creado, pero Telegram no aceptó el mensaje.", propuestaId };
    return { estado: "CREADA", mensaje: `Propuesta enviada: «${nota.titulo}».`, propuestaId };
  } catch (e) {
    registrar("correrPeriodista", e);
    return await fallar("Error interno al preparar la nota.");
  }
}

type FilaPropuesta = {
  id: string;
  estado: string;
  workspaceId: string;
  blogPostId: number | null;
  telegramMessageId: string | null;
  correcciones: number;
  datos: unknown;
};

const SELECCION = { id: true, estado: true, workspaceId: true, blogPostId: true, telegramMessageId: true, correcciones: true, datos: true } as const;

function datosDe(fila: { datos: unknown }): DatosPropuesta {
  const d = fila.datos;
  return d && typeof d === "object" && !Array.isArray(d) ? (d as DatosPropuesta) : { motivo: "CRON" };
}

export type ResultadoAccion = { ok: boolean; texto: string };

async function propuestaPendiente(propuestaId: string): Promise<FilaPropuesta | null> {
  return prisma.fotofficeAgentePropuesta.findFirst({ where: { id: propuestaId, agente: AGENTE_PERIODISTA }, select: SELECCION });
}

/** Publicar: el borrador pasa a PUBLISHED con fecha hoy 11:00 AR (o ahora). Idempotente. */
export async function publicarPropuesta(propuestaId: string, deps: { ahora?: () => Date } = {}): Promise<ResultadoAccion> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  try {
    const p = await propuestaPendiente(propuestaId);
    if (!p) return { ok: false, texto: "No encontré esa propuesta." };
    if (p.estado === "PUBLICADA") return { ok: false, texto: "Esa nota ya estaba aprobada." };
    if (p.estado !== "PENDIENTE" || !p.blogPostId) return { ok: false, texto: "Esa propuesta ya no está pendiente." };
    const reclamo = await prisma.fotofficeAgentePropuesta.updateMany({ where: { id: p.id, estado: "PENDIENTE" }, data: { estado: "PUBLICADA", resueltaEn: ahora } });
    if (reclamo.count !== 1) return { ok: false, texto: "Esa propuesta ya no está pendiente." };
    const cuando = horaDePublicacion(ahora);
    const cambios = parseContentPostUpdate({ status: "PUBLISHED", publishedAt: cuando.toISOString() });
    const post = cambios.success ? await updateBlogPost(p.workspaceId, p.blogPostId, cambios.data).catch(() => null) : null;
    if (!post) {
      await prisma.fotofficeAgentePropuesta.updateMany({ where: { id: p.id }, data: { estado: "PENDIENTE", resueltaEn: null } }).catch(() => undefined);
      return { ok: false, texto: "No pude publicar el borrador (¿lo borraron del blog?)." };
    }
    return { ok: true, texto: `✅ Aprobada: sale publicada ${textoDePublicacion(cuando, ahora)}.` };
  } catch (e) {
    registrar("publicarPropuesta", e);
    return { ok: false, texto: "No pude publicarla por un error interno." };
  }
}

/** Descartar: la propuesta queda DESCARTADA y su borrador (si sigue en borrador) se borra. */
export async function descartarPropuesta(propuestaId: string, deps: { ahora?: () => Date } = {}): Promise<ResultadoAccion> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  try {
    const p = await propuestaPendiente(propuestaId);
    if (!p) return { ok: false, texto: "No encontré esa propuesta." };
    if (p.estado === "DESCARTADA") return { ok: false, texto: "Esa nota ya estaba descartada." };
    const reclamo = await prisma.fotofficeAgentePropuesta.updateMany({ where: { id: p.id, estado: "PENDIENTE" }, data: { estado: "DESCARTADA", resueltaEn: ahora } });
    if (reclamo.count !== 1) return { ok: false, texto: "Esa propuesta ya no está pendiente." };
    if (p.blogPostId) {
      const borrador = await prisma.blogPost.findFirst({ where: { ...blogWhere(p.workspaceId), id: p.blogPostId, status: "DRAFT" }, select: { id: true } });
      if (borrador) await deleteBlogPost(p.workspaceId, borrador.id).catch((e) => registrar("borrar borrador", e));
    }
    return { ok: true, texto: "❌ Descartada." };
  } catch (e) {
    registrar("descartarPropuesta", e);
    return { ok: false, texto: "No pude descartarla por un error interno." };
  }
}

/** La propuesta pendiente a la que corresponde un mensaje de Telegram (el actual o uno anterior). */
async function propuestaDelMensaje(messageId: string): Promise<FilaPropuesta | null> {
  const directa = await prisma.fotofficeAgentePropuesta.findFirst({ where: { agente: AGENTE_PERIODISTA, telegramMessageId: messageId }, select: SELECCION });
  if (directa) return directa;
  const recientes = await prisma.fotofficeAgentePropuesta.findMany({
    where: { agente: AGENTE_PERIODISTA, estado: "PENDIENTE" },
    orderBy: { creadaEn: "desc" },
    take: 20,
    select: SELECCION,
  });
  return recientes.find((p) => datosDe(p).mensajes?.includes(messageId)) ?? null;
}

/**
 * Corrección: Daniel respondió al mensaje de una propuesta. Reescribe con su pedido, actualiza el
 * borrador y manda la versión nueva (al mensaje anterior se le sacan los botones).
 */
export async function corregirPropuesta(respondeA: string, pedido: string, deps: DepsPeriodista = {}): Promise<void> {
  const destino = await (deps.destino ?? destinoAgentes)();
  if (!destino) return;
  const decir = (texto: string) => mandarMensaje(destino.token, destino.chatId, texto, null, deps);
  try {
    const p = await propuestaDelMensaje(respondeA);
    if (!p) return void (await decir("No encontré la propuesta de ese mensaje. Respondé al último mensaje de la nota."));
    if (p.estado !== "PENDIENTE" || !p.blogPostId) return void (await decir("Esa nota ya no está pendiente (se publicó o se descartó)."));
    if (p.correcciones >= MAX_CORRECCIONES) return void (await decir(`Esa nota ya se corrigió ${MAX_CORRECCIONES} veces (es el tope). Editala directo en FOTOFFICE.`));
    const d = datosDe(p);
    if (!d.nota || !d.fuenteUrlOriginal) return void (await decir("No tengo guardada la nota para corregirla. Editala en FOTOFFICE."));
    // Reclamar la corrección (si Telegram repite el aviso, la segunda vez no hace nada).
    const reclamo = await prisma.fotofficeAgentePropuesta.updateMany({
      where: { id: p.id, estado: "PENDIENTE", correcciones: p.correcciones },
      data: { correcciones: p.correcciones + 1 },
    });
    if (reclamo.count !== 1) return;
    await decir("✍️ Reescribiendo la nota con tu pedido…");

    const hasta = Date.now() + PLAZO_CLAUDE_MS;
    const fuente = { titulo: d.fuenteTitulo ?? d.fuenteUrlOriginal, url: d.fuenteUrlOriginal };
    const r = await reescribir({ nota: d.nota, fuente, pedido, hasta }, deps.redactor);
    if (!r.ok) return void (await decir(`No pude reescribirla: ${escaparHtml(r.motivo)} Probá de nuevo respondiendo al mensaje.`));
    const limpia = await sinCopia(r.valor, fuente, d.extractos ?? [], hasta, deps);
    if (!limpia.ok) return void (await decir(`No pude reescribirla: ${escaparHtml(limpia.motivo)}`));
    const nota = limpia.nota;

    const cambios = parseContentPostUpdate(contenidoDelBorrador(nota, { url: d.fuenteUrlOriginal, titulo: fuente.titulo, medio: d.fuenteMedio }));
    const post = cambios.success ? await updateBlogPost(p.workspaceId, p.blogPostId, cambios.data).catch(() => null) : null;
    if (!post) return void (await decir("No pude guardar la versión nueva en el borrador (¿lo borraron del blog?)."));

    const version = p.correcciones + 1;
    const datosMensaje = {
      titulo: nota.titulo,
      bajada: nota.bajada,
      fuenteTitulo: fuente.titulo,
      fuenteMedio: d.fuenteMedio,
      fuenteUrl: d.fuenteUrlOriginal,
      editorUrl: editorDelBorrador(p.blogPostId),
      trabajoTitulo: d.trabajo?.titulo ?? null,
      version,
    };
    const messageId = await mandarPropuesta(
      destino,
      {
        fotoUrl: d.trabajo?.fotoUrl ?? null,
        leyenda: armarMensajePropuesta(datosMensaje, MAX_LEYENDA_FOTO),
        texto: armarMensajePropuesta(datosMensaje, 4096),
        teclado: tecladoDePropuesta(p.id),
      },
      deps,
    );
    if (messageId && p.telegramMessageId) await cambiarBotones(destino.token, destino.chatId, p.telegramMessageId, null, deps);
    await prisma.fotofficeAgentePropuesta.update({
      where: { id: p.id },
      data: {
        ...(messageId ? { telegramMessageId: messageId } : {}),
        datos: { ...d, nota, mensajes: [...(d.mensajes ?? []), ...(messageId ? [messageId] : [])] } as object,
      },
    });
    if (!messageId) await decir("Guardé la versión nueva en el borrador, pero Telegram no aceptó el mensaje.");
  } catch (e) {
    registrar("corregirPropuesta", e);
    await decir("No pude corregir la nota por un error interno.").catch(() => undefined);
  }
}

/** Para la página Agentes: las últimas propuestas. `null` = falta la tabla. */
export async function ultimasPropuestas(limite = 15) {
  try {
    const filas = await prisma.fotofficeAgentePropuesta.findMany({
      where: { agente: AGENTE_PERIODISTA },
      orderBy: { creadaEn: "desc" },
      take: limite,
      select: { id: true, estado: true, fuenteUrl: true, blogPostId: true, correcciones: true, datos: true, creadaEn: true, resueltaEn: true },
    });
    return filas.map((f) => {
      const d = datosDe(f);
      return {
        id: f.id,
        estado: f.estado,
        creadaEn: f.creadaEn,
        resueltaEn: f.resueltaEn,
        correcciones: f.correcciones,
        fuenteUrl: f.fuenteUrl,
        titulo: d.nota?.titulo ?? null,
        fuenteTitulo: d.fuenteTitulo ?? null,
        motivo: d.motivo,
        error: d.error ?? null,
        editorUrl: f.blogPostId ? editorDelBorrador(f.blogPostId) : null,
      };
    });
  } catch (e) {
    registrar("ultimasPropuestas", e);
    return esTablaFaltante(e) ? null : [];
  }
}
