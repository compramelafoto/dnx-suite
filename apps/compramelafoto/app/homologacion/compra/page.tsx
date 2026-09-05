import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { assertClfMpSplit1nHomologationSafe } from "@/lib/homologation/mp-split-1n/assert-safe-environment";
import { listHomologationScenarios } from "@/lib/homologation/mp-split-1n/scenarios";
import { CompraClient } from "./CompraClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Comprar foto digital",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Recorrido de compra para el video de homologación de Split 1:N.
 *
 * Mercado Pago pide un video continuo **desde la perspectiva del comprador**:
 * selección del producto → Card Payment Brick → confirmación → retorno al
 * comercio con el mensaje de resultado final (checklist IXFS-16376).
 * La superficie de `/admin/homologacion-mp-split-1n` tiene el Brick pero se ve
 * administrativa y le faltan los dos extremos del recorrido. Esta ruta los
 * agrega **envolviendo el mismo Brick y la misma server action**: no duplica
 * lógica de pago ni crea un checkout paralelo.
 *
 * Mismos guards que la superficie admin: sandbox, flag explícito y producción
 * bloqueada por `assertClfMpSplit1nHomologationSafe`. No crea ventas de CLF, no
 * habilita descargas y no toca Checkout Pro.
 */
export default function ClfHomologacionCompraPage() {
  const safety = assertClfMpSplit1nHomologationSafe();
  // 404 en vez de redirect: fuera de homologación, esta ruta no existe.
  if (!safety.ok) notFound();

  const publicKey =
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() ||
    process.env.MERCADOPAGO_TEST_PUBLIC_KEY?.trim() ||
    "";

  if (!publicKey) notFound();

  const scenarios = listHomologationScenarios().map((s) => ({
    id: s.id,
    label: s.label,
    partnerCount: s.partnerCount,
    amountMinor: Number(s.totalMinor),
    currency: s.currency,
  }));

  return <CompraClient publicKey={publicKey} scenarios={scenarios} />;
}
