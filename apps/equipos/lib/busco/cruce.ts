import { prisma } from "@repo/db";
import { formatPesos, sellerFirstName } from "@/lib/catalogo/buscar";
import { sendPortalEmail } from "@/lib/correo";
import { CONDITION_LABELS, type GearListingCondition } from "@/lib/publicaciones/catalogos";
import { urlBaseDeLaApp } from "@/lib/sesion";
import { CUENTA_SIN_BLOQUEO, blockedUserIds } from "@/lib/usuarios/bloqueo";
import { NOTICES_PER_WEEK, makeKey, makeVariants, modelKey } from "./modelo";

/**
 * Cruce diario de pedidos «Busco» y aviso al comprador cuando un dueño interesado publica.
 * PRIVACIDAD: el correo al dueño nunca lleva el nombre del comprador (lo ve recién al abrir el
 * aviso), y el comprador no recibe nada hasta que un dueño interesado publica el equipo.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/** Identidad aprobada HOY (el mismo criterio del catálogo), para vendedores y compradores. */
const VENDEDOR_VERIFICADO = { identityVerification: { is: { status: "APPROVED" } } } as const;
/** Lo que el catálogo muestra: verificado y sin la cuenta bloqueada. */
const VENDEDOR_VISIBLE = { ...VENDEDOR_VERIFICADO, ...CUENTA_SIN_BLOQUEO } as const;

type Pedido = {
  id: number;
  buyerId: number;
  kind: string;
  make: string;
  model: string;
  modelKey: string;
  maxPriceArs: number | null;
  minCondition: GearListingCondition | null;
  province: string | null;
};

type Candidato = {
  id: number;
  ownerId: number;
  make: string;
  model: string;
  owner: { email: string; name: string | null };
};

function marcaWhere(make: string) {
  return makeVariants(make).map((v) => ({ make: { startsWith: v, mode: "insensitive" as const } }));
}

/**
 * Vence los pedidos pasados de fecha y, por cada pedido activo: si ya hay una publicación de ese
 * modelo en el catálogo, no molesta a nadie; si no, avisa a los dueños con ese modelo en uso o
 * recuperado (nunca robado, perdido, vendido ni ya en venta), que no sean el comprador, no estén
 * bloqueados ni hayan apagado los avisos, no hayan recibido ya ese pedido y tengan menos de
 * 2 avisos en los últimos 7 días. El aviso se registra antes del correo (el `@@unique` corta una
 * corrida en paralelo); si el correo no sale, se borra para reintentar en la próxima corrida.
 */
export async function runPurchaseRequests(
  now: Date = new Date(),
): Promise<{ notices: number; expired: number }> {
  const expired = (
    await prisma.purchaseRequest.updateMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    })
  ).count;

  const bloqueados = await blockedUserIds();

  const pedidos = (await prisma.purchaseRequest.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { gt: now },
      // El correo al dueño dice «comprador con identidad verificada»: tiene que serlo HOY.
      buyer: VENDEDOR_VERIFICADO,
      buyerId: { notIn: bloqueados },
    },
    // Los más viejos primero: con el tope semanal, nadie queda siempre al final de la fila.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      buyerId: true,
      kind: true,
      make: true,
      model: true,
      modelKey: true,
      maxPriceArs: true,
      minCondition: true,
      province: true,
    },
  })) as Pedido[];
  if (pedidos.length === 0) return { notices: 0, expired };

  const apagados = new Set(
    (
      await prisma.gearOwnerSettings.findMany({
        where: { purchaseRequestOptOut: true },
        select: { userId: true },
      })
    ).map((s) => s.userId),
  );
  const yaAvisados = new Set(
    (
      await prisma.purchaseRequestNotice.findMany({
        where: { requestId: { in: pedidos.map((p) => p.id) } },
        select: { requestId: true, ownerId: true },
      })
    ).map((n) => `${n.requestId}:${n.ownerId}`),
  );
  const enLaSemana = new Map<number, number>(
    (
      await prisma.purchaseRequestNotice.groupBy({
        by: ["ownerId"],
        where: { sentAt: { gt: new Date(now.getTime() - 7 * DIA_MS) } },
        _count: { _all: true },
      })
    ).map((g) => [g.ownerId, g._count._all]),
  );

  // Una consulta de publicaciones y una de inventario por tipo y marca, no por pedido.
  const grupos = new Map<string, Pedido[]>();
  for (const p of pedidos) {
    const k = `${p.kind}|${makeKey(p.make)}`;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }

  const base = urlBaseDeLaApp();
  let notices = 0;

  for (const grupo of grupos.values()) {
    const { kind, make } = grupo[0];
    const publicadas = await prisma.gearListing.findMany({
      where: {
        status: "PUBLISHED",
        kind: kind as never,
        seller: VENDEDOR_VERIFICADO,
        sellerId: { notIn: bloqueados },
        OR: marcaWhere(make),
      },
      select: { sellerId: true, make: true, model: true },
    });
    const equipos = (await prisma.gearItem.findMany({
      where: {
        kind: kind as never,
        status: { in: ["IN_USE", "RECOVERED"] },
        ownerId: { notIn: bloqueados },
        OR: marcaWhere(make),
      },
      select: {
        id: true,
        ownerId: true,
        make: true,
        model: true,
        owner: { select: { email: true, name: true } },
      },
      orderBy: { id: "asc" },
    })) as Candidato[];
    const claveDe = new Map(equipos.map((e) => [e.id, modelKey(e.make, e.model)]));

    for (const pedido of grupo) {
      try {
        const yaPublicado = publicadas.some(
          (l) => l.sellerId !== pedido.buyerId && modelKey(l.make, l.model) === pedido.modelKey,
        );
        if (yaPublicado) continue;

        const vistos = new Set<number>();
        for (const e of equipos) {
          if (claveDe.get(e.id) !== pedido.modelKey) continue;
          if (e.ownerId === pedido.buyerId || apagados.has(e.ownerId) || vistos.has(e.ownerId)) continue;
          vistos.add(e.ownerId);
          const par = `${pedido.id}:${e.ownerId}`;
          if (yaAvisados.has(par)) continue;
          if ((enLaSemana.get(e.ownerId) ?? 0) >= NOTICES_PER_WEEK) continue;

          let noticeId: number;
          try {
            noticeId = (
              await prisma.purchaseRequestNotice.create({
                data: { requestId: pedido.id, ownerId: e.ownerId, gearItemId: e.id },
                select: { id: true },
              })
            ).id;
          } catch (err) {
            if ((err as { code?: string })?.code !== "P2002") throw err;
            yaAvisados.add(par);
            continue;
          }
          yaAvisados.add(par);
          enLaSemana.set(e.ownerId, (enLaSemana.get(e.ownerId) ?? 0) + 1);

          const data: Record<string, string> = {
            nombre: e.owner.name ? sellerFirstName(e.owner.name) : "",
            // El equipo como lo cargó el dueño: nunca texto escrito por el comprador.
            equipo: `${e.make} ${e.model}`,
            url: `${base}/busco/avisos/${noticeId}`,
          };
          if (pedido.maxPriceArs != null) data.precio = formatPesos(pedido.maxPriceArs);
          if (pedido.province) data.zona = pedido.province;
          if (pedido.minCondition) data.estado = CONDITION_LABELS[pedido.minCondition];

          const r = await sendPortalEmail(e.owner.email, "pedido_dueno", data);
          if (r.success) {
            notices += 1;
          } else {
            await prisma.purchaseRequestNotice.delete({ where: { id: noticeId } });
            yaAvisados.delete(par);
            enLaSemana.set(e.ownerId, (enLaSemana.get(e.ownerId) ?? 1) - 1);
          }
        }
      } catch (err) {
        console.error("[busco] Falló el cruce del pedido", pedido.id, err);
      }
    }
  }
  return { notices, expired };
}

