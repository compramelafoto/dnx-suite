import Link from "next/link";

/**
 * Confirmación del canje cuando el combo pagado por fuera cubrió todo el pedido: no hubo
 * Mercado Pago, así que no pasa por /pago/success (que espera un pago para confirmar).
 */
export default async function CanjeListoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { id } = await params;
  const { pedido } = await searchParams;
  const pedidoId = pedido && /^\d+$/.test(pedido) ? pedido : null;

  return (
    <section className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
        <h1 className="m-0 text-2xl font-semibold">¡Listo! Tu combo quedó canjeado</h1>
        {pedidoId ? <p className="m-0 mt-2 text-sm">Pedido #{pedidoId}</p> : null}
        <ul className="m-0 mt-4 list-disc space-y-1 pl-5 text-base">
          <li>Las fotos digitales te llegan por correo, con un enlace para descargarlas.</li>
          <li>Las fotos impresas te las entrega el fotógrafo.</li>
          <li>No tuviste que pagar nada: tu combo ya estaba pago.</li>
        </ul>
      </div>
      <p className="mt-6 text-center">
        <Link href={`/a/${id}`} className="font-medium text-[#c27b3d] underline">
          Volver a la galería
        </Link>
      </p>
    </section>
  );
}
