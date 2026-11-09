import { prisma } from "@/lib/prisma";
import { cargarPedidoPiloto, type PedidoPiloto } from "../split-1n-piloto/pedido";
import { esGrupoIdValido, leerMarcaGrupo, type MarcaGrupo } from "./marca";

export type PedidoDelGrupoCargado = PedidoPiloto & { marca: MarcaGrupo };

export type GrupoCargado = {
  grupoId: string;
  eventId: number | null;
  pedidos: PedidoDelGrupoCargado[];
  /** Autor de cada foto de cada pedido (`Photo.userId`), para no cobrar fotos de otro. */
  autoresPorPedido: Map<number, Array<number | null>>;
};

/** Estado del cobro del grupo: el más avanzado entre sus pedidos. */
export function estadoDelGrupo(pedidos: Array<{ marca: MarcaGrupo }>): MarcaGrupo["estado"] {
  const orden: MarcaGrupo["estado"][] = ["PENDIENTE", "COBRANDO", "EN_REVISION", "ACREDITADA", "PAGADO"];
  return pedidos.reduce<MarcaGrupo["estado"]>(
    (max, p) => (orden.indexOf(p.marca.estado) > orden.indexOf(max) ? p.marca.estado : max),
    "PENDIENTE",
  );
}

/**
 * Los pedidos de un carrito de evento, cada uno con los montos que usa el piloto. Devuelve null
 * si el grupo no existe o no es coherente (pedidos que no coinciden con la lista de la marca,
 * álbumes de eventos distintos): ante la duda, no se cobra ni se confirma nada.
 */
export async function cargarGrupo(grupoId: string): Promise<GrupoCargado | null> {
  if (!esGrupoIdValido(grupoId)) return null;
  const filas = await prisma.order.findMany({
    where: { pricingSnapshot: { path: ["split1nGrupo", "grupoId"], equals: grupoId } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (filas.length === 0) return null;

  const pedidos: PedidoDelGrupoCargado[] = [];
  for (const { id } of filas) {
    const cargado = await cargarPedidoPiloto(id);
    const marca = cargado ? leerMarcaGrupo(cargado.order.pricingSnapshot) : null;
    if (!cargado || !marca || marca.grupoId !== grupoId) return null;
    pedidos.push({ ...cargado, marca });
  }

  const ids = pedidos.map((p) => p.order.id).sort((a, b) => a - b).join(",");
  const coherente = pedidos.every((p) => [...p.marca.pedidos].sort((a, b) => a - b).join(",") === ids);
  const eventos = new Set(pedidos.map((p) => p.order.album?.eventId ?? null));
  if (!coherente || eventos.size !== 1) {
    console.error("[carrito-evento] grupo_incoherente", { grupoId, ids, eventos: [...eventos] });
    return null;
  }

  const items = await prisma.orderItem.findMany({
    where: { orderId: { in: pedidos.map((p) => p.order.id) } },
    select: { orderId: true, photo: { select: { userId: true } } },
  });
  const autoresPorPedido = new Map<number, Array<number | null>>();
  for (const it of items) {
    const lista = autoresPorPedido.get(it.orderId) ?? [];
    lista.push(it.photo?.userId ?? null);
    autoresPorPedido.set(it.orderId, lista);
  }
  return { grupoId, eventId: [...eventos][0], pedidos, autoresPorPedido };
}
