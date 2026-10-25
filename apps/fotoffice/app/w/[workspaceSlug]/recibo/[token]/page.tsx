import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/governance/print-button";
import { ESTILO_IMPRESION_RECIBO, ReciboPublico } from "@/components/pedidos/recibo-publico";
import { pasaElFrenoDeEnlaces } from "@/lib/pedidos/freno-publico";
import { abrirReciboPublico } from "@/lib/pedidos/publico";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Recibo", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * El recibo X interno de un cobro (etapa 3, spec §2 A.5), sin sesión: el token es la llave. Se
 * imprime o se guarda como PDF desde el navegador (sin dependencia nueva): al imprimir sale sólo
 * el recibo. Un recibo anulado sigue abriendo, con el sello "ANULADO". Token sin forma,
 * desconocido, de otro workspace o de un pedido: "Enlace no disponible" (404).
 */
export default async function ReciboPublicoPage({ params }: Props) {
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
  const vista = await abrirReciboPublico(workspaceId, token);
  if (!vista) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <style>{ESTILO_IMPRESION_RECIBO}</style>
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm opacity-70">En el diálogo de impresión elegí «Guardar como PDF».</p>
        <PrintButton label="Imprimir / Guardar PDF" />
      </div>
      <ReciboPublico vista={vista} />
    </main>
  );
}
