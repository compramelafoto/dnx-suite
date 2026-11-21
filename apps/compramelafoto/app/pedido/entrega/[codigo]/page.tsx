import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { actorParaElSobre, cargarSobre, esErrorDeSecreto } from "@/lib/print-batches/sobre-del-pedido";
import { CODIGO_INVALIDO, accionesPermitidas, codigoDeLaRuta } from "@/lib/print-batches/entrega-del-pedido";
import EntregaDelSobre from "./EntregaDelSobre";

/**
 * Lo que abre el QR del sobre de un pedido común (etiqueta del lote). El fotógrafo dueño lo marca
 * listo o entregado; el laboratorio del lote lo entrega si retira el cliente; el cliente ve el estado,
 * dónde retirar y confirma que lo recibió. Las acciones las vuelve a autorizar la API.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

function VistaInvalida() {
  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">{CODIGO_INVALIDO}</h1>
        <p className="text-sm text-gray-600">Revisá que el QR sea el del sobre. Si el problema sigue, consultá al fotógrafo.</p>
      </div>
    </div>
  );
}

export default async function PedidoEntregaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: crudo } = await params;
  const codigo = codigoDeLaRuta(crudo);
  if (!codigo) return <VistaInvalida />;
  const sobre = await cargarSobre(codigo);
  if (!sobre || esErrorDeSecreto(sobre)) return <VistaInvalida />;

  const auth = await getAuthUser();
  const jar = await cookies();
  const actor = actorParaElSobre(sobre, auth, (n) => jar.get(n)?.value);
  const acciones = accionesPermitidas({ actor, retiraCliente: sobre.retiraCliente, status: sobre.status });

  return (
    <EntregaDelSobre
      codigo={codigo}
      actor={actor}
      acciones={acciones}
      fotografo={sobre.fotografo}
      cliente={sobre.cliente}
      pedido={sobre.pedido}
      album={actor === "ANONIMO" ? null : sobre.album || null}
      status={sobre.status}
      textoDelEstado={sobre.textoDelEstado}
      retiraCliente={sobre.retiraCliente}
      dondeRetirar={sobre.dondeRetirar}
    />
  );
}
