import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { playbackIframeUrl, signPlaybackToken, DURACION_PERMISO_SEGUNDOS } from "@/lib/courses-video/stream";
import { borrarOutput, leerLiveInputRemoto, listarVideosDelCanal, type CloudflareDeps } from "./cloudflare";
import { readLiveConfig } from "./config";
import { leerDestinosUsados, type DestinoUsado } from "./destinos";
import { ESTADOS_ACTIVOS, estaActivo, senalSegunCloudflare, transicion, type EstadoVivo, type EventoVivo } from "./estados";
import { elegirSesionParaGrabacion, tituloImprovisado } from "./grabaciones";
import type { AvisoStream } from "./webhook";

/**
 * La base de la transmisión en vivo. Todo lo que mueve un vivo pasa por `moverSesion`, que usa
 * la transición pura de `estados.ts`: los avisos de Cloudflare, la consulta del panel y el botón
 * «Terminar» llegan al mismo lugar y pueden repetirse sin daño.
 */

export function depsDeCloudflare(): CloudflareDeps | null {
  const config = readLiveConfig();
  return config.ok ? { config: config.stream } : null;
}

export async function cargarCanal(workspaceId: string) {
  return prisma.fotofficeLiveChannel.findUnique({ where: { workspaceId } });
}

export async function sesionActiva(channelId: string) {
  return prisma.fotofficeLiveSession.findFirst({
    where: { channelId, status: { in: [...ESTADOS_ACTIVOS] } },
    orderBy: { createdAt: "desc" },
  });
}

type SesionMinima = { id: string; status: EstadoVivo; startedAt: Date | null; destinations: Prisma.JsonValue };

/**
 * Saca los destinos de Cloudflare. Un destino que no se pudo borrar queda ACTIVO para intentar de
 * nuevo la próxima vez; la clave de Instagram se va con el output (nunca se guardó).
 */
async function cerrarDestinos(liveInputUid: string, destinos: DestinoUsado[]): Promise<DestinoUsado[]> {
  const deps = depsDeCloudflare();
  return Promise.all(
    destinos.map(async (d) => {
      if (d.estado !== "ACTIVO" || !d.outputUid || !deps) return d;
      try {
        await borrarOutput(liveInputUid, d.outputUid, deps);
        return { ...d, estado: "BORRADO" as const };
      } catch (error) {
        console.error("[fotoffice][en-vivo] no se pudo borrar un destino", {
          destino: d.destino,
          detalle: error instanceof Error ? error.message : "error desconocido",
        });
        return d;
      }
    }),
  );
}

/** Aplica un evento a un vivo y guarda sólo si algo cambió. Devuelve el estado nuevo. */
export async function moverSesion(
  sesion: SesionMinima,
  liveInputUid: string,
  evento: EventoVivo,
  at: Date,
): Promise<EstadoVivo> {
  const nuevo = transicion(sesion.status, evento);
  const data: Prisma.FotofficeLiveSessionUpdateManyMutationInput = {};
  if (evento === "SENAL_CONECTADA" || evento === "SENAL_CORTADA") data.lastSignalAt = at;
  if (nuevo !== sesion.status) data.status = nuevo;
  if (nuevo === "EN_VIVO" && !sesion.startedAt) data.startedAt = at;
  if (estaActivo(sesion.status) && !estaActivo(nuevo)) {
    data.endedAt = at;
    data.destinations = (await cerrarDestinos(liveInputUid, leerDestinosUsados(sesion.destinations))) as unknown as Prisma.InputJsonValue;
  }
  if (Object.keys(data).length > 0) {
    // `status` en el where: si otro aviso ya la movió, no se pisa.
    await prisma.fotofficeLiveSession.updateMany({ where: { id: sesion.id, status: sesion.status }, data });
  }
  return nuevo;
}

/**
 * Le pregunta a Cloudflare si hay señal y mueve el vivo abierto. Es lo que hace andar el panel
 * aunque los avisos (webhooks) no estén configurados. Nunca lanza: sin respuesta, no cambia nada.
 */
