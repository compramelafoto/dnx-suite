import type { StreamConfig } from "@/lib/courses-video/config";
import { StreamError } from "@/lib/courses-video/stream";

/**
 * El trato con Cloudflare Stream Live: el live input del canal y sus outputs.
 *
 * Endpoints verificados el 10/11/2026 en developers.cloudflare.com/stream:
 * - `POST   /accounts/{id}/stream/live_inputs`                       crear el canal
 * - `GET    /accounts/{id}/stream/live_inputs/{uid}`                 estado y clave de OBS
 * - `POST   /accounts/{id}/stream/live_inputs/{uid}/rotate_keys`     regenerar la clave de OBS
 * - `POST   /accounts/{id}/stream/live_inputs/{uid}/outputs`         sumar un destino
 * - `DELETE /accounts/{id}/stream/live_inputs/{uid}/outputs/{out}`   sacar un destino
 * - `GET    /accounts/{id}/stream/live_inputs/{uid}/videos`          grabaciones del canal
 *
 * La configuración y `fetch` entran por parámetro: las pruebas no tocan la red. Los errores
 * nunca llevan el token ni las claves de destino (el cuerpo que mandamos no se repite nunca).
 */

const API = "https://api.cloudflare.com/client/v4";

export type CloudflareDeps = { config: StreamConfig; fetchImpl?: typeof fetch };

async function motivo(respuesta: Response): Promise<string> {
  try {
    const cuerpo = (await respuesta.json()) as { errors?: Array<{ code?: unknown; message?: unknown }> };
    const motivos = (cuerpo.errors ?? [])
      .map((e) => [e.code, e.message].filter((x) => typeof x === "number" || typeof x === "string").join(" "))
      .filter(Boolean)
      .map((m) => m.slice(0, 200));
    return motivos.length ? `: ${motivos.join("; ")}` : "";
  } catch {
    return "";
  }
}

