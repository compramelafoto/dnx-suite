import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loteDelLab } from "@/lib/print-batches/lote-del-lab";
import PuertaDelLote from "./PuertaDelLote";

/**
 * Puerta del laboratorio sin cuenta: se llega por el enlace secreto del correo del lote.
 *
 * La página sólo lee (un Server Component no puede poner cookies). La primera apertura y la cookie
 * `lab_lote_<id>` las deja `GET /api/lab-lote/[token]`, que el componente llama al montarse; así
 * un escáner de enlaces del correo, que no corre JavaScript, no marca «abrió».
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lote de impresión",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const encontrado = await loteDelLab(token);
  if (!encontrado) notFound();
  return <PuertaDelLote token={token} inicial={encontrado.lote} />;
}
