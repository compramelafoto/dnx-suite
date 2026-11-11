"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { Prisma, prisma } from "@repo/db";
import { requireLive } from "@/lib/en-vivo/acceso";
import { crearLiveInput, crearOutput, leerLiveInputRemoto, regenerarClaves } from "@/lib/en-vivo/cloudflare";
import { readLiveConfig } from "@/lib/en-vivo/config";
import { AVISO_NO_HABILITADA, LIVE_CONFIG_PATH, LIVE_PATH, LIVE_PORTAL_PATH, LIVE_RECORDINGS_PATH } from "@/lib/en-vivo/constantes";
import { armarOutputs, destinoUsado, validarClave, validarServidor, type DestinoUsado } from "@/lib/en-vivo/destinos";
import { cifrarClave, columnasTiktok, columnasYoutube, descifrarClave } from "@/lib/en-vivo/secretos";
import { cargarCanal, depsDeCloudflare, moverSesion, sesionActiva } from "@/lib/en-vivo/store";
import { PROVEEDOR_STREAM } from "@/lib/courses-video/youtube";
import { logCourseEvent } from "@/lib/presential-courses/log";

/**
 * Transmisión en vivo — acciones del panel. Todas exigen el módulo encendido y ser dueño o admin
 * (`requireLive`). Ninguna devuelve una clave de destino: lo único secreto que sale es la clave
 * de OBS, y sólo a pedido del dueño para copiarla.
 */

export type LiveActionState = { error: string | null; ok?: string | null };

function refrescar() {
  revalidatePath(LIVE_PATH);
  revalidatePath(LIVE_CONFIG_PATH);
  revalidatePath(LIVE_RECORDINGS_PATH);
  revalidatePath(LIVE_PORTAL_PATH);
}

function mensaje(error: unknown, porDefecto: string): string {
  return error instanceof Error && error.message ? error.message : porDefecto;
}

const texto = (formData: FormData, k: string) => formData.get(k)?.toString().trim() ?? "";

/** Crea el canal del workspace en Cloudflare (un live input que graba y exige URL firmada). */
export async function crearCanalAction(_prev: LiveActionState | undefined, _formData: FormData): Promise<LiveActionState> {
  try {
    const { user, workspace } = await requireLive();
    const deps = depsDeCloudflare();
    if (!deps) return { error: AVISO_NO_HABILITADA };
    if (await cargarCanal(workspace.id)) return { error: null, ok: "El canal ya estaba creado." };

    const input = await crearLiveInput(`FOTOFFICE · ${workspace.name}`, deps);
    try {
      await prisma.fotofficeLiveChannel.create({
        data: {
          workspaceId: workspace.id,
          liveInputUid: input.uid,
          rtmpsUrl: input.rtmpsUrl,
          srtUrl: input.srtUrl,
          createdByUserId: user.id,
        },
      });
    } catch (error) {
      // Dos clics a la vez: el otro ya lo creó. El live input de más queda huérfano en Cloudflare
      // (no graba ni cobra mientras nadie transmita a él).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { error: null, ok: "El canal ya estaba creado." };
      }
      throw error;
    }
    refrescar();
    return { error: null, ok: "Listo: el canal quedó creado. Copiá la dirección y la clave en OBS." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: mensaje(error, "No se pudo crear el canal.") };
  }
}

/** La clave de OBS completa, sólo para el botón «Copiar». No se guarda en ningún lado nuestro. */
export async function obtenerClaveObsAction(): Promise<{ clave: string | null; error: string | null }> {
  try {
    const { workspace } = await requireLive();
    const deps = depsDeCloudflare();
    if (!deps) return { clave: null, error: AVISO_NO_HABILITADA };
    const canal = await cargarCanal(workspace.id);
    if (!canal) return { clave: null, error: "Primero creá el canal." };
    const remoto = await leerLiveInputRemoto(canal.liveInputUid, deps);
    if (!remoto) return { clave: null, error: "Cloudflare no encuentra el canal. Avisá a FOTOFFICE." };
    return { clave: remoto.rtmpsStreamKey, error: null };
  } catch (error) {
    unstable_rethrow(error);
    return { clave: null, error: mensaje(error, "No se pudo leer la clave.") };
  }
}

