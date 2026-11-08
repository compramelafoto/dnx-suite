import "server-only";
import { prisma } from "@repo/db";
import { normalizeContentSlug, parseContentPostCreate, parseContentPostUpdate } from "@repo/content";
import { appUrl } from "@/lib/app-url";
import { createBlogPost, deleteBlogPost, updateBlogPost } from "@/lib/blog/admin-queries";
import { absoluteUrl, BLOG_RESERVED_POST_SLUGS } from "@/lib/blog/public-format";
import { blogWhere } from "@/lib/blog/scope";
import { uploadBlogImage } from "@/lib/blog/storage";
import { MAX_LEYENDA_FOTO, type DepsTelegramApi } from "@/lib/telegram/api";
import { cambiarBotones, destinoAgentes, mandarMensaje, mandarPropuesta } from "../canal";
import { frasesCopiadas } from "./copia";
import { costoUsd, juntarUsos, type UsoClaude } from "./costo";
import { resumenDeGustos, PROPUESTAS_PARA_GUSTOS, type CategoriaNota, type ResultadoPropuesta, type ResumenGustos } from "./gustos";
import { diaArgentino, horaDePublicacion, inicioDelDiaArgentino, inicioDelMesArgentino, textoDePublicacion } from "./horario";
import { creditoDeFoto, nombreDeArchivo, type CreditoFoto, type ImagenDeLaFuente } from "./imagen";
import { armarMensajePropuesta, escaparHtml, mensajeDeFallo, tecladoDePropuesta } from "./mensaje";
import { pedidoPorCopia } from "./prompts";
import { bajarImagen, buscarYEscribir, paginaDeLaFuente, reescribir, type DepsRedactor } from "./redactor";
import { notaATiptap, textoDeLaNota, type NotaPropuesta, type NotaReescrita } from "./salida";
import { DIAS_TEMAS_A_EVITAR, temaRepetido, type TemaPrevio } from "./temas";

/**
 * El Periodista (spec 2026-11-07, ajustes 2026-11-08): propone una nota para el blog de DNX
 * Estudio, la manda por Telegram y, con la respuesta de Daniel, la publica, la corrige o la
 * descarta. Nada se publica sin el botón de Daniel. Todo tolera que falte la tabla (el SQL se
 * aplica a mano). Nunca lanza.
 *
 * Estados: PREPARANDO (corriendo) → PENDIENTE (esperando a Daniel) → PUBLICADA | DESCARTADA,
 * o FALLO. Cada corrida deja una fila, aunque falle: así se cuenta el tope de 3 por día.
 *
 * La foto es la imagen principal de la noticia (copiada a nuestro almacenamiento, con crédito al
 * medio); si no hay una usable, la nota va sin foto. No repite temas (los de los últimos 45 días
 * van en el pedido y se controlan acá) y aprende de lo que Daniel publica, descarta y corrige.
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
/** Estados que cuentan como "ya propuesto" (los FALLO no llegaron a Daniel). */
const ESTADOS_PROPUESTOS = ["PENDIENTE", "PUBLICADA", "DESCARTADA"];

/** El workspace de DNX Estudio (su blog). */
export function workspacePeriodista(): string {
  return process.env.FOTOFFICE_PERIODISTA_WORKSPACE_ID?.trim() || "cmv5z6qxwwmmhf0q5gp8qja1j";
}

/** La foto de la nota: la imagen de la noticia copiada a nuestro almacenamiento. */
export type FotoDeLaNota = {
  /** Dirección de NUESTRA copia (absoluta). */
  url: string;
  /** De dónde se bajó (la imagen en el sitio del medio). */
  original: string;
  credito: CreditoFoto;
};

/** Lo que se guarda en `datos` (JSON) de la propuesta. */
export type DatosPropuesta = {
  motivo: MotivoCorrida;
  fuenteUrlOriginal?: string;
  fuenteTitulo?: string;
  fuenteMedio?: string | null;
  /** El hecho del que trata la noticia (para no repetir temas). */
  tema?: string;
  categoria?: CategoriaNota;
  /** null = la nota va sin foto. */
  foto?: FotoDeLaNota | null;
  nota?: NotaReescrita;
  /** Qué hizo Daniel: publicar, descartar u "otra noticia". */
  resultado?: ResultadoPropuesta;
  /** Los pedidos de corrección de Daniel (sus textos), en orden. */
  correccionesPedidas?: string[];
  /** Citas de la búsqueda + texto de la página, para revisar copia en las correcciones. */
  extractos?: string[];
  /** Todos los mensajes de Telegram de la propuesta (el último está en `telegramMessageId`). */
  mensajes?: string[];
  /** Todo lo gastado en Claude por esta propuesta (corrida, reescrituras y correcciones), con su costo. */
  uso?: UsoClaude;
  error?: string;
};