/**
 * Cuando una publicación queda `PUBLISHED`: si el equipo tiene avisos «Me interesa vender» de
 * pedidos activos, guarda la publicación en el aviso, da el pedido por cumplido y le manda al
 * comprador el enlace a la ficha. Nunca tira error (no frena publicar, reanudar ni aprobar).
 */
export async function notifyRequestBuyers(listingId: number): Promise<void> {
  try {
    const listing = await prisma.gearListing.findFirst({
      // El enlace que recibe el comprador tiene que abrir: misma visibilidad que el catálogo.
      where: { id: listingId, status: "PUBLISHED", seller: VENDEDOR_VISIBLE },
      select: { id: true, gearItemId: true, sellerId: true, make: true, model: true, priceArs: true },
    });
    if (!listing) return;
    const now = new Date();
    const avisos = await prisma.purchaseRequestNotice.findMany({
      where: {
        gearItemId: listing.gearItemId,
        // Si el equipo cambió de dueño, el aviso del dueño anterior no cuenta.
        ownerId: listing.sellerId,
        response: "INTERESTED",
        listingId: null,
        request: { status: "ACTIVE", expiresAt: { gt: now } },
      },
      select: {
        id: true,
        requestId: true,
        request: { select: { buyerId: true, buyer: { select: { email: true, name: true } } } },
      },
    });

    if (avisos.length === 0) return;
    // Un comprador bloqueado no recibe el aviso y su pedido no se da por cumplido.
    const bloqueados = new Set(await blockedUserIds());
    const base = urlBaseDeLaApp();
    for (const aviso of avisos) {
      if (aviso.request.buyerId === listing.sellerId) continue;
      if (bloqueados.has(aviso.request.buyerId)) continue;
      const cumplido = await prisma.$transaction(async (tx) => {
        const r = await tx.purchaseRequest.updateMany({
          where: { id: aviso.requestId, status: "ACTIVE" },
          data: { status: "FULFILLED" },
        });
        if (r.count === 0) return false;
        await tx.purchaseRequestNotice.update({
          where: { id: aviso.id },
          data: { listingId: listing.id },
        });
        return true;
      });
      if (!cumplido) continue;
      const nombre = aviso.request.buyer.name ? sellerFirstName(aviso.request.buyer.name) : "";
      await sendPortalEmail(aviso.request.buyer.email, "pedido_publicado", {
        nombre,
        equipo: `${listing.make} ${listing.model}`,
        precio: formatPesos(listing.priceArs),
        url: `${base}/equipos/${listing.id}`,
      });
    }
  } catch (err) {
    console.error("[busco] No se pudo avisar a los compradores de la publicación", listingId, err);
  }
}
