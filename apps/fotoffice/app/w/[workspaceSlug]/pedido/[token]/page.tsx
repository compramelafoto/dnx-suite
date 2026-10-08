import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PedidoPublico } from "@/components/pedidos/pedido-publico";
import { pasaElFrenoDeEnlaces, pasaElFrenoDePagos } from "@/lib/pedidos/freno-publico";
import { avisoDeVuelta, type ResultadoVuelta } from "@/lib/pedidos/pago-vuelta";
import { abrirPedidoPublico, verificarVueltaDePago } from "@/lib/pedidos/publico";
import { idDeCuotaValido } from "@/lib/pedidos/mp-puro";
import { pagarCuotaAction } from "./actions";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Un parámetro de la dirección, sólo si vino una vez y como texto. */
const unico = (v: string | string[] | undefined): string | null => (typeof v === "string" ? v : null);

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
export default async function PedidoPublicoPage({ params, searchParams }: Props) {
  const { workspaceSlug, token } = await params;
  const q = await searchParams;
  if (!(await pasaElFrenoDeEnlaces())) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <p>Hubo demasiadas visitas desde tu conexión. Esperá unos minutos y volvé a abrir el enlace.</p>
      </main>
    );
  }
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();

  // La vuelta de Mercado Pago no se cree: con `pago=ok` se le pregunta a Mercado Pago (con cupo
  // propio) ANTES de leer el pedido, así la página ya muestra el cobro y el recibo nuevos.
  const pago = unico(q.pago);
  let verificacion: ResultadoVuelta | null = null;
  if (pago === "ok" && (await pasaElFrenoDePagos())) {
    const r = await verificarVueltaDePago(workspaceId, token, { cuotaId: unico(q.cuota), paymentId: unico(q.payment_id) });
    verificacion = r?.resultado ?? null;
  }
  const vista = await abrirPedidoPublico(workspaceId, token);
  if (!vista) notFound();
  const pagar = unico(q.pagar);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <PedidoPublico
        vista={vista}
        pago={{
          accion: pagarCuotaAction,
          slug: workspaceSlug,
          token,
          resaltarCuotaId: idDeCuotaValido(pagar) ? pagar : null,
          aviso: avisoDeVuelta(pago, unico(q.motivo), verificacion),
        }}
      />
    </main>
  );
}