/** Regenera la clave de OBS (por si se filtró). La vieja deja de andar en el momento. */
export async function regenerarClaveObsAction(_prev: LiveActionState | undefined, _formData: FormData): Promise<LiveActionState> {
  try {
    const { workspace } = await requireLive();
    const deps = depsDeCloudflare();
    if (!deps) return { error: AVISO_NO_HABILITADA };
    const canal = await cargarCanal(workspace.id);
    if (!canal) return { error: "Primero creá el canal." };
    const activa = await sesionActiva(canal.id);
    if (activa && activa.status !== "ESPERANDO_SENAL") {
      return { error: "Hay un vivo en curso: terminalo antes de regenerar la clave." };
    }
    const input = await regenerarClaves(canal.liveInputUid, deps);
    await prisma.fotofficeLiveChannel.update({
      where: { id: canal.id },
      data: { rtmpsUrl: input.rtmpsUrl, srtUrl: input.srtUrl },
    });
    refrescar();
    return { error: null, ok: "Clave nueva generada. Copiala y pegala de nuevo en OBS." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: mensaje(error, "No se pudo regenerar la clave.") };
  }
}

/** Guarda (cifrada) la clave persistente de YouTube Studio. */
export async function guardarClaveYoutubeAction(_prev: LiveActionState | undefined, formData: FormData): Promise<LiveActionState> {
  try {
    const { workspace } = await requireLive();
    const canal = await cargarCanal(workspace.id);
    if (!canal) return { error: "Primero creá el canal." };
    const clave = texto(formData, "clave");
    const invalida = validarClave(clave);
    if (invalida) return { error: invalida };
    const config = readLiveConfig();
    if (!config.ok || !config.puedeRecordarClaves) {
      return { error: "La plataforma todavía no puede guardar claves cifradas. Avisá a FOTOFFICE." };
    }
    await prisma.fotofficeLiveChannel.update({ where: { id: canal.id }, data: columnasYoutube(cifrarClave(clave)) });
    refrescar();
    return { error: null, ok: "Clave de YouTube guardada." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: mensaje(error, "No se pudo guardar la clave de YouTube.") };
  }
}

export async function borrarClaveYoutubeAction(_prev: LiveActionState | undefined, _formData: FormData): Promise<LiveActionState> {
  try {
    const { workspace } = await requireLive();
    await prisma.fotofficeLiveChannel.updateMany({ where: { workspaceId: workspace.id }, data: columnasYoutube(null) });
    refrescar();
    return { error: null, ok: "Clave de YouTube borrada." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: mensaje(error, "No se pudo borrar la clave.") };
  }
}

export async function olvidarClaveTiktokAction(_prev: LiveActionState | undefined, _formData: FormData): Promise<LiveActionState> {
  try {
    const { workspace } = await requireLive();
    await prisma.fotofficeLiveChannel.updateMany({
      where: { workspaceId: workspace.id },
      data: { ...columnasTiktok(null), tiktokServerUrl: null },
    });
    refrescar();
    return { error: null, ok: "Clave de TikTok olvidada." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: mensaje(error, "No se pudo olvidar la clave.") };
  }
}

const vivoSchema = z.object({
  title: z.string().min(1, "El vivo necesita un título.").max(200, "El título es demasiado largo."),
  visibility: z.enum(["PUBLICA", "SOCIOS"]),
});

/**
 * «Nuevo vivo»: crea el vivo y, en Cloudflare, un output por cada red elegida. Desde ahí, en
 * cuanto OBS empieza a transmitir, Cloudflare graba y retransmite solo.
 *
 * La clave de Instagram (y la de TikTok si no se pide recordarla) se usa acá y se descarta: sólo
 * la tiene Cloudflare, dentro del output, que se borra al terminar.
 */
