/**
 * Subida con progreso real.
 *
 * `fetch` no informa cuánto lleva subido, y un archivo de cámara puede pesar
 * decenas de megabytes con mala señal: sin barra, la persona no sabe si está
 * avanzando o colgado. XMLHttpRequest sí avisa.
 *
 * Dos caminos, en este orden:
 *
 * 1. Directo al bucket. La plataforma corta en 4,5 MB el cuerpo de cualquier
 *    petición al servidor, así que una foto de cámara no puede pasar por ahí.
 *    Se pide un permiso firmado, el navegador deposita el archivo en el bucket
 *    y recién después el servidor lo baja y lo valida como siempre.
 * 2. Por el servidor, como toda la vida. Es la red de seguridad: si el permiso
 *    no llega o el bucket rechaza, la foto chica igual entra por acá.
 */

export type RespuestaSubida = {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
};

type Ticket = { url: string; key: string };

function parsear(texto: string): Record<string, unknown> {
  try {
    return JSON.parse(texto) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** PUT directo al bucket, con la barra de progreso real del archivo. */
function depositarEnBucket(input: {
  ticket: Ticket;
  file: File;
  onProgress: (porcentaje: number) => void;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", input.ticket.url);
    xhr.setRequestHeader("Content-Type", input.file.type || "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      input.onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };

    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    xhr.send(input.file);
  });
}

/** Envío clásico: el archivo viaja por el servidor. */
function enviarPorElServidor(input: {
  url: string;
  file: File;
  replace: boolean;
  onProgress: (porcentaje: number) => void;
}): Promise<RespuestaSubida> {
  return new Promise((resolve) => {
    const cuerpo = new FormData();
    cuerpo.set("file", input.file);
    if (input.replace) cuerpo.set("replace", "1");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", input.url);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      input.onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };

    const terminar = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: parsear(xhr.responseText),
      });
    };

    xhr.onload = terminar;
    xhr.onerror = () =>
      resolve({ ok: false, status: 0, json: { error: "NETWORK", message: "SIN_CONEXION" } });
    xhr.onabort = () =>
      resolve({ ok: false, status: 0, json: { error: "ABORTED", message: "SUBIDA_CANCELADA" } });

    xhr.send(cuerpo);
  });
}

export async function subirConProgreso(input: {
  url: string;
  file: File;
  replace: boolean;
  onProgress: (porcentaje: number) => void;
}): Promise<RespuestaSubida> {
  const directa = await intentarSubidaDirecta(input);
  if (directa) return directa;
  return enviarPorElServidor(input);
}

/**
 * Devuelve `null` cuando el camino directo no está disponible y hay que caer al
 * clásico. Una vez que el archivo llegó al bucket ya no se vuelve atrás: el
 * error que venga de ahí es del procesamiento, no del transporte, y reenviarlo
 * por el servidor sólo lo haría fallar de nuevo (o rebotar por tamaño).
 */
async function intentarSubidaDirecta(input: {
  url: string;
  file: File;
  replace: boolean;
  onProgress: (porcentaje: number) => void;
}): Promise<RespuestaSubida | null> {
  let ticket: Ticket | null = null;
  try {
    const res = await fetch(input.url.replace(/\/upload$/, "/upload-url"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: input.file.name,
        contentType: input.file.type,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ticket?: Ticket | null };
    ticket = json.ticket ?? null;
  } catch {
    return null;
  }
  if (!ticket?.url) return null;

  const depositada = await depositarEnBucket({
    ticket,
    file: input.file,
    onProgress: input.onProgress,
  });
  if (!depositada) return null;

  try {
    const res = await fetch(input.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inboxKey: ticket.key,
        fileName: input.file.name,
        contentType: input.file.type,
        replace: input.replace,
      }),
    });
    const json = parsear(await res.text());
    return { ok: res.ok, status: res.status, json };
  } catch {
    return {
      ok: false,
      status: 0,
      json: { error: "NETWORK", message: "SIN_CONEXION" },
    };
  }
}
