import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { workAccess, workPath } from "@repo/muestras";
import { Compra } from "@/components/ventas/compra";
import { buscarPorSlug } from "@/lib/actividades/consultas";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { MUCHA_GENTE_EN_LA_RED } from "@/lib/sala/freno";
import { esUrlWeb } from "@/lib/url";
import { paginaDeCompra } from "@/lib/ventas/compra";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Adquirir obra", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ slug: string; workId: string }> };

/**
 * "Adquirir obra" desde la página pública de la obra (etapa 8). Sólo existe si la obra se ve online
 * completa (`workAccess`): una obra reservada para la sala se compra con el pase. Dinámica y sin
 * indexar; los precios salen sólo si quien mira puede comprar.
 */
export default async function AdquirirObraPublica({ params }: Props) {
  const { slug, workId } = await params;
  const ip = ipDeLaPeticion(await headers());
  if (!frenarPorIp("vistaSalaRed", ip).allowed) {
    return <main className="mf-marco max-w-2xl py-8 sm:py-12"><p className="text-lg">{MUCHA_GENTE_EN_LA_RED}</p></main>;
  }
  const a = await buscarPorSlug(slug);
  if (!a || a.type !== "MUESTRA") notFound();
  const obra = a.works.find((w) => w.id === workId);
  if (!obra || workAccess(a, a.works, workId, new Date()) !== "FULL") notFound();
  const d = await paginaDeCompra(a.id, obra.id);
  if (d.estado === "NOT_FOR_SALE") notFound();
  return (
    <Compra
      d={d}
      obra={{ title: obra.title, authorName: obra.authorName.trim() || "Autor sin indicar", imagen: esUrlWeb(obra.imageUrl) ? obra.imageUrl : null }}
      volver={workPath(a.slug, obra.id)}
    />
  );
}
