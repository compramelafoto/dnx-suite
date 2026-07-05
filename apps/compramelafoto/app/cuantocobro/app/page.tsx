import CuantoCobroAppHomeClient from "@/components/cuantocobro/CuantoCobroAppHomeClient";
import { CC_COTIZAR_PATH } from "@/lib/cuantocobro/constants";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ consultaId?: string; quoteId?: string }>;
};

/** Centro de trabajo — redirige al wizard si llegan parámetros legacy de consulta/presupuesto. */
export default async function CuantoCobroAppHomePage({ searchParams }: PageProps) {
  const params = await searchParams;

  if (params.consultaId || params.quoteId) {
    const qs = new URLSearchParams();
    if (params.consultaId) qs.set("consultaId", params.consultaId);
    if (params.quoteId) qs.set("quoteId", params.quoteId);
    redirect(`${CC_COTIZAR_PATH}?${qs.toString()}`);
  }

  return <CuantoCobroAppHomeClient />;
}
