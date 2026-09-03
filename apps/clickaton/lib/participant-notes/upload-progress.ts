/**
 * Subida con progreso real.
 *
 * `fetch` no informa cuánto lleva subido, y un archivo de cámara puede pesar
 * decenas de megabytes con mala señal: sin barra, la persona no sabe si está
 * avanzando o colgado. XMLHttpRequest sí avisa.
 */

export type RespuestaSubida = {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
};

export function subirConProgreso(input: {
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
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        /* respuesta no-JSON: se informa por el status */
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json });
    };

    xhr.onload = terminar;
    xhr.onerror = () =>
      resolve({ ok: false, status: 0, json: { error: "NETWORK", message: "SIN_CONEXION" } });
    xhr.onabort = () =>
      resolve({ ok: false, status: 0, json: { error: "ABORTED", message: "SUBIDA_CANCELADA" } });

    xhr.send(cuerpo);
  });
}
