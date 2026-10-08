import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PedidoPublico } from "@/components/pedidos/pedido-publico";
import { pasaElFrenoDeEnlaces } from "@/lib/pedidos/freno-publico";
import { abrirPedidoPublico } from "@/lib/pedidos/publico";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  // Es del cliente: no se indexa, y la dirección (que lleva el token) no se manda a ningún sitio
  // que se abra desde acá. Los encabezados HTTP los pone `next.config.ts`.
  return { title: "Tu pedido", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * El enlace del pedido para el cliente (etapa 3, spec §2 A.6 y §3.3), sin sesión: el token es la
 * llave. Ítems, totales, plan de pagos con su estado, saldo y recibos. Token sin forma,
 * desconocido, renovado, de otro workspace o de un recibo: "Enlace no disponible" (404).
 */
export default async function PedidoPublicoPage({ params }: Props) {
  const { workspaceSlug, token } = await params;
  if (!(await pasaElFrenoDeEnlaces())) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <p>Hubo demasiadas visitas desde tu conexión. Esperá unos minutos y volvé a abrir el enlace.</p>
      </main>
    );
  }
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();
  const vista = await abrirPedidoPublico(workspaceId, token);
  if (!vista) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <PedidoPublico vista={vista} />
    </main>
  );
}
