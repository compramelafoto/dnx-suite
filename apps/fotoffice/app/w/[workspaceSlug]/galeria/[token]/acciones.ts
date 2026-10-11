"use server";

import { after } from "next/server";
import { avisarSeleccionEnviada } from "@/lib/galerias/avisos";
import { iniciarPagoGaleria } from "@/lib/galerias/pago";
import { comentarFoto, descargarOriginal, elegirFoto, enviarSeleccion, urlDeDescarga, urlsDeVista, type Falla } from "@/lib/galerias/publico";
import { MENSAJES_PUBLICO } from "@/lib/galerias/publico-tipos";
import type { ComentarioPublico } from "@/lib/galerias/publico-tipos";
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
