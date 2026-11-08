import type { TecladoTelegram } from "@/lib/telegram/api";

/**
 * El mensaje de Telegram de una propuesta del Periodista y sus botones. Módulo PURO.
 *
 * Con foto, el mensaje es la leyenda de la foto y Telegram la corta en 1024 caracteres: si no
 * entra, se acorta la bajada (y en último caso el título) en vez de dejar que Telegram la rechace.
 * El largo se mide sobre el HTML entero, que es más largo que lo visible: así nunca se pasa.
 */

export type AccionPeriodista = "PUBLICAR" | "OTRA" | "DESCARTAR";

const LETRA: Record<AccionPeriodista, string> = { PUBLICAR: "p", OTRA: "o", DESCARTAR: "d" };
const ACCION: Record<string, AccionPeriodista> = { p: "PUBLICAR", o: "OTRA", d: "DESCARTAR" };

/** `callback_data` de un botón: "pe:<letra>:<id de la propuesta>" (entra holgado en los 64 bytes). */
export function datoDeBoton(accion: AccionPeriodista, propuestaId: string): string {
  return `pe:${LETRA[accion]}:${propuestaId}`;
}

export function leerBoton(data: string): { accion: AccionPeriodista; propuestaId: string } | null {
  const m = /^pe:([pod]):([a-z0-9]{8,40})$/i.exec(data);
  if (!m) return null;
  const accion = ACCION[m[1]!.toLowerCase()];
  return accion ? { accion, propuestaId: m[2]! } : null;
}

export function tecladoDePropuesta(propuestaId: string): TecladoTelegram {
  return {
    inline_keyboard: [
      [{ text: "✅ Publicar", callback_data: datoDeBoton("PUBLICAR", propuestaId) }],
      [
        { text: "🔁 Otra noticia", callback_data: datoDeBoton("OTRA", propuestaId) },
        { text: "❌ Descartar", callback_data: datoDeBoton("DESCARTAR", propuestaId) },
      ],
    ],
  };
}

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type DatosMensaje = {
  titulo: string;
  bajada: string;
  fuenteTitulo: string;
  fuenteMedio?: string | null;
  fuenteUrl: string;
  /** Enlace al borrador en FOTOFFICE (null si falta la dirección pública). */
  editorUrl: string | null;
  /** Crédito de la foto de la nota (la de la noticia), o null si va sin foto. */
  fotoCredito?: string | null;
  /** 0 = primera versión; 1, 2… = correcciones. */
  version?: number;
};

const recortar = (texto: string, max: number) => (texto.length <= max ? texto : `${texto.slice(0, Math.max(0, max - 1)).trimEnd()}…`);

function armar(d: DatosMensaje, titulo: string, bajada: string, conEnlaceFuente = true): string {
  const encabezado = d.version ? `📰 <b>Periodista · versión ${d.version + 1}</b>` : "📰 <b>Propuesta del Periodista</b>";
  const fuente = d.fuenteMedio?.trim() ? `${d.fuenteMedio.trim()} — ${d.fuenteTitulo}` : d.fuenteTitulo;
  const lineas = [
    encabezado,
    "",
    `<b>${escaparHtml(titulo)}</b>`,
    escaparHtml(bajada),
    "",
    conEnlaceFuente
      ? `Fuente: <a href="${escaparHtml(d.fuenteUrl)}">${escaparHtml(recortar(fuente, 120))}</a>`
      : `Fuente: ${escaparHtml(recortar(fuente, 120))}`,
    d.editorUrl ? `<a href="${escaparHtml(d.editorUrl)}">Ver y editar el borrador en FOTOFFICE</a>` : null,
    d.fotoCredito ? `Foto: ${escaparHtml(recortar(d.fotoCredito, 80))}` : "Sin foto (la noticia no tenía una imagen usable).",
    "",
    "<i>Para corregir, respondé a este mensaje con lo que quieras cambiar.</i>",
  ];
  return lineas.filter((l): l is string => l !== null).join("\n");
}

/** El HTML del mensaje, que nunca pasa de `limite` caracteres (1024 con foto, 4096 sin foto). */
export function armarMensajePropuesta(d: DatosMensaje, limite: number): string {
  let titulo = d.titulo.trim();
  let bajada = d.bajada.trim();
  let html = armar(d, titulo, bajada);
  // Primero se acorta la bajada; si no alcanza, también el título.
  while (html.length > limite && bajada.length > 40) {
    bajada = recortar(bajada, Math.max(40, bajada.length - (html.length - limite) - 1));
    html = armar(d, titulo, bajada);
  }
  while (html.length > limite && titulo.length > 30) {
    titulo = recortar(titulo, Math.max(30, titulo.length - (html.length - limite) - 1));
    html = armar(d, titulo, bajada);
  }
  // Una dirección de la fuente larguísima: se muestra el nombre sin enlace (el enlace queda en la nota).
  if (html.length > limite) html = armar(d, titulo, bajada, false);
  return html.length > limite ? escaparHtml(recortar(`${titulo}\n${bajada}`, Math.floor(limite / 2))) : html;
}

/** Aviso corto de error (spec: "llega un aviso corto por Telegram"). */
export function mensajeDeFallo(motivo: string): string {
  return `⚠️ <b>El Periodista no pudo preparar la nota.</b>\n${escaparHtml(recortar(motivo, 300))}`;
}