export async function empezarVivoAction(_prev: LiveActionState | undefined, formData: FormData): Promise<LiveActionState> {
  try {
    const { user, workspace } = await requireLive();
    const deps = depsDeCloudflare();
    if (!deps) return { error: AVISO_NO_HABILITADA };
    const canal = await cargarCanal(workspace.id);
    if (!canal) return { error: "Primero creá el canal en Configurar." };
    if (await sesionActiva(canal.id)) return { error: "Ya hay un vivo abierto. Terminalo antes de empezar otro." };

    const parsed = vivoSchema.safeParse({ title: texto(formData, "title"), visibility: texto(formData, "visibility") });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos del vivo." };
    const datos = parsed.data;

    const elegido = (k: string) => formData.get(k) === "on";
    // Lo privado no se retransmite: la clase del Club no puede terminar en una red abierta.
    const conRedes = datos.visibility === "PUBLICA";
    if (!conRedes && (elegido("youtube") || elegido("instagram") || elegido("tiktok"))) {
      return { error: "Un vivo sólo para personas socias no se retransmite a redes. Destildá las redes o hacelo público." };
    }

    const descifrar = (cols: Parameters<typeof descifrarClave>[0]) => {
      try {
        return descifrarClave(cols);
      } catch {
        return null;
      }
    };
    const claveYoutube = elegido("youtube")
      ? descifrar({
          ciphertext: canal.youtubeKeyCiphertext,
          nonce: canal.youtubeKeyNonce,
          authTag: canal.youtubeKeyAuthTag,
          keyVersion: canal.youtubeKeyVersion,
        })
      : null;
    const claveTiktokGuardada = elegido("tiktok")
      ? descifrar({
          ciphertext: canal.tiktokKeyCiphertext,
          nonce: canal.tiktokKeyNonce,
          authTag: canal.tiktokKeyAuthTag,
          keyVersion: canal.tiktokKeyVersion,
        })
      : null;

    const armado = armarOutputs({
      youtube: { elegido: elegido("youtube"), claveGuardada: claveYoutube },
      instagram: { elegido: elegido("instagram"), servidor: texto(formData, "instagramServer"), clave: texto(formData, "instagramKey") },
      tiktok: {
        elegido: elegido("tiktok"),
        servidor: texto(formData, "tiktokServer"),
        clave: texto(formData, "tiktokKey"),
        claveGuardada: claveTiktokGuardada,
        servidorGuardado: canal.tiktokServerUrl,
      },
    });
    if (!armado.ok) return { error: armado.error };

    const sesion = await prisma.fotofficeLiveSession.create({
      data: {
        workspaceId: workspace.id,
        channelId: canal.id,
        title: datos.title,
        visibility: datos.visibility,
        createdByUserId: user.id,
      },
      select: { id: true },
    });

    const destinos: DestinoUsado[] = [];
    for (const o of armado.outputs) {
      try {
        destinos.push(destinoUsado(o, await crearOutput(canal.liveInputUid, o, deps)));
      } catch (error) {
        destinos.push(destinoUsado(o, null, mensaje(error, "No se pudo conectar el destino.")));
      }
    }
    await prisma.fotofficeLiveSession.update({
      where: { id: sesion.id },
      data: { destinations: destinos as unknown as Prisma.InputJsonValue },
    });

    // «Recordar la clave de TikTok»: sólo si se pegó una nueva y la plataforma puede cifrar.
    const tiktokNueva = texto(formData, "tiktokKey");
    if (elegido("tiktok") && elegido("tiktokRemember") && tiktokNueva && !validarClave(tiktokNueva)) {
      const servidor = texto(formData, "tiktokServer");
      const config = readLiveConfig();
      if (config.ok && config.puedeRecordarClaves) {
        await prisma.fotofficeLiveChannel.update({
          where: { id: canal.id },
          data: {
            ...columnasTiktok(cifrarClave(tiktokNueva)),
            ...(servidor && !validarServidor(servidor) ? { tiktokServerUrl: servidor } : {}),
          },
        });
      }
    }

    refrescar();
    const fallidos = destinos.filter((d) => d.estado === "ERROR");
    if (fallidos.length > 0) {
      return {
        error: `El vivo quedó listo, pero no se pudo conectar: ${fallidos.map((d) => d.destino).join(", ")}. Revisá servidor y clave.`,
      };
    }
    return { error: null, ok: "Vivo listo. Apretá «Iniciar transmisión» en OBS." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: mensaje(error, "No se pudo empezar el vivo.") };
  }
}

