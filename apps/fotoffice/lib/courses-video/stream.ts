import { readStreamConfig, type StreamConfig } from "./config";

/**
 * El trato con Cloudflare Stream.
 *
 * Tres operaciones y nada más: pedir una URL de subida, preguntar cómo viene el procesado y
 * —en la etapa del alumno— firmar el permiso de reproducción.
 *
 * Las dependencias entran por parámetro para poder probarlo sin red ni credenciales. Los
 * valores por defecto salen del entorno y de `fetch`.
 */

const API = "https://api.cloudflare.com/client/v4";

/** El único lugar desde donde se permite reproducir. Un enlace suelto no sirve en otro sitio. */
const ORIGENES_PERMITIDOS = ["fotoffice.com"];

/**
 * Falla del proveedor.
 *
 * El mensaje **nunca** incluye el token: un error de video no puede terminar filtrando una
 * credencial a un registro. Guarda el código para poder distinguir "no configurado" de
 * "rechazado".
 */
export class StreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StreamError";
  }
}

type Deps = {
  config?: StreamConfig;
  fetchImpl?: typeof fetch;
};

function resolverConfig(deps: Deps): StreamConfig {
  if (deps.config) return deps.config;
  const leida = readStreamConfig();
  if (!leida.ok) {
    throw new StreamError(`Falta configurar: ${leida.missing.join(", ")}.`, 0);
  }
  return leida.config;
}

async function pedir(
  ruta: string,
  init: RequestInit,
  deps: Deps,
): Promise<Record<string, unknown>> {
  const config = resolverConfig(deps);
  const hacerPedido = deps.fetchImpl ?? fetch;
  const respuesta = await hacerPedido(`${API}/accounts/${config.accountId}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!respuesta.ok) {
    // Sin cuerpo crudo del proveedor: puede traer el pedido completo, token incluido.
    throw new StreamError(
      `El proveedor de video rechazó la operación (${respuesta.status}).`,
      respuesta.status,
    );
  }
  return (await respuesta.json()) as Record<string, unknown>;
}

/**
 * Una URL de subida de un solo uso.
 *
 * El archivo **no pasa por nuestro servidor**: el navegador sube contra esta URL. Las
 * funciones de Vercel rechazan cualquier pedido de más de 4,5 MB, y un video de una clase
 * pesa cientos de megas.
 */
export async function createDirectUpload(
  input: { maxDurationSeconds: number },
  deps: Deps = {},
): Promise<{ uid: string; uploadUrl: string }> {
  const json = await pedir(
    "/stream/direct_upload",
    {
      method: "POST",
      body: JSON.stringify({
        maxDurationSeconds: input.maxDurationSeconds,
        requireSignedURLs: true,
        allowedOrigins: ORIGENES_PERMITIDOS,
      }),
    },
    deps,
  );

  const result = (json.result ?? {}) as { uid?: string; uploadURL?: string };
  if (!result.uid || !result.uploadURL) {
    throw new StreamError("El proveedor de video no devolvió la URL de subida.", 0);
  }
  return { uid: result.uid, uploadUrl: result.uploadURL };
}

export type VideoStatus = "PROCESSING" | "READY" | "ERROR";

/**
 * Cómo viene el video.
 *
 * Cualquier estado que no sea `ready` o `error` se informa como "procesando": tomar por
 * listo un estado desconocido mostraría una clase que todavía no se puede ver.
 */
export async function getVideoStatus(
  uid: string,
  deps: Deps = {},
): Promise<{ status: VideoStatus; durationSeconds: number | null; thumbnailUrl: string | null }> {
  const json = await pedir(`/stream/${encodeURIComponent(uid)}`, { method: "GET" }, deps);
  const result = (json.result ?? {}) as {
    status?: { state?: string };
    duration?: number;
    thumbnail?: string;
  };

  const estado = result.status?.state;
  const status: VideoStatus =
    estado === "ready" ? "READY" : estado === "error" ? "ERROR" : "PROCESSING";

  return {
    status,
    // La duración sólo es confiable cuando el procesado terminó.
    durationSeconds:
      status === "READY" && typeof result.duration === "number"
        ? Math.floor(result.duration)
        : null,
    thumbnailUrl: status === "READY" ? (result.thumbnail ?? null) : null,
  };
}
