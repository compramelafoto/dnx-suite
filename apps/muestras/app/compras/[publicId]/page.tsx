import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pedido } from "@/components/ventas/pedido";
import { abrirPedido, conciliarSiHaceFalta, vistaDelPedido } from "@/lib/ventas/pedido-comprador";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu pedido", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ publicId: string }>; searchParams: Promise<{ t?: string | string[] }> };

/**
 * El pedido del comprador (etapa 8, D25). Se abre con la cookie del pedido (el `proxy` manda el
 * `?t=` del enlace a `/entrar`, que lo valida, lo guarda en la cookie y redirige) o, si la cookie no
 * está, con el token del enlace. Sin
 * ninguno de los dos que lo abra, 404.
 */
export default async function PaginaDelPedido({ params, searchParams }: Props) {
  const { publicId } = await params;
  const { t } = await searchParams;
  const abierto = await abrirPedido(publicId, typeof t === "string" ? t : null);
  if (!abierto) notFound();
  const pedido = await conciliarSiHaceFalta(abierto.pedido);
  return <Pedido v={await vistaDelPedido(pedido, abierto.token)} />;
}
