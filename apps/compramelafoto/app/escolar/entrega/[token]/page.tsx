import type { Metadata } from "next";
import { Role } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { accionesPosibles, cargarEntregaPorQr, TITULO_PASO } from "@/lib/school-fulfillment/entrega-por-qr";
import EntregaQr from "./EntregaQr";

export const dynamic = "force-dynamic";

// Lleva nombres y fotos de chicos: que no lo indexe nadie.
export const metadata: Metadata = { robots: { index: false, follow: false } };

function VistaInvalida() {
  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Enlace inválido o vencido</h1>
        <p className="text-sm text-gray-600">
          No pudimos encontrar esta información. Si el problema continúa, contactá al fotógrafo.
        </p>
      </div>
    </div>
  );
}

/**
 * Lo que abre el QR de la etiqueta del sobre de un pedido escolar. Muestra el pedido y sus fotos
 * (con marca de agua). El fotógrafo dueño, con su sesión, lo puede marcar listo para entregar o
 * entregado; cualquier otra persona (la familia, la escuela) puede confirmar que lo recibió.
 */
export default async function EscolarEntregaFichaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const codigo = decodeURIComponent(String(token || "").trim());
  const entrega = codigo ? await cargarEntregaPorQr(codigo) : null;
  if (!entrega) return <VistaInvalida />;

  const auth = await getAuthUser();
  const esFotografo = auth != null && (auth.role === Role.ADMIN || auth.id === entrega.fotografoId);
  return (
    <EntregaQr
      codigo={codigo}
      alumno={entrega.alumno}
      curso={entrega.curso}
      escuela={entrega.escuela}
      paso={entrega.paso}
      tituloPaso={TITULO_PASO(entrega.paso)}
      acciones={accionesPosibles(entrega.paso)}
      fotos={entrega.fotos}
      disenos={esFotografo ? entrega.disenos : []}
      esFotografo={esFotografo}
    />
  );
}
