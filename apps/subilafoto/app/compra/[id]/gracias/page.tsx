import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { formatearPesos } from "@/lib/precios";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Después de pagar.
 *
 * Puede llegarse acá **antes** de que Mercado Pago nos avise: la vuelta del navegador y el
 * aviso al servidor son dos caminos distintos y el segundo puede tardar. Por eso la
 * pantalla no afirma que el pago está confirmado si la orden todavía figura pendiente —
 * decirlo y que después falle es peor que pedir un minuto.
 */
export default async function Gracias({ params }: Props) {
  const { id } = await params;

  const orden = await prisma.subilafotoOrder.findUnique({
    where: { id },
    select: {
      status: true,
      amountCents: true,
      buyerEmail: true,
      sellerProfile: { select: { displayName: true, slug: true } },
    },
  });
  if (!orden) notFound();

  const pagada = orden.status === "PAID";

  return (
    <main className="sobre-claro mx-auto flex min-h-[100svh] max-w-xl flex-col justify-center px-6 py-16">
      <h1 className="text-[clamp(1.7rem,5vw,2.5rem)] font-extrabold leading-[1.15] tracking-[-0.02em]">
        {pagada ? "¡Listo! Tu evento está contratado" : "Estamos confirmando tu pago"}
      </h1>

      <p className="mt-5 text-lg leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
        {pagada ? (
          <>
            Te mandamos a <strong>{orden.buyerEmail}</strong> el acceso para configurar el
            evento: la fecha, la plantilla y el código QR para las mesas.
          </>
        ) : (
          <>
            Mercado Pago nos avisa en unos segundos. Podés cerrar esta pantalla: cuando se
            confirme te escribimos a <strong>{orden.buyerEmail}</strong>.
          </>
        )}
      </p>

      <dl
        className="mt-10 space-y-3 border-t pt-8 text-[0.95rem]"
        style={{ borderColor: "var(--slf-borde)", color: "var(--slf-tinta-suave)" }}
      >
        <div className="flex justify-between gap-4">
          <dt>Vendedor</dt>
          <dd className="font-extrabold">{orden.sellerProfile.displayName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Total</dt>
          <dd className="font-extrabold">{formatearPesos(orden.amountCents)}</dd>
        </div>
      </dl>

      <p className="mt-10 text-sm">
        <Link
          href={`/v/${orden.sellerProfile.slug}`}
          className="underline underline-offset-4"
          style={{ color: "var(--slf-violeta)" }}
        >
          Volver a {orden.sellerProfile.displayName}
        </Link>
      </p>
    </main>
  );
}
