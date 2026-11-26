import "server-only";
import { prisma } from "@repo/db";
import { leerTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";
import { detalleDeError } from "./registro";

/**
 * Campaña de Meta de los chats de la Bandeja (§8 del diseño 2026-11-24). El `referral` de WhatsApp
 * trae el anuncio pero no la campaña: se le pregunta a Meta una vez por anuncio con el token de
 * WhatsApp del workspace y se guarda en `FotofficeMetaAnuncio`. Si Meta no contesta o falta el
 * permiso `ads_read`, queda el error y se reintenta (hasta 7 veces, una por día). Nunca lanza.
 */

const AD_ID = /^[0-9]{1,30}$/;
const INTENTOS_MAXIMOS = 7;
const HORAS_ENTRE_INTENTOS = 20;
const DIAS_FILTRO = 90;
const TIEMPO_MAXIMO_MS = 8_000;

type Deps = { fetch?: typeof fetch; ahora?: Date; leerToken?: (workspaceId: string) => Promise<string | null>; titulo?: string | null };

type RespuestaMeta = { name?: unknown; adset?: { name?: unknown }; campaign?: { id?: unknown; name?: unknown }; error?: { code?: unknown } };
const texto = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Pregunta a Meta el anuncio y guarda (o actualiza) su fila. `titulo`: el del referral, si se tiene. */
export async function consultarAnuncio(workspaceId: string, adId: string, deps: Deps = {}): Promise<void> {
  if (!AD_ID.test(adId)) return;
  const ahora = deps.ahora ?? new Date();
  let datos: { adName: string | null; adsetName: string | null; campaignId: string | null; campaignName: string | null; error: string | null };
  try {
    const token = await (deps.leerToken ?? leerTokenWhatsapp)(workspaceId).catch(() => null);
    if (!token) {
      datos = { adName: null, adsetName: null, campaignId: null, campaignName: null, error: "SIN_TOKEN" };
    } else {
      const version = process.env.WHATSAPP_API_VERSION || "v21.0";
      const campos = encodeURIComponent("name,adset{name},campaign{id,name}").replace(/%2C/g, ",");
      const res = await (deps.fetch ?? fetch)(`https://graph.facebook.com/${version}/${adId}?fields=${campos}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      const cuerpo = (await res.json().catch(() => null)) as RespuestaMeta | null;
      const campaignId = cuerpo?.campaign && (typeof cuerpo.campaign.id === "string" || typeof cuerpo.campaign.id === "number") ? String(cuerpo.campaign.id) : null;
      datos = res.ok && cuerpo
        ? { adName: texto(cuerpo.name), adsetName: texto(cuerpo.adset?.name), campaignId, campaignName: texto(cuerpo.campaign?.name), error: campaignId ? null : "SIN_CAMPANA" }
        : { adName: null, adsetName: null, campaignId: null, campaignName: null, error: `META_${typeof cuerpo?.error?.code === "number" ? cuerpo.error.code : res.status}` };
    }
  } catch {
    datos = { adName: null, adsetName: null, campaignId: null, campaignName: null, error: "RED" };
  }
  try {
    const previo = await prisma.fotofficeMetaAnuncio.findUnique({ where: { workspaceId_adId: { workspaceId, adId } } });
    const titulo = texto(deps.titulo ?? null) ?? previo?.titulo ?? null;
    // Un error no borra lo que ya se sabía del anuncio.
    const guardar = datos.error && previo?.campaignId ? { error: datos.error } : datos;
    if (previo) {
      await prisma.fotofficeMetaAnuncio.update({ where: { id: previo.id }, data: { ...guardar, titulo, consultadoEn: ahora, intentos: { increment: 1 } } });
    } else {
      await prisma.fotofficeMetaAnuncio.create({ data: { workspaceId, adId, titulo, ...datos, consultadoEn: ahora, intentos: 1 } });
    }
  } catch (e) {
    console.error("[fotoffice][bandeja] no se pudo guardar el anuncio de Meta", detalleDeError(e));
  }
}

/** Pregunta la campaña sólo de los anuncios que todavía no están guardados (tras el webhook). */
export async function consultarAnunciosNuevos(lista: readonly { workspaceId: string; adId: string; titulo: string | null }[], deps: Deps = {}): Promise<void> {
  for (const a of lista) {
    try {
      const ya = await prisma.fotofficeMetaAnuncio.findUnique({ where: { workspaceId_adId: { workspaceId: a.workspaceId, adId: a.adId } }, select: { id: true } });
      if (!ya) await consultarAnuncio(a.workspaceId, a.adId, { ...deps, titulo: a.titulo });
    } catch (e) {
      console.error("[fotoffice][bandeja] no se pudo revisar un anuncio nuevo", detalleDeError(e));
    }
  }
}

/** Anuncios sin campaña conocida para volver a preguntar (cron). */
export async function anunciosParaReintentar(ahora: Date = new Date()): Promise<{ workspaceId: string; adId: string }[]> {
  const filas = (await prisma.fotofficeMetaAnuncio.findMany({
    where: {
      campaignId: null,
      intentos: { lt: INTENTOS_MAXIMOS },
      OR: [{ consultadoEn: null }, { consultadoEn: { lte: new Date(ahora.getTime() - HORAS_ENTRE_INTENTOS * 3_600_000) } }],
    },
    take: 50,
    select: { workspaceId: true, adId: true },
  })) as { workspaceId: string; adId: string }[];
  return filas;
}

/** Vuelve a preguntar los anuncios pendientes. Devuelve cuántos consultó. */
export async function reintentarAnuncios(ahora: Date = new Date(), deps: Deps = {}): Promise<number> {
  try {
    const lista = await anunciosParaReintentar(ahora);
    for (const a of lista) await consultarAnuncio(a.workspaceId, a.adId, { ...deps, ahora });
    return lista.length;
  } catch (e) {
    console.error("[fotoffice][bandeja] falló el reintento de anuncios", detalleDeError(e));
    return 0;
  }
}

export type OpcionCampana = { valor: string; nombre: string; chats: number };

/**
 * Las campañas con chats en los últimos 90 días, de más a menos chats. Un anuncio sin campaña
 * conocida va solo (`ad:<id>`, con su título); los chats sin anuncio, al final como «Sin anuncio».
 */
export async function campanasRecientes(workspaceId: string, ahora: Date = new Date()): Promise<OpcionCampana[]> {
  try {
    const desde = new Date(ahora.getTime() - DIAS_FILTRO * 86_400_000);
    const grupos = (await prisma.fotofficeWaChat.groupBy({
      by: ["anuncioId"],
      where: { workspaceId, ultimoMensajeEn: { gte: desde } },
      _count: { _all: true },
    })) as unknown as { anuncioId: string | null; _count: { _all: number } }[];
    const ids = grupos.flatMap((g) => (g.anuncioId ? [g.anuncioId] : []));
    if (ids.length === 0) return [];
    const anuncios = (await prisma.fotofficeMetaAnuncio.findMany({
      where: { workspaceId, adId: { in: ids } },
      select: { adId: true, titulo: true, campaignId: true, campaignName: true },
    })) as { adId: string; titulo: string | null; campaignId: string | null; campaignName: string | null }[];
    const porAd = new Map(anuncios.map((a) => [a.adId, a]));
    const opciones = new Map<string, OpcionCampana>();
    let sinAnuncio = 0;
    for (const g of grupos) {
      if (!g.anuncioId) {
        sinAnuncio += g._count._all;
        continue;
      }
      const a = porAd.get(g.anuncioId);
      const valor = a?.campaignId ?? `ad:${g.anuncioId}`;
      const nombre = a?.campaignId ? (a.campaignName ?? `Campaña ${a.campaignId}`) : `Anuncio «${a?.titulo ?? g.anuncioId}» (sin campaña)`;
      const previo = opciones.get(valor);
      opciones.set(valor, { valor, nombre, chats: (previo?.chats ?? 0) + g._count._all });
    }
    const lista = [...opciones.values()].sort((x, y) => y.chats - x.chats || x.nombre.localeCompare(y.nombre, "es"));
    return sinAnuncio > 0 ? [...lista, { valor: "sin-anuncio", nombre: "Sin anuncio", chats: sinAnuncio }] : lista;
  } catch {
    return [];
  }
}

/** Los anuncios que forman una campaña (para filtrar la lista por `anuncioId`). */
export async function anunciosDeCampana(workspaceId: string, campaignId: string): Promise<string[]> {
  const filas = (await prisma.fotofficeMetaAnuncio.findMany({ where: { workspaceId, campaignId }, select: { adId: true } })) as { adId: string }[];
  return filas.map((f) => f.adId);
}

/** Nombre corto para el chip de la fila: la campaña, o el título del anuncio con «(sin campaña)». */
export async function etiquetasDeAnuncios(workspaceId: string, adIds: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(adIds)];
  if (unicos.length === 0) return new Map();
  try {
    const filas = (await prisma.fotofficeMetaAnuncio.findMany({
      where: { workspaceId, adId: { in: unicos } },
      select: { adId: true, titulo: true, campaignName: true },
    })) as { adId: string; titulo: string | null; campaignName: string | null }[];
    return new Map(filas.map((f) => [f.adId, f.campaignName ?? `${f.titulo ?? "Anuncio"} (sin campaña)`]));
  } catch {
    return new Map();
  }
}