export async function reconciliarSenal(workspaceId: string): Promise<void> {
  const deps = depsDeCloudflare();
  if (!deps) return;
  const canal = await cargarCanal(workspaceId);
  if (!canal) return;
  const sesion = await sesionActiva(canal.id);
  if (!sesion) return;
  try {
    const remoto = await leerLiveInputRemoto(canal.liveInputUid, deps);
    const senal = senalSegunCloudflare(remoto?.status);
    if (senal === null) return;
    await moverSesion(sesion, canal.liveInputUid, senal ? "SENAL_CONECTADA" : "SENAL_CORTADA", new Date());
  } catch (error) {
    console.error("[fotoffice][en-vivo] no se pudo consultar la señal", {
      workspaceId,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
  }
}

type DatosGrabacion = {
  videoUid: string;
  estado: "LISTA" | "ERROR" | "PROCESANDO";
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  creado: Date | null;
};

/**
 * Anota una grabación del canal en el vivo que corresponde. Si OBS transmitió sin pasar por
 * «Nuevo vivo», se crea un vivo terminado, privado (SOCIOS), para que la grabación no se pierda.
 */
async function anotarGrabacion(
  canal: { id: string; workspaceId: string; liveInputUid: string },
  g: DatosGrabacion,
  ahora: Date,
): Promise<void> {
  const existente = await prisma.fotofficeLiveRecording.findUnique({
    where: { videoUid: g.videoUid },
    select: { id: true, sessionId: true, status: true },
  });

  let sessionId = existente?.sessionId ?? null;
  if (!sessionId) {
    const candidatas = await prisma.fotofficeLiveSession.findMany({
      where: { channelId: canal.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, status: true, createdAt: true, endedAt: true },
    });
    sessionId = elegirSesionParaGrabacion(candidatas, g.creado);
    if (!sessionId) {
      const at = g.creado ?? ahora;
      const creada = await prisma.fotofficeLiveSession.create({
        data: {
          workspaceId: canal.workspaceId,
          channelId: canal.id,
          title: tituloImprovisado(at),
          visibility: "SOCIOS",
          status: "TERMINADA",
          startedAt: at,
          endedAt: ahora,
        },
        select: { id: true },
      });
      sessionId = creada.id;
    }
  }

  const datos = {
    status: g.estado,
    durationSeconds: g.durationSeconds,
    thumbnailUrl: g.thumbnailUrl,
    ...(g.estado === "LISTA" ? { readyAt: ahora } : {}),
  };
  if (existente) {
    // Una lista no vuelve a "procesando" por un aviso viejo que llega tarde.
    if (existente.status !== "LISTA" || g.estado === "LISTA") {
      await prisma.fotofficeLiveRecording.update({ where: { id: existente.id }, data: datos });
    }
  } else {
    await prisma.fotofficeLiveRecording.upsert({
      where: { videoUid: g.videoUid },
      create: { workspaceId: canal.workspaceId, sessionId, videoUid: g.videoUid, recordedAt: g.creado, ...datos },
      update: datos,
    });
  }

  if (g.estado === "LISTA") {
    const sesion = await prisma.fotofficeLiveSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, startedAt: true, destinations: true },
    });
    if (sesion) await moverSesion(sesion, canal.liveInputUid, "GRABACION_LISTA", ahora);
  }
}

/** Trae de Cloudflare las grabaciones del canal que todavía no estén anotadas o listas. */
export async function sincronizarGrabaciones(workspaceId: string): Promise<void> {
  const deps = depsDeCloudflare();
  if (!deps) return;
  const canal = await cargarCanal(workspaceId);
  if (!canal) return;
  try {
    const videos = await listarVideosDelCanal(canal.liveInputUid, deps);
    const conocidas = new Map(
      (
        await prisma.fotofficeLiveRecording.findMany({
          where: { videoUid: { in: videos.map((v) => v.uid) } },
          select: { videoUid: true, status: true },
        })
      ).map((r) => [r.videoUid, r.status]),
    );
    const ahora = new Date();
    for (const v of videos) {
      if (v.estado === "EN_VIVO") continue;
      const previo = conocidas.get(v.uid);
      if (previo === "LISTA" || (previo && previo === v.estado)) continue;
      await anotarGrabacion(canal, { ...v, videoUid: v.uid, estado: v.estado }, ahora);
    }
  } catch (error) {
    console.error("[fotoffice][en-vivo] no se pudieron traer las grabaciones", {
      workspaceId,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
  }
}

export const DURACION_PERMISO_VIVO_SEGUNDOS = 6 * 60 * 60;

export type ResultadoAviso = "APLICADO" | "CANAL_DESCONOCIDO" | "SIN_VIVO";

/** Aplica un aviso de Cloudflare ya verificado. Idempotente. */
export async function aplicarAviso(aviso: AvisoStream, ahora: Date): Promise<ResultadoAviso> {
  const canal = await prisma.fotofficeLiveChannel.findUnique({
    where: { liveInputUid: aviso.liveInputUid },
    select: { id: true, workspaceId: true, liveInputUid: true },
  });
  if (!canal) return "CANAL_DESCONOCIDO";

  if (aviso.tipo === "GRABACION") {
    await anotarGrabacion(canal, aviso, ahora);
    return "APLICADO";
  }

  const sesion = await sesionActiva(canal.id);
  if (!sesion) return "SIN_VIVO";
  if (aviso.tipo === "ERROR_SENAL") {
    await prisma.fotofficeLiveSession.update({ where: { id: sesion.id }, data: { lastError: aviso.detalle } });
    return "APLICADO";
  }
  await moverSesion(sesion, canal.liveInputUid, aviso.conectada ? "SENAL_CONECTADA" : "SENAL_CORTADA", aviso.at);
  return "APLICADO";
}

/**
 * La dirección del reproductor de Stream para un vivo (uid del live input) o una grabación
 * (uid del video), con un permiso firmado que vence. `null` si la plataforma no está configurada.
 * Quien llama ya comprobó que la persona puede mirar (`visibilidad.ts`).
 */
export function urlDeReproduccion(uid: string, opciones: { vivo?: boolean } = {}): string | null {
  const config = readLiveConfig();
  if (!config.ok) return null;
  try {
    // Un vivo puede durar más que una clase grabada: el permiso alcanza para seis horas.
    const ttlSeconds = opciones.vivo ? DURACION_PERMISO_VIVO_SEGUNDOS : DURACION_PERMISO_SEGUNDOS;
    const token = signPlaybackToken({ videoUid: uid, ttlSeconds }, { config: config.stream });
    return playbackIframeUrl(token);
  } catch {
    return null;
  }
}
