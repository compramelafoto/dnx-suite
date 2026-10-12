"use server";

import { after } from "next/server";
import { avisarSeleccionEnviada } from "@/lib/galerias/avisos";
import { avisarDecisionAlbum } from "@/lib/galerias/avisos-album";
import { pedirDescargaDeCliente, urlDeParteDeCliente } from "@/lib/galerias/descargas";
import { iniciarPagoGaleria } from "@/lib/galerias/pago";
import { comentarFoto, descargarOriginal, elegirFoto, enviarSeleccion, urlDeDescarga, urlDeReproduccion, urlsDeVista, type Falla } from "@/lib/galerias/publico";
import { comentarLamina, decidirAlbum } from "@/lib/galerias/publico-album";
import { MENSAJES_PUBLICO } from "@/lib/galerias/publico-tipos";
import type { ComentarioLamina, ComentarioPublico } from "@/lib/galerias/publico-tipos";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import { visitanteDeAccion } from "./visitante";

/**
 * Acciones del enlace público de la galería, sin sesión: el token es la llave y el workspace sale del slug
 * de la dirección (un token de otra organización no sirve). Cada una pasa por el freno por IP (en memoria,
 * por instancia) y después `lib/galerias/publico.ts` vuelve a resolver el token y aplica las reglas.
 */

type Salida<T extends object = object> = ({ ok: true } & T) | Falla;

async function entrar(accion: string, tope: number, slug: unknown) {
  const v = await visitanteDeAccion(accion, tope);
  if (!v.permitido) return { ok: false, error: MENSAJES_PUBLICO.demasiados, codigo: "TOPE" } as const satisfies Falla;
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return { ok: false, error: MENSAJES_PUBLICO.enlaceInvalido, codigo: "INVALIDO" } as const satisfies Falla;
  return { ok: true, workspaceId } as const;
}

export async function elegirFotoAction(slug: unknown, token: unknown, fotoId: unknown, marcar: unknown): Promise<Salida<{ cantidad: number }>> {
  const e = await entrar("elegir", 600, slug);
  if (!e.ok) return e;
  return elegirFoto(e.workspaceId, token, fotoId, marcar);
}

export async function comentarAction(slug: unknown, token: unknown, fotoId: unknown, texto: unknown): Promise<Salida<{ comentario: ComentarioPublico }>> {
  const e = await entrar("comentar", 60, slug);
  if (!e.ok) return e;
  return comentarFoto(e.workspaceId, token, fotoId, texto);
}

export async function enviarSeleccionAction(slug: unknown, token: unknown, mensaje: unknown): Promise<Salida<{ cantidad: number; enviadaEn: string }>> {
  const e = await entrar("enviar", 10, slug);
  if (!e.ok) return e;
  const r = await enviarSeleccion(e.workspaceId, token, mensaje);
  if (!r.ok) return r;
  // Los correos salen después de responder; si fallan, queda en el historial y el cliente ya no espera.
  after(() => avisarSeleccionEnviada(r.aviso));
  return { ok: true, cantidad: r.cantidad, enviadaEn: r.enviadaEn };
}

/** Álbum: comentario en una lámina de la ronda abierta, con pin (x, y entre 0 y 1) o general. */
export async function comentarLaminaAction(slug: unknown, token: unknown, fotoId: unknown, texto: unknown, pin: unknown): Promise<Salida<{ comentario: ComentarioLamina }>> {
  const e = await entrar("comentar-lamina", 90, slug);
  if (!e.ok) return e;
  return comentarLamina(e.workspaceId, token, fotoId, texto, pin);
}

/** Álbum: «Aprobar el álbum» o «Pedir cambios» sobre la ronda abierta. El correo al estudio sale después de responder. */
export async function decidirAlbumAction(slug: unknown, token: unknown, decision: unknown, mensaje: unknown): Promise<Salida<{ decision: "APROBADO" | "CAMBIOS"; fecha: string }>> {
  const e = await entrar("decidir-album", 10, slug);
  if (!e.ok) return e;
  const r = await decidirAlbum(e.workspaceId, token, decision, mensaje);
  if (!r.ok) return r;
  after(() => avisarDecisionAlbum(r.aviso));
  return { ok: true, decision: r.decision, fecha: r.fecha };
}

/** «Pagar fotos extra»: abre Checkout Pro con el carrito que calcula el servidor y devuelve la dirección de pago. */
export async function pagarFotosExtraAction(slug: unknown, token: unknown): Promise<Salida<{ url: string }>> {
  const e = await entrar("pagar", 15, slug);
  if (!e.ok) return e;
  const r = await iniciarPagoGaleria(e.workspaceId, token);
  if (!r.ok) return r;
  return { ok: true, url: r.checkoutUrl };
}

export async function vistasAction(slug: unknown, token: unknown, ids: unknown): Promise<Salida<{ urls: Record<string, string> }>> {
  const e = await entrar("vistas", 300, slug);
  if (!e.ok) return e;
  return urlsDeVista(e.workspaceId, token, ids);
}

export async function descargarAction(slug: unknown, token: unknown, fotoId: unknown): Promise<Salida<{ url: string }>> {
  const e = await entrar("descargar", 60, slug);
  if (!e.ok) return e;
  return urlDeDescarga(e.workspaceId, token, fotoId);
}

/** Original de una foto pagada o incluida: enlace firmado de 5 minutos. Tope alto porque «Descargar todas» llama una vez por foto. */
export async function descargarOriginalAction(slug: unknown, token: unknown, fotoId: unknown): Promise<Salida<{ url: string }>> {
  const e = await entrar("descargar-original", 400, slug);
  if (!e.ok) return e;
  return descargarOriginal(e.workspaceId, token, fotoId);
}

/** Entrega: enlace firmado (1 hora, inline) del original de un video para el reproductor del visor; se pide al abrirlo. */
export async function reproducirVideoAction(slug: unknown, token: unknown, fotoId: unknown): Promise<Salida<{ url: string }>> {
  const e = await entrar("reproducir", 120, slug);
  if (!e.ok) return e;
  return urlDeReproduccion(e.workspaceId, token, fotoId);
}

/**
 * Entrega: «Recibir todo por correo». Crea el pedido de descarga completa (se arma en segundo plano y llega un correo
 * con el enlace a /descargas). Freno propio, más corto: armar un ZIP es caro.
 */
export async function pedirDescargaAction(slug: unknown, token: unknown): Promise<Salida<{ yaEnCurso: boolean }>> {
  const e = await entrar("pedir-descarga", 10, slug);
  if (!e.ok) return e;
  const r = await pedirDescargaDeCliente(e.workspaceId, token);
  if (!r.ok) return { ok: false, error: r.error, codigo: r.codigo === "TOPE" ? "TOPE" : "REGLA" };
  return { ok: true, yaEnCurso: r.yaEnCurso };
}

/** Página /descargas: firma (5 minutos, attachment) una parte de la descarga completa, o el archivo suelto que no entra en un ZIP. */
export async function descargarParteAction(slug: unknown, token: unknown, descargaId: unknown, tipo: unknown, n: unknown): Promise<Salida<{ url: string }>> {
  const e = await entrar("descargar-parte", 120, slug);
  if (!e.ok) return e;
  const r = await urlDeParteDeCliente(e.workspaceId, token, descargaId, tipo, n);
  return r.ok ? { ok: true, url: r.url } : { ok: false, error: r.error, codigo: "REGLA" };
}
