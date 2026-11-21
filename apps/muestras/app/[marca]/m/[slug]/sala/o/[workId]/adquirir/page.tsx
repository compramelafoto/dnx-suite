import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { workPath } from "@repo/muestras";
import { AvisoDeSala } from "@/components/sala/aviso-de-sala";
import { Compra } from "@/components/ventas/compra";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { MUCHAS_CONSULTAS, MUCHA_GENTE_EN_LA_RED, frenarEnSala } from "@/lib/sala/freno";
import { obraParaAdquirir, paseDeSala } from "@/lib/sala/consultas";
import { paginaDeCompra } from "@/lib/ventas/compra";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Adquirir obra", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ slug: string; workId: string }> };

/**
 * La página de venta de una obra (spec D33, etapa 8), con el pase de sala. Con la venta apagada (o
 * para quien no puede comprar en modo prueba) dice que todavía no está disponible, **sin precio**;
 * encendida, muestra los formatos, reserva el número y cobra.
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
  if (!o.roomBuy || !o.forSale) notFound();
  const d = await paginaDeCompra(o.activityId, o.id);
  if (d.estado === "NOT_FOR_SALE") notFound();
  return (
    <Compra
      d={d}
      obra={{ title: o.title, authorName: o.authorName, imagen: o.imagen }}
      volver={`/m/${encodeURIComponent(slug)}/sala/o/${encodeURIComponent(workId)}`}
    />
  );
}