export type MotivoCorrida = "CRON" | "MANUAL" | "OTRA";

export type ResultadoCorrida = {
  estado: "CREADA" | "YA_HAY" | "TOPE" | "OCUPADO" | "SIN_CANAL" | "SIN_TABLA" | "FALLO";
  mensaje: string;
  propuestaId?: string;
};

/** Sube la imagen a nuestro almacenamiento y devuelve su dirección (o null si no se pudo). */
export type SubirImagen = (input: { workspaceId: string; bytes: Uint8Array; tipo: string; nombre: string; titulo: string; alt: string }) => Promise<string | null>;

export type DepsPeriodista = DepsTelegramApi & {
  redactor?: DepsRedactor;
  ahora?: () => Date;
  destino?: () => Promise<{ token: string; chatId: string } | null>;
  subirImagen?: SubirImagen;
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

function datosDe(fila: { datos: unknown }): DatosPropuesta {
  const d = fila.datos;
  return d && typeof d === "object" && !Array.isArray(d) ? (d as DatosPropuesta) : { motivo: "CRON" };
}

/** El tema de una propuesta (las anteriores a los ajustes no lo tienen: se usa el título). */
function temaPrevioDe(fila: { estado: string; creadaEn: Date; datos: unknown }, desdeHoy: Date): TemaPrevio | null {
  const d = datosDe(fila);
  const titulo = d.nota?.titulo ?? d.fuenteTitulo ?? null;
  const tema = d.tema ?? titulo;
  return tema ? { tema, titulo, estado: fila.estado, deHoy: fila.creadaEn.getTime() >= desdeHoy.getTime() } : null;
}

/** Los temas ya propuestos en los últimos 45 días (el más reciente primero). */
async function temasRecientes(ahora: Date): Promise<TemaPrevio[]> {
  const filas = await prisma.fotofficeAgentePropuesta.findMany({
    where: { agente: AGENTE_PERIODISTA, estado: { in: ESTADOS_PROPUESTOS }, creadaEn: { gte: new Date(ahora.getTime() - DIAS_TEMAS_A_EVITAR * 86_400_000) } },
    orderBy: { creadaEn: "desc" },
    take: 300,
    select: { estado: true, creadaEn: true, datos: true },
  });
  const desdeHoy = inicioDelDiaArgentino(ahora);
  return filas.map((f) => temaPrevioDe(f, desdeHoy)).filter((t): t is TemaPrevio => t !== null);
}

/** El resumen de gustos con las últimas propuestas que llegaron a Daniel. */
async function gustosRecientes(): Promise<ResumenGustos> {
  const filas = await prisma.fotofficeAgentePropuesta.findMany({
    where: { agente: AGENTE_PERIODISTA, estado: { in: ESTADOS_PROPUESTOS } },
    orderBy: { creadaEn: "desc" },
    take: PROPUESTAS_PARA_GUSTOS,
    select: { estado: true, datos: true },
  });
  return resumenDeGustos(
    filas.map((f) => {
      const d = datosDe(f);
      return { estado: f.estado, categoria: d.categoria ?? null, resultado: d.resultado ?? null, correccionesPedidas: d.correccionesPedidas ?? [] };
    }),
  );
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

function contenidoDelBorrador(nota: NotaReescrita, fuente: { url: string; titulo: string; medio?: string | null }, foto: FotoDeLaNota | null | undefined) {
  return {
    title: nota.titulo,
    excerpt: nota.bajada,
    contentJson: notaATiptap(nota.cuerpo, fuente, foto?.credito ?? null),
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

/**
 * Revisa copia contra los extractos; si hay, pide UNA reescritura. Devuelve la nota limpia o el
 * motivo, y siempre lo gastado en Claude.
 */
async function sinCopia(
  nota: NotaReescrita,
  fuente: { titulo: string; url: string },
  extractos: string[],
  hasta: number,
  deps: DepsPeriodista,
): Promise<({ ok: true; nota: NotaReescrita } | { ok: false; motivo: string }) & { uso: UsoClaude | null }> {
  const frases = frasesCopiadas(textoDeLaNota(nota), extractos);
  if (frases.length === 0) return { ok: true, nota, uso: null };
  const r = await reescribir({ nota, fuente, pedido: pedidoPorCopia(frases), hasta }, deps.redactor);
  if (!r.ok) return { ok: false, motivo: `La nota repetía frases de la fuente y no se pudo reescribir (${r.motivo}).`, uso: r.uso };
  if (frasesCopiadas(textoDeLaNota(r.valor), extractos).length > 0) return { ok: false, motivo: "La nota seguía repitiendo frases textuales de la fuente.", uso: r.uso };
  return { ok: true, nota: r.valor, uso: r.uso };
}

const subirImagenReal: SubirImagen = async (input) => {
  const r = await uploadBlogImage({
    workspaceId: input.workspaceId,
    kind: "hero",
    bytes: input.bytes,
    filename: input.nombre,
    mimeType: input.tipo,
    title: input.titulo,
    altText: input.alt,
  });
  if (!r.ok) {
    console.warn("[agentes][periodista] la imagen de la noticia no se pudo guardar", { motivo: r.error.slice(0, 120) });
    return null;
  }
  return r.url;
};

/**
 * La foto de la nota: la imagen principal de la noticia, bajada y guardada en nuestro
 * almacenamiento (no se depende del enlace ajeno). null = la nota va sin foto. Nunca lanza.
 */
async function fotoDeLaNoticia(
  workspaceId: string,
  imagen: ImagenDeLaFuente | null,
  propuesta: Pick<NotaPropuesta, "fuenteUrl" | "fuenteMedio">,
  titulo: string,
  deps: DepsPeriodista,
): Promise<FotoDeLaNota | null> {
  if (!imagen) return null;
  try {
    const bajada = await bajarImagen(imagen.url, deps.redactor);
    if (!bajada) return null;
    const credito = creditoDeFoto({ medio: propuesta.fuenteMedio, sitio: imagen.sitio, credito: imagen.credito, fuenteUrl: propuesta.fuenteUrl });
    const subida = await (deps.subirImagen ?? subirImagenReal)({
      workspaceId,
      bytes: bajada.bytes,
      tipo: bajada.tipo,
      nombre: nombreDeArchivo(imagen.url, bajada.tipo),
      titulo: `Foto: ${credito.texto}`,
      alt: titulo,
    });
    const url = subida ? absoluteUrl(appUrl(), subida) : null;
    return url ? { url, original: imagen.url, credito } : null;
  } catch (e) {
    registrar("fotoDeLaNoticia", e);
    return null;
  }
}

/** Por qué una elección de Claude no sirve (noticia ya usada o tema repetido), o null si sirve. */
function problemaDeEleccion(p: NotaPropuesta, excluidas: string[], temas: TemaPrevio[]): string | null {
  if (excluidas.includes(p.fuenteUrlNormalizada)) return "esa noticia ya la habíamos usado";
  const repetido = temaRepetido({ tema: p.tema, titulo: p.titulo }, temas);
  if (repetido) return `es el mismo tema que «${repetido.tema}», que ya propusimos`;
  return null;
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
  const usos: Array<UsoClaude | null> = [];
  const fallar = async (motivo: string): Promise<ResultadoCorrida> => {
    if (usos.length) datos.uso = juntarUsos(...usos);
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
    const temas = await temasRecientes(ahora());
    const gustos = await gustosRecientes();
    const hasta = Date.now() + PLAZO_CLAUDE_MS;
    const pedido = { hoy: diaArgentino(ahora()), excluidas, temas, gustos: gustos.lineas, hasta };

    // Si elige una noticia ya usada o un tema repetido, se le pide otra elección UNA vez.
    let r = await buscarYEscribir(pedido, deps.redactor);
    usos.push(r.uso);
    if (!r.ok) return await fallar(r.motivo);
    const problema = problemaDeEleccion(r.valor, excluidas, temas);
    if (problema) {
      r = await buscarYEscribir({ ...pedido, rechazo: { tema: r.valor.tema, motivo: problema } }, deps.redactor);
      usos.push(r.uso);
      if (!r.ok) return await fallar(r.motivo);
      const otra = problemaDeEleccion(r.valor, excluidas, temas);
      if (otra) return await fallar(`Claude insistió con una noticia que no sirve (${otra}).`);
    }
    const propuesta = r.valor;
    datos.fuenteUrlOriginal = propuesta.fuenteUrl;
    datos.fuenteTitulo = propuesta.fuenteTitulo;
    datos.fuenteMedio = propuesta.fuenteMedio ?? null;
    datos.tema = propuesta.tema;
    datos.categoria = propuesta.categoria;

    // La página de la noticia se baja una sola vez: texto para el detector de copia e imagen.
    const pagina = await paginaDeLaFuente(propuesta.fuenteUrl, deps.redactor);
    const extractos = recortarExtractos([...r.extractos, pagina.texto]);
    datos.extractos = extractos;
    const fuente = { titulo: propuesta.fuenteTitulo, url: propuesta.fuenteUrl };
    const limpia = await sinCopia({ titulo: propuesta.titulo, bajada: propuesta.bajada, cuerpo: propuesta.cuerpo }, fuente, extractos, hasta, deps);
    usos.push(limpia.uso);
    if (!limpia.ok) return await fallar(limpia.motivo);
    const nota = limpia.nota;
    datos.nota = nota;
    datos.uso = juntarUsos(...usos);

    const foto = await fotoDeLaNoticia(workspaceId, pagina.imagen, propuesta, nota.titulo, deps);
    datos.foto = foto;

    const categoryId = await categoriaNoticias(workspaceId);
    const parseado = parseContentPostCreate({
      ...contenidoDelBorrador(nota, { url: propuesta.fuenteUrl, titulo: propuesta.fuenteTitulo, medio: propuesta.fuenteMedio }, foto),
      slug: await slugLibre(workspaceId, nota.titulo, diaArgentino(ahora())),
      status: "DRAFT",
      heroImageUrl: foto?.url ?? null,
      ogImageUrl: foto?.url ?? null,
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
      fotoCredito: foto?.credito.texto ?? null,
    };
    const messageId = await mandarPropuesta(
      destino,
      { fotoUrl: foto?.url ?? null, leyenda: armarMensajePropuesta(datosMensaje, MAX_LEYENDA_FOTO), texto: armarMensajePropuesta(datosMensaje, 4096), teclado: tecladoDePropuesta(propuestaId) },
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
    const d = datosDe(p);
    const reclamo = await prisma.fotofficeAgentePropuesta.updateMany({
      where: { id: p.id, estado: "PENDIENTE" },
      data: { estado: "PUBLICADA", resueltaEn: ahora, datos: { ...d, resultado: "PUBLICADA" } as object },
    });
    if (reclamo.count !== 1) return { ok: false, texto: "Esa propuesta ya no está pendiente." };
    const cuando = horaDePublicacion(ahora);
    const cambios = parseContentPostUpdate({ status: "PUBLISHED", publishedAt: cuando.toISOString() });
    const post = cambios.success ? await updateBlogPost(p.workspaceId, p.blogPostId, cambios.data).catch(() => null) : null;
    if (!post) {
      await prisma.fotofficeAgentePropuesta.updateMany({ where: { id: p.id }, data: { estado: "PENDIENTE", resueltaEn: null, datos: d as object } }).catch(() => undefined);
      return { ok: false, texto: "No pude publicar el borrador (¿lo borraron del blog?)." };
    }
    return { ok: true, texto: `✅ Aprobada: sale publicada ${textoDePublicacion(cuando, ahora)}.` };
  } catch (e) {
    registrar("publicarPropuesta", e);
    return { ok: false, texto: "No pude publicarla por un error interno." };
  }
}

/**
 * Descartar: la propuesta queda DESCARTADA y su borrador (si sigue en borrador) se borra. Con
 * `otra` (el botón "Otra noticia") el resultado que se aprende es "OTRA".
 */
export async function descartarPropuesta(propuestaId: string, deps: { ahora?: () => Date; otra?: boolean } = {}): Promise<ResultadoAccion> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  try {
    const p = await propuestaPendiente(propuestaId);
    if (!p) return { ok: false, texto: "No encontré esa propuesta." };
    if (p.estado === "DESCARTADA") return { ok: false, texto: "Esa nota ya estaba descartada." };
    const resultado: ResultadoPropuesta = deps.otra ? "OTRA" : "DESCARTADA";
    const reclamo = await prisma.fotofficeAgentePropuesta.updateMany({
      where: { id: p.id, estado: "PENDIENTE" },
      data: { estado: "DESCARTADA", resueltaEn: ahora, datos: { ...datosDe(p), resultado } as object },
    });
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

/** Guarda el uso acumulado sin pisar el resto de `datos` (se relee la fila). */
async function guardarUso(propuestaId: string, uso: UsoClaude): Promise<void> {
  try {
    const fila = await prisma.fotofficeAgentePropuesta.findFirst({ where: { id: propuestaId }, select: { datos: true } });
    if (fila) await prisma.fotofficeAgentePropuesta.update({ where: { id: propuestaId }, data: { datos: { ...datosDe(fila), uso } as object } });
  } catch (e) {
    registrar("guardarUso", e);
  }
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
    if (!r.ok) {
      await guardarUso(p.id, juntarUsos(d.uso, r.uso));
      return void (await decir(`No pude reescribirla: ${escaparHtml(r.motivo)} Probá de nuevo respondiendo al mensaje.`));
    }
    const limpia = await sinCopia(r.valor, fuente, d.extractos ?? [], hasta, deps);
    // Lo gastado en la corrección se suma a la propuesta aunque no se haya podido usar.
    const uso = juntarUsos(d.uso, r.uso, limpia.uso);
    if (!limpia.ok) {
      await guardarUso(p.id, uso);
      return void (await decir(`No pude reescribirla: ${escaparHtml(limpia.motivo)}`));
    }
    const nota = limpia.nota;

    const cambios = parseContentPostUpdate(contenidoDelBorrador(nota, { url: d.fuenteUrlOriginal, titulo: fuente.titulo, medio: d.fuenteMedio }, d.foto));
    const post = cambios.success ? await updateBlogPost(p.workspaceId, p.blogPostId, cambios.data).catch(() => null) : null;
    if (!post) {
      await guardarUso(p.id, uso);
      return void (await decir("No pude guardar la versión nueva en el borrador (¿lo borraron del blog?)."));
    }

    const version = p.correcciones + 1;
    const datosMensaje = {
      titulo: nota.titulo,
      bajada: nota.bajada,
      fuenteTitulo: fuente.titulo,
      fuenteMedio: d.fuenteMedio,
      fuenteUrl: d.fuenteUrlOriginal,
      editorUrl: editorDelBorrador(p.blogPostId),
      fotoCredito: d.foto?.credito.texto ?? null,
      version,
    };
    const messageId = await mandarPropuesta(
      destino,
      {
        fotoUrl: d.foto?.url ?? null,
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
        datos: {
          ...d,
          nota,
          uso,
          correccionesPedidas: [...(d.correccionesPedidas ?? []), pedido.trim().slice(0, 1000)],
          mensajes: [...(d.mensajes ?? []), ...(messageId ? [messageId] : [])],
        } as object,
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
        tema: d.tema ?? null,
        categoria: d.categoria ?? null,
        conFoto: Boolean(d.foto),
        resultado: d.resultado ?? null,
        costoUsd: costoUsd(d.uso),
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

/** Para la página Agentes: lo que el Periodista aprendió de los gustos de Daniel. `null` = falta la tabla. */
export async function gustosDelPeriodista(): Promise<ResumenGustos | null> {
  try {
    return await gustosRecientes();
  } catch (e) {
    registrar("gustosDelPeriodista", e);
    return esTablaFaltante(e) ? null : { resueltas: 0, lineas: [] };
  }
}

/** Para la página Agentes: el costo estimado en Claude de las propuestas de este mes (hora argentina). */
export async function costoDelMes(ahora: Date = new Date()): Promise<{ costoUsd: number; corridas: number } | null> {
  try {
    const filas = await prisma.fotofficeAgentePropuesta.findMany({
      where: { agente: AGENTE_PERIODISTA, creadaEn: { gte: inicioDelMesArgentino(ahora) } },
      select: { datos: true },
    });
    const total = filas.reduce((suma, f) => suma + costoUsd(datosDe(f).uso), 0);
    return { costoUsd: Math.round(total * 1_000_000) / 1_000_000, corridas: filas.length };
  } catch (e) {
    registrar("costoDelMes", e);
    return null;
  }
}
