import { hashIp } from "@/lib/hidden-album-audit";
import { compradorHabilitado, leerPilotoCompradores, readBuyerBotConfig } from "./config";
import {
  cookieInvitado,
  emailVerificadoDe,
  ipDe,
  leerGuestKey,
  nuevaGuestKey,
  type CompradorActor,
} from "./identidad";
import { contextoDePagina, pagePathSeguro, type PaginaComprador } from "./pagina";
import { resolverPagina, type DatosPagina } from "./pagina-datos";
import type { ConversacionComprador } from "./store";

/**
 * Lo que comparten las rutas `/api/bot/comprador/*` para armar el pedido HTTP:
 * si el bot va en esa página, quién es el invitado (cookie + IP con hash) y el actor de las herramientas.
 */

export type HabilitacionComprador =
  | { habilitado: false }
  | { habilitado: true; pagina: PaginaComprador; datos: DatosPagina; pagePath: string };

const NO: HabilitacionComprador = { habilitado: false };

/** Interruptores + página reconocida + piloto. Sin interruptores no toca la base. */
export async function habilitacionComprador(pagePathCrudo: unknown): Promise<HabilitacionComprador> {
  if (!readBuyerBotConfig().enabled) return NO;
  if (typeof pagePathCrudo !== "string") return NO;
  const pagina = contextoDePagina(pagePathCrudo);
  if (!pagina) return NO;
  const datos = await resolverPagina(pagina);
  // El link del caso viene de un mail de soporte: no depende del piloto por álbum.
  if (pagina.tipo !== "caso" && !compradorHabilitado(await leerPilotoCompradores(), datos.albumId)) return NO;
  // Nunca la ruta cruda: la de descarga y la de pack llevan el token.
  return { habilitado: true, pagina, datos, pagePath: pagePathSeguro(pagina) };
}

/** Para rutas sin página (acciones, caso): el piloto se mira con el álbum guardado en la conversación. */
export async function conversacionHabilitada(albumId: number | null): Promise<boolean> {
  return compradorHabilitado(await leerPilotoCompradores(), albumId);
}

export type InvitadoHttp = { guestKey: string; nueva: boolean; ipHash: string };

/** Cookie válida o una nueva; ipHash = hashIp(ipDe(req)). La cookie se lee del header (no de `cookies()`). */
export function invitadoDe(req: Request): InvitadoHttp {
  const actual = leerGuestKey(req.headers.get("cookie"));
  return {
    guestKey: actual ?? nuevaGuestKey(),
    nueva: actual === null,
    ipHash: hashIp(ipDe(req)),
  };
}

/** `{ "set-cookie": … }` sólo si la cookie es nueva: va en los headers del Response, antes del stream. */
export function headersInvitado(i: InvitadoHttp): Record<string, string> {
  return i.nueva ? { "set-cookie": cookieInvitado(i.guestKey) } : {};
}

export async function actorDesdeConversacion(p: {
  conv: ConversacionComprador;
  guestKey: string;
  ipHash: string;
  pagina: PaginaComprador | null;
  pagePath: string | null;
  datos: DatosPagina;
  sesion: { email: string; userId: number } | null;
}): Promise<CompradorActor> {
  return {
    guestKey: p.guestKey,
    ipHash: p.ipHash,
    conversationId: p.conv.id,
    pagina: p.pagina,
    pagePath: p.pagePath,
    albumId: p.datos.albumId,
    // Sólo de un token válido (resolverPagina): el orderId de la página de pago no prueba nada.
    enlace: p.datos.enlace,
    emailVerificado: emailVerificadoDe(p.conv, p.sesion),
    userId: p.sesion?.userId ?? null,
  };
}
