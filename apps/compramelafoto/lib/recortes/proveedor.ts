/**
 * El servicio que le quita el fondo a una foto. Por defecto remove.bg (borra las fotos después de
 * procesarlas); cualquier otro con la misma interfaz se configura con `REMOVE_BG_API_URL`.
 *
 * Sin `REMOVE_BG_API_KEY` está apagado: los huecos «Quitar el fondo» se imprimen con la foto entera.
 */

export type ServicioDeRecortes = { url: string; clave: string };

const URL_POR_DEFECTO = "https://api.remove.bg/v1.0/removebg";

export function servicioDeRecortes(env: Record<string, string | undefined> = process.env): ServicioDeRecortes | null {
  const clave = env.REMOVE_BG_API_KEY?.trim();
  if (!clave) return null;
  return { url: env.REMOVE_BG_API_URL?.trim() || URL_POR_DEFECTO, clave };
}

/** Devuelve el PNG con transparencia. Lanza un error con el mensaje del servicio si falla. */
export async function pedirRecorte(
  jpg: Uint8Array,
  servicio: ServicioDeRecortes,
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  const form = new FormData();
  form.append("image_file", new Blob([jpg], { type: "image/jpeg" }), "foto.jpg");
  form.append("size", "auto");
  form.append("type", "person");
  form.append("format", "png");
  const res = await fetchImpl(servicio.url, {
    method: "POST",
    headers: { "X-Api-Key": servicio.clave },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    let detalle = `error ${res.status}`;
    try {
      const j = (await res.json()) as { errors?: Array<{ title?: string }> };
      detalle = j.errors?.map((e) => e.title).filter(Boolean).join(" · ") || detalle;
    } catch {
      // sin cuerpo legible
    }
    throw new Error(`El servicio de recortes no pudo: ${detalle}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
