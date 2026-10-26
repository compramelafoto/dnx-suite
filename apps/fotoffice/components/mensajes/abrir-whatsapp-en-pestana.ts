/**
 * Abre WhatsApp en otra pestaña desde un clic. La pestaña se abre YA, antes de esperar al servidor
 * (si se abre después, el navegador la bloquea); cuando llega el enlace, se la lleva ahí. Se abre sin
 * `noopener` para poder dirigirla, así que el vínculo con esta página se corta a mano.
 *
 * Hay que llamarla en el mismo clic (no adentro de una transición ni después de un `await`): todo lo
 * anterior al primer `await` corre en el clic. Si el servidor rechaza o falla la conexión, la pestaña
 * vacía se cierra. Si el navegador no dejó abrirla, devuelve el enlace para mostrarlo a mano.
 */

export type ResultadoServidorWhatsapp = { ok: true; url: string } | { ok: false; error: string };
export type ResultadoPestana = { ok: false; error: string } | { ok: true; enPestana: true } | { ok: true; enPestana: false; url: string };

export async function abrirWhatsappEnPestana(enviar: () => Promise<ResultadoServidorWhatsapp>): Promise<ResultadoPestana> {
  const pestana = typeof window !== "undefined" ? window.open("", "_blank") : null;
  if (pestana) pestana.opener = null;
  let r: ResultadoServidorWhatsapp;
  try {
    r = await enviar();
  } catch (err) {
    pestana?.close();
    throw err;
  }
  if (!r.ok) {
    pestana?.close();
    return r;
  }
  if (pestana && !pestana.closed) {
    pestana.location.href = r.url;
    return { ok: true, enPestana: true };
  }
  return { ok: true, enPestana: false, url: r.url };
}
