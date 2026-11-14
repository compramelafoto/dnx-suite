/**
 * Aviso por correo al fotógrafo que se suma a un evento sin haber aceptado el cobro dividido.
 *
 * El carrito único del evento (Split 1:N) aparece sólo cuando TODAS las partes aceptaron; un
 * fotógrafo nuevo sin aceptar lo apaga para todos. Por eso, al sumarse, se le pide que acepte.
 * Por ahora corre sólo en los eventos de la lista (pedido de Daniel del 14/11/2026 para el
 * evento 193 «Producción Epet 2» de FOTOLAB MIDI).
 *
 * Este archivo no toca la base ni Resend: recibe las dependencias para poder probarlo.
 */

export const EVENTOS_CON_AVISO_COBRO_DIVIDIDO: ReadonlySet<number> = new Set([193]);

export const URL_CONFIGURACION_FOTOGRAFO = "https://www.compramelafoto.com/fotografo/configuracion";

export type ResultadoAviso = "enviado" | "evento_sin_aviso" | "ya_acepto" | "sin_correo" | "fallo_envio";

export type DepsAvisoEvento = {
  buscarFotografo(userId: number): Promise<{ email: string | null; name: string | null } | null>;
  buscarEvento(eventId: number): Promise<{ title: string; organizador: string | null } | null>;
  tieneCobroDivididoActivo(userId: number): Promise<boolean>;
  enviar(correo: { to: string; subject: string; html: string }): Promise<{ success: boolean }>;
};

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function primerNombre(nombre: string | null): string {
  const limpio = (nombre ?? "").trim();
  return limpio ? limpio.split(/\s+/)[0] : "";
}

export function armarCorreoAviso(params: {
  nombre: string | null;
  evento: string;
  organizador: string | null;
}): { subject: string; html: string } {
  const nombre = primerNombre(params.nombre);
  const evento = escapar(params.evento);
  const deQuien = params.organizador ? ` de ${escapar(params.organizador)}` : "";
  const enlace = URL_CONFIGURACION_FOTOGRAFO;
  return {
    subject: `${params.evento}: aceptá el cobro dividido para cobrar al instante`,
    html: `<p>Hola${nombre ? ` ${escapar(nombre)}` : ""},</p>
<p>Te sumaste al evento <b>«${evento}»</b>${deQuien} en ComprameLaFoto. Para que cada venta se reparta sola en el momento del pago
—la parte de cada fotógrafo, la del organizador y la del referidor, cada una directo a su Mercado Pago— necesitamos que aceptes el <b>cobro dividido</b>.</p>
<p>Lleva un minuto:</p>
<ol>
<li>Entrá a <a href="${enlace}">${enlace.replace("https://", "")}</a> con tu cuenta.</li>
<li>En la tarjeta <b>«Cobro dividido al instante»</b>, tocá <b>«Pedir invitación»</b>.</li>
<li>Mercado Pago te manda un correo con la invitación: aceptala.</li>
<li>Volvé a la misma pantalla y tocá <b>«Ya acepté, revisar»</b>. Tiene que quedar «✅ Cobro dividido activo».</li>
</ol>
<p>Mientras falte alguna aceptación, el evento vende igual, pero cada foto se cobra por separado en su álbum y no hay un único carrito para todo el evento.</p>
<p>Cualquier duda, respondé este correo.</p>
<p>Equipo de ComprameLaFoto</p>`,
  };
}

/** Nunca lanza: un aviso que falla no puede frenar la inscripción al evento. */
export async function avisarCobroDivididoAlSumarse(
  params: { eventId: number; userId: number },
  deps: DepsAvisoEvento,
): Promise<ResultadoAviso> {
  if (!EVENTOS_CON_AVISO_COBRO_DIVIDIDO.has(params.eventId)) return "evento_sin_aviso";
  try {
    if (await deps.tieneCobroDivididoActivo(params.userId)) return "ya_acepto";
    const [fotografo, evento] = await Promise.all([
      deps.buscarFotografo(params.userId),
      deps.buscarEvento(params.eventId),
    ]);
    const correo = fotografo?.email?.trim();
    if (!correo || !evento) return "sin_correo";
    const { subject, html } = armarCorreoAviso({
      nombre: fotografo?.name ?? null,
      evento: evento.title,
      organizador: evento.organizador,
    });
    const r = await deps.enviar({ to: correo, subject, html });
    return r.success ? "enviado" : "fallo_envio";
  } catch (err: unknown) {
    console.error("[aviso-cobro-dividido] fallo", {
      ...params,
      error: err instanceof Error ? err.message : String(err),
    });
    return "fallo_envio";
  }
}
