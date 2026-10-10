import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SALES_ENABLED, SALE_ASK_TEXT, SALE_UNAVAILABLE_TEXT, saleState, workPath } from "@repo/muestras";
import { AvisoDeSala } from "@/components/sala/aviso-de-sala";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { MUCHAS_CONSULTAS, MUCHA_GENTE_EN_LA_RED, frenarEnSala } from "@/lib/sala/freno";
import { obraParaAdquirir, paseDeSala } from "@/lib/sala/consultas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Adquirir obra", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ slug: string; workId: string }> };

/**
 * La página de venta de una obra (spec D33), con el pase de sala. Hoy la venta no existe: lo dice y
 * ofrece consultar en la sala. **Sin precio.** La etapa de Ventas suma acá el estado `AVAILABLE`
 * de `saleState`, con el precio y la compra por DNX Payments (Split 1:N).
 */
export default async function AdquirirObra({ params }: Props) {
  const { slug, workId } = await params;
  const publica = workPath(slug, workId);
  const ip = ipDeLaPeticion(await headers());
  if (!frenarPorIp("vistaSalaRed", ip).allowed) return <AvisoDeSala texto={MUCHA_GENTE_EN_LA_RED} volver={`/m/${encodeURIComponent(slug)}`} />;
  const p = await paseDeSala(slug);
  if (p && !frenarEnSala("vistaSala", p, ip)) return <AvisoDeSala texto={MUCHAS_CONSULTAS} volver={`/m/${encodeURIComponent(slug)}`} />;
  const o = p ? await obraParaAdquirir(p, workId) : null;
  if (!o) redirect(publica);
  if (!o.roomBuy || saleState({ salesEnabled: SALES_ENABLED, forSale: o.forSale }) === "NOT_FOR_SALE") notFound();
  return (
    <main className="mf-marco max-w-2xl space-y-6 py-8 sm:py-12">
      <p className="text-sm text-[var(--mf-muted)]">Adquirir obra</p>
      <h1 className="mf-titulo text-[clamp(2rem,5vw,3rem)]">{o.title}</h1>
      <p className="text-lg">{o.authorName}</p>
      <p className="border-t border-[var(--mf-line)] pt-6 text-lg">{SALE_UNAVAILABLE_TEXT}</p>
      <p className="text-[15px]">{SALE_ASK_TEXT}</p>
      <p><Link href={`/m/${encodeURIComponent(slug)}/sala/o/${encodeURIComponent(workId)}`} className="underline underline-offset-[6px]">Volver a la obra</Link></p>
    </main>
  );
}
