"use server";

import { redirect } from "next/navigation";
import { codigoDeError } from "@/lib/avisos";
import {
  cancelRequest,
  createPurchaseRequest,
  renewRequest,
  respondNotice,
  setPurchaseRequestOptOut,
  type PurchaseRequestInput,
} from "@/lib/busco/pedidos";
import { requireLevel } from "@/lib/guards";
import type { GearItemKind } from "@/lib/inventario/tipos";
import type { GearListingCondition } from "@/lib/publicaciones/catalogos";
import { parseEnteroPesos } from "@/lib/publicaciones/numeros";

/**
 * Acciones de «Busco». Vuelven con `?ok=CODIGO` / `?error=CODIGO` (nunca texto libre en la URL).
 * Cada una vuelve a pedir el nivel de verificación: no confía en la página que la llamó.
 */

function text(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}

function idDe(fd: FormData, k: string): number {
  return Number(text(fd, k) || Number.NaN);
}

export async function crearPedido(formData: FormData) {
  const user = await requireLevel("identidad", "/busco/nuevo");
  const precio = parseEnteroPesos(formData.get("maxPriceArs"));
  const input: PurchaseRequestInput = {
    kind: text(formData, "kind") as GearItemKind,
    make: text(formData, "make"),
    model: text(formData, "model"),
    maxPriceArs: precio === null ? undefined : precio,
    minCondition: (text(formData, "minCondition") || undefined) as GearListingCondition | undefined,
    province: text(formData, "province") || undefined,
  };

  let destino: string;
  try {
    const { requestId, matches } = await createPurchaseRequest(user.id, input);
    // Las coincidencias ya son públicas: la página las vuelve a buscar con el id del pedido.
    destino = matches.length > 0 ? `/busco/nuevo?creado=${requestId}` : "/busco?ok=PEDIDO_CREADO";
  } catch (err) {
    destino = `/busco/nuevo?error=${codigoDeError(err, { origen: "busco" })}`;
  }
  redirect(destino);
}

export async function renovarPedido(formData: FormData) {
  const user = await requireLevel("registrado", "/busco");
  let query: string;
  try {
    await renewRequest(user.id, idDe(formData, "requestId"));
    query = "ok=PEDIDO_RENOVADO";
  } catch (err) {
    query = `error=${codigoDeError(err, { noEncontrado: "NO_ENCONTRADO_PEDIDO", origen: "busco" })}`;
  }
  redirect(`/busco?${query}`);
}

export async function cancelarPedido(formData: FormData) {
  const user = await requireLevel("registrado", "/busco");
  let query: string;
  try {
    await cancelRequest(user.id, idDe(formData, "requestId"));
    query = "ok=PEDIDO_CANCELADO";
  } catch (err) {
    query = `error=${codigoDeError(err, { noEncontrado: "NO_ENCONTRADO_PEDIDO", origen: "busco" })}`;
  }
  redirect(`/busco?${query}`);
}

/**
 * «Me interesa vender» lleva a publicar ese equipo (si ya estaba publicado, el comprador recibe el
 * enlace y se vuelve al aviso); «No, gracias» vuelve al aviso.
 */
export async function responderAviso(formData: FormData) {
  const noticeId = idDe(formData, "noticeId");
  const volver = Number.isInteger(noticeId) && noticeId > 0 ? `/busco/avisos/${noticeId}` : "/busco";
  const user = await requireLevel("registrado", volver);
  const respuesta = text(formData, "response");

  let destino: string;
  try {
    const { gearItemId, yaPublicado } = await respondNotice(
      user.id,
      noticeId,
      respuesta as "INTERESTED" | "DECLINED",
    );
    destino =
      respuesta !== "INTERESTED"
        ? `${volver}?ok=AVISO_RECHAZADO`
        : yaPublicado
          ? `${volver}?ok=AVISO_YA_PUBLICADO`
          : `/mi-equipo/${gearItemId}/publicar?pedido=${noticeId}`;
  } catch (err) {
    destino = `${volver}?error=${codigoDeError(err, { noEncontrado: "NO_ENCONTRADO_AVISO", origen: "busco" })}`;
  }
  redirect(destino);
}

/** Casilla de «Mi cuenta»: marcada = recibir avisos (no apagados). */
export async function guardarAvisosBusco(formData: FormData) {
  const user = await requireLevel("registrado", "/cuenta");
  let query: string;
  try {
    await setPurchaseRequestOptOut(user.id, formData.get("avisarme") !== "on");
    query = "ok=PREFERENCIAS_GUARDADAS";
  } catch (err) {
    query = `error=${codigoDeError(err, { origen: "cuenta" })}`;
  }
  redirect(`/cuenta?${query}#avisos-busco`);
}
