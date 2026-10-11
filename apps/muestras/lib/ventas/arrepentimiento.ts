"use server";

import { prisma } from "@repo/db";
import { isSalePublicId } from "@repo/muestras";
import { frenarPorPedido } from "@/lib/limite";
import { ARREPENTIMIENTO_RECIBIDO, ARREPENTIMIENTO_VENCIDO, abrirPedido, puedeArrepentirse } from "./pedido-comprador";

/**
 * "Botón de arrepentimiento" (Ley 24.240, D27): el comprador lo pide desde su pedido hasta 10 días
 * corridos después del pago. Queda registrado (`regretRequestedAt` + evento `BUYER`) para que la
 * organización y la plataforma lo revisen y devuelvan el dinero; acá no se mueve plata.
 */
export type ResultadoArrepentimiento = { ok: true; mensaje: string } | { ok: false; error: string };

const MOTIVO_MAX = 500;

export async function pedirArrepentimiento(_previo: ResultadoArrepentimiento | null, fd: FormData): Promise<ResultadoArrepentimiento> {
  const publicId = fd.get("publicId");
  if (!isSalePublicId(publicId)) return { ok: false, error: "No encontramos tu pedido." };
  const abierto = await abrirPedido(publicId);
  if (!abierto) return { ok: false, error: "No encontramos tu pedido." };
  const { pedido } = abierto;
  if (!frenarPorPedido("verPedido", pedido.publicId).allowed) return { ok: false, error: "Hiciste muchos intentos seguidos. Esperá unos minutos." };
  if (pedido.regretRequestedAt) return { ok: true, mensaje: ARREPENTIMIENTO_RECIBIDO };
  const ahora = new Date();
  if (!puedeArrepentirse(pedido, ahora)) {
    return { ok: false, error: pedido.paidAt ? ARREPENTIMIENTO_VENCIDO : "Este pedido no tiene un pago confirmado." };
  }
  const motivoCrudo = fd.get("motivo");
  const motivo = typeof motivoCrudo === "string" ? motivoCrudo.trim().slice(0, MOTIVO_MAX) : "";
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.culturalSaleOrder.updateMany({ where: { id: pedido.id, regretRequestedAt: null }, data: { regretRequestedAt: ahora } });
    if (count === 0) return;
    await tx.culturalSaleEvent.create({
      data: { orderId: pedido.id, source: "BUYER", detail: `Arrepentimiento pedido por quien compró${motivo ? `: ${motivo}` : ""}`.slice(0, 600) },
    });
  });
  return { ok: true, mensaje: ARREPENTIMIENTO_RECIBIDO };
}
