"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crearClientesPiloto, leerOrdenMp } from "../split-1n-piloto/mp";
import { cargarConfigPiloto } from "../split-1n-piloto/receptores-clf";
import { cargarGrupo } from "./cargar";
import { resolverCheckoutSplitGrupo, volverATarjetaGrupo, type DepsCheckoutSplitGrupo } from "./checkout-split-grupo";
import { carritoActivoParaEvento, resolveCarritoConfig } from "./config";
import { finalizarGrupo } from "./finalizar-grupo";
import { esGrupoIdValido, marcarSnapshotGrupo } from "./marca";
import { mensajeGrupo } from "./mensajes-grupo";
import { prepararPagoGrupo } from "./preparar-grupo";

export type PagarGrupoMpResult = { ok: true; initPoint: string } | { ok: false; mensaje: string };

function respuesta(body: unknown): { id: string | null; url: string | null } {
  const b = (body ?? {}) as { id?: unknown; checkout_url?: unknown };
  return {
    id: typeof b.id === "string" && b.id ? b.id : null,
    url: typeof b.checkout_url === "string" && b.checkout_url.startsWith("https://") ? b.checkout_url : null,
  };
}


type Piloto = Awaited<ReturnType<typeof cargarConfigPiloto>>;

/** Base de CLF y Mercado Pago (token de la plataforma) para la lógica del carrito. */
function depsBase(
  grupoId: string,
  piloto: Piloto,
): Pick<DepsCheckoutSplitGrupo, "ahora" | "cargar" | "cambiarMarcas" | "estadoOrden" | "confirmar" | "cancelarOrden"> {
  return {
      ahora: () => new Date(),
      cargar: () => cargarGrupo(grupoId),
      async cambiarMarcas(grupo, cambios) {
        try {
          await prisma.$transaction(async (tx) => {
            for (const p of grupo.pedidos) {
              const res = await tx.order.updateMany({
                where: {
                  id: p.order.id,
                  status: { in: ["PENDING", "FAILED"] },
                  pricingSnapshot: { path: ["split1nGrupo"], equals: p.marca as unknown as Prisma.InputJsonValue },
                },
                data: {
                  pricingSnapshot: marcarSnapshotGrupo(p.order.pricingSnapshot, cambios(p)) as Prisma.InputJsonValue,
                },
              });
              if (res.count !== 1) throw new Error(`marca_cambiada_${p.order.id}`);
            }
          });
          return true;
        } catch (err: unknown) {
          console.info("[carrito-evento] marca_no_cambiada", {
            grupoId,
            error: err instanceof Error ? err.message : String(err),
          });
          return false;
        }
      },
      async estadoOrden(providerOrderId) {
        const { http } = crearClientesPiloto(piloto);
        return (await leerOrdenMp(http, providerOrderId)).status;
      },
      async confirmar(providerOrderId) {
        const r = await finalizarGrupo({ grupoId, providerOrderId });
        return r.ok;
      },
      async cancelarOrden(providerOrderId) {
        const { http } = crearClientesPiloto(piloto);
        await http.request<unknown>({
          method: "POST",
          path: `/v1/orders/${encodeURIComponent(providerOrderId)}/cancel`,
          idempotencyKey: `cancelar-${providerOrderId}`,
        });
      },
  };
}

/**
 * «Pagar con Mercado Pago» en la página de pago de un carrito de evento (`/pagar/grupo/[id]`):
 * una sola orden con reparto para todos los fotógrafos, pagable con dinero en cuenta, tarjetas
 * guardadas, débito o crédito. Detrás de `DNX_CLF_SPLIT_1N_PLAN_B_SPLIT_ENABLED`.
 */
export async function pagarGrupoConMercadoPago(input: { grupoId: string }): Promise<PagarGrupoMpResult> {
  const grupoId = String(input?.grupoId ?? "");
  if (!esGrupoIdValido(grupoId)) return { ok: false, mensaje: mensajeGrupo("NO_DISPONIBLE") };

  const piloto = await cargarConfigPiloto();
  const carrito = resolveCarritoConfig();
  const inicial = await cargarGrupo(grupoId);
  // Con el carrito apagado no se abren cobros nuevos; un grupo que ya tiene orden con reparto
  // igual puede seguir (reusar el enlace o confirmarse).
  const yaEligioMp = inicial?.pedidos.some((p) => p.marca.estado === "CHECKOUT_SPLIT") ?? false;
  if (!inicial || (!carritoActivoParaEvento(carrito, piloto, inicial.eventId) && !yaEligioMp)) {
    return { ok: false, mensaje: mensajeGrupo("NO_DISPONIBLE") };
  }

  try {
    const r = await resolverCheckoutSplitGrupo({
      ...depsBase(grupoId, piloto),
      planBSplit: piloto.enabled && piloto.planBSplit && carritoActivoParaEvento(carrito, piloto, inicial.eventId),
      ownerUserId: piloto.ownerUserId ?? null,
      baseUrl: process.env.APP_URL || "https://www.compramelafoto.com",
      preparar: (grupo) => prepararPagoGrupo({ grupo, piloto, carrito, estadoGrupo: "PENDIENTE" }),
      async crearOrden(clientes, body, idempotencyKey) {
        const res = await clientes.http.request<unknown>({ method: "POST", path: "/v1/orders", body, idempotencyKey });
        return respuesta(res.body);
      },
    });
    return r.tipo === "url" ? { ok: true, initPoint: r.url } : { ok: false, mensaje: r.mensaje };
  } catch (err: unknown) {
    console.error("[carrito-evento] checkout_split_fallido", {
      grupoId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, mensaje: "No pudimos abrir Mercado Pago. Probá de nuevo en unos minutos o pagá con tarjeta." };
  }
}

/**
 * «Pagar con tarjeta en su lugar»: cancela en Mercado Pago la orden con reparto del carrito y,
 * si quedó sin pago, la tarjeta vuelve a estar disponible.
 */
export async function volverATarjetaCarrito(input: { grupoId: string }): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const grupoId = String(input?.grupoId ?? "");
  if (!esGrupoIdValido(grupoId)) return { ok: false, mensaje: mensajeGrupo("NO_DISPONIBLE") };
  try {
    const piloto = await cargarConfigPiloto();
    return await volverATarjetaGrupo(depsBase(grupoId, piloto));
  } catch (err: unknown) {
    console.error("[carrito-evento] volver_a_tarjeta_fallido", {
      grupoId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, mensaje: "No pudimos cambiar el medio de pago. Probá de nuevo en unos minutos." };
  }
}