async function pedir(
  ruta: string,
  init: RequestInit,
  deps: CloudflareDeps,
  opciones: { aceptar404?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  const hacer = deps.fetchImpl ?? fetch;
  const respuesta = await hacer(`${API}/accounts/${deps.config.accountId}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${deps.config.apiToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (respuesta.status === 404 && opciones.aceptar404) return null;
  if (!respuesta.ok) {
    throw new StreamError(
      `Cloudflare rechazó la operación (${respuesta.status})${await motivo(respuesta)}.`,
      respuesta.status,
    );
  }
  // Un DELETE puede volver sin cuerpo.
  const texto = await respuesta.text();
  if (!texto) return {};
  try {
    return JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function resultado(json: Record<string, unknown> | null): Record<string, unknown> {
  const r = json?.result;
  return r && typeof r === "object" ? (r as Record<string, unknown>) : {};
}

export type LiveInput = {
  uid: string;
  rtmpsUrl: string;
  /** La clave de OBS. Secreta: sólo para mostrarla al dueño a pedido. */
  rtmpsStreamKey: string;
  srtUrl: string | null;
  /** `connected`, `client_disconnect`, … o null si nunca transmitió. */
  status: string | null;
};

function leerLiveInput(r: Record<string, unknown>): LiveInput {
  const rtmps = (r.rtmps ?? {}) as { url?: unknown; streamKey?: unknown };
  const srt = (r.srt ?? {}) as { url?: unknown };
  if (typeof r.uid !== "string" || typeof rtmps.url !== "string" || typeof rtmps.streamKey !== "string") {
    throw new StreamError("Cloudflare no devolvió los datos del canal.", 0);
  }
  return {
    uid: r.uid,
    rtmpsUrl: rtmps.url,
    rtmpsStreamKey: rtmps.streamKey,
    srtUrl: typeof srt.url === "string" ? srt.url : null,
    status: typeof r.status === "string" ? r.status : null,
  };
}

/**
 * Lo que se le pide a Cloudflare al crear el canal: grabar siempre y exigir URL firmada para
 * mirar (el vivo y sus grabaciones). Sin `allowedOrigins`: el sitio público puede estar en un
 * dominio propio; lo que protege es la firma, que vence.
 */
export function cuerpoNuevoLiveInput(nombre: string) {
  return {
    meta: { name: nombre.slice(0, 120) },
    recording: {
      mode: "automatic",
      requireSignedURLs: true,
      // 0 = lo que Cloudflare recomienda: tolera cortes breves de OBS sin partir la grabación.
      timeoutSeconds: 0,
    },
  };
}

export async function crearLiveInput(nombre: string, deps: CloudflareDeps): Promise<LiveInput> {
  const json = await pedir("/stream/live_inputs", { method: "POST", body: JSON.stringify(cuerpoNuevoLiveInput(nombre)) }, deps);
  return leerLiveInput(resultado(json));
}

/** `null` si el canal ya no existe en Cloudflare (lo borraron a mano). */
export async function leerLiveInputRemoto(uid: string, deps: CloudflareDeps): Promise<LiveInput | null> {
  const json = await pedir(`/stream/live_inputs/${encodeURIComponent(uid)}`, { method: "GET" }, deps, { aceptar404: true });
  return json ? leerLiveInput(resultado(json)) : null;
}

export async function regenerarClaves(uid: string, deps: CloudflareDeps): Promise<LiveInput> {
  const json = await pedir(`/stream/live_inputs/${encodeURIComponent(uid)}/rotate_keys`, { method: "POST" }, deps);
  return leerLiveInput(resultado(json));
}

export async function crearOutput(
  uid: string,
  destino: { url: string; streamKey: string },
  deps: CloudflareDeps,
): Promise<string> {
  const json = await pedir(
    `/stream/live_inputs/${encodeURIComponent(uid)}/outputs`,
    { method: "POST", body: JSON.stringify({ url: destino.url, streamKey: destino.streamKey, enabled: true }) },
    deps,
  );
  const r = resultado(json);
  if (typeof r.uid !== "string") throw new StreamError("Cloudflare no devolvió el destino creado.", 0);
  return r.uid;
}

/** Borrar un destino que ya no existe no es un error: el resultado buscado ya está. */
export async function borrarOutput(uid: string, outputUid: string, deps: CloudflareDeps): Promise<void> {
  await pedir(
    `/stream/live_inputs/${encodeURIComponent(uid)}/outputs/${encodeURIComponent(outputUid)}`,
    { method: "DELETE" },
    deps,
    { aceptar404: true },
  );
}

export type VideoDelCanal = {
  uid: string;
  estado: "LISTA" | "ERROR" | "PROCESANDO" | "EN_VIVO";
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  creado: Date | null;
};

export async function listarVideosDelCanal(uid: string, deps: CloudflareDeps): Promise<VideoDelCanal[]> {
  const json = await pedir(`/stream/live_inputs/${encodeURIComponent(uid)}/videos`, { method: "GET" }, deps, { aceptar404: true });
  const lista = Array.isArray(json?.result) ? (json!.result as Record<string, unknown>[]) : [];
  return lista.flatMap((v) => {
    if (typeof v.uid !== "string") return [];
    const state = (v.status as { state?: unknown } | undefined)?.state;
    const estado =
      state === "ready" ? "LISTA" : state === "error" ? "ERROR" : state === "live-inprogress" ? "EN_VIVO" : "PROCESANDO";
    const creado = typeof v.created === "string" ? new Date(v.created) : null;
    return [
      {
        uid: v.uid,
        estado,
        durationSeconds: estado === "LISTA" && typeof v.duration === "number" && v.duration > 0 ? Math.round(v.duration) : null,
        thumbnailUrl: estado === "LISTA" && typeof v.thumbnail === "string" ? v.thumbnail : null,
        creado: creado && !Number.isNaN(creado.getTime()) ? creado : null,
      } satisfies VideoDelCanal,
    ];
  });
}