/** «Terminar vivo»: cierra el vivo y saca los destinos de Cloudflare. OBS se corta desde OBS. */
export async function terminarVivoAction(_prev: LiveActionState | undefined, formData: FormData): Promise<LiveActionState> {
  try {
    const { workspace } = await requireLive();
    const canal = await cargarCanal(workspace.id);
    const sessionId = texto(formData, "sessionId");
    const sesion = canal
      ? await prisma.fotofficeLiveSession.findFirst({
          where: { id: sessionId, channelId: canal.id },
          select: { id: true, status: true, startedAt: true, destinations: true },
        })
      : null;
    if (!canal || !sesion) return { error: "No encontramos ese vivo. Actualizá la pantalla." };
    await moverSesion(sesion, canal.liveInputUid, "TERMINAR", new Date());
    refrescar();
    return { error: null, ok: "Vivo terminado. La grabación aparece en Grabaciones en unos minutos." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: mensaje(error, "No se pudo terminar el vivo.") };
  }
}

/**
 * «Publicar como clase»: suma la grabación como clase al final de un curso grabado del workspace.
 * La clase usa el mismo video de Stream (sin copiarlo) y el mismo reproductor firmado del aula.
 */
export async function publicarComoClaseAction(_prev: LiveActionState | undefined, formData: FormData): Promise<LiveActionState> {
  try {
    const { workspace } = await requireLive();
    const recordingId = texto(formData, "recordingId");
    const courseId = texto(formData, "courseId");
    if (!recordingId || !courseId) return { error: "Elegí el curso." };

    const [grabacion, curso] = await Promise.all([
      prisma.fotofficeLiveRecording.findFirst({
        where: { id: recordingId, workspaceId: workspace.id },
        select: { id: true, videoUid: true, status: true, durationSeconds: true, thumbnailUrl: true, publishedLessonId: true, session: { select: { title: true } } },
      }),
      prisma.course.findFirst({ where: { id: courseId, workspaceId: workspace.id }, select: { id: true, deliveryMode: true } }),
    ]);
    if (!grabacion) return { error: "No encontramos esa grabación." };
    if (grabacion.status !== "LISTA") return { error: "La grabación todavía se está procesando." };
    if (grabacion.publishedLessonId) return { error: "Esta grabación ya está publicada como clase." };
    if (!curso) return { error: "No encontramos ese curso." };
    if (curso.deliveryMode !== "RECORDED") return { error: "Sólo un curso grabado tiene clases con video." };

    const titulo = texto(formData, "title") || grabacion.session.title;
    const ultima = await prisma.courseLesson.findFirst({
      where: { courseId: curso.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const clase = await prisma.$transaction(async (tx) => {
      const creada = await tx.courseLesson.create({
        data: {
          courseId: curso.id,
          title: titulo.slice(0, 200),
          sortOrder: (ultima?.sortOrder ?? -1) + 1,
          videoProvider: PROVEEDOR_STREAM,
          videoUid: grabacion.videoUid,
          videoStatus: "READY",
          durationSeconds: grabacion.durationSeconds,
          thumbnailUrl: grabacion.thumbnailUrl,
        },
        select: { id: true },
      });
      await tx.fotofficeLiveRecording.update({
        where: { id: grabacion.id },
        data: { publishedCourseId: curso.id, publishedLessonId: creada.id, publishedAt: new Date() },
      });
      return creada;
    });

    logCourseEvent("clase_desde_vivo", { workspaceId: workspace.id, courseId: curso.id, lessonId: clase.id });
    revalidatePath(`/dashboard/courses/${curso.id}`);
    refrescar();
    return { error: null, ok: "Listo: la grabación quedó como la última clase del curso." };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Ese video ya está en otra clase." };
    }
    return { error: mensaje(error, "No se pudo publicar la clase.") };
  }
}
