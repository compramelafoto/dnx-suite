import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioArrepentimiento } from "@/components/ventas/arrepentimiento";
import { ARREPENTIMIENTO_RECIBIDO, ARREPENTIMIENTO_VENCIDO, abrirPedido, puedeArrepentirse } from "@/lib/ventas/pedido-comprador";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Botón de arrepentimiento", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ publicId: string }> };

/** "Botón de arrepentimiento" (Ley 24.240): hasta 10 días corridos desde el pago. */
export default async function Arrepentimiento({ params }: Props) {
  const { publicId } = await params;
  const abierto = await abrirPedido(publicId);
  if (!abierto) notFound();
  const { pedido } = abierto;
  return (
    <main className="mf-marco max-w-2xl space-y-6 py-8 sm:py-12">
      <p className="text-sm text-[var(--mf-muted)]">Tu pedido</p>
      <h1 className="mf-titulo text-[clamp(1.8rem,4.5vw,2.6rem)]">Botón de arrepentimiento</h1>
      {pedido.regretRequestedAt ? (
        <p className="text-lg">{ARREPENTIMIENTO_RECIBIDO}</p>
      ) : puedeArrepentirse(pedido) ? (
        <FormularioArrepentimiento publicId={pedido.publicId} />
      ) : (
        <p className="text-lg">{pedido.paidAt ? ARREPENTIMIENTO_VENCIDO : "Este pedido no tiene un pago confirmado."}</p>
      )}
      <p><Link href={`/compras/${pedido.publicId}`} className="underline underline-offset-[6px]">Volver a tu pedido</Link></p>
    </main>
  );
}
