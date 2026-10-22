import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaVideos } from "@/components/digitalizacion/pagina-videos";
import { contextoDigitalizacion } from "@/lib/digitalizacion/contexto";
import { abrirVistaPreviaDelEquipo } from "@/lib/digitalizacion/servidor/videos-publicos";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Vista previa · Tus videos", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * «Ver como el cliente» de la lista de Digitalización: la página pública de videos de un pedido,
 * tal como la ve el cliente, para el equipo. Fuera del panel (sin el menú), para que se vea igual.
 * Pide sesión con permiso de ver Digitalización y que el pedido sea del negocio activo; si no, 404.
 * Sólo lee: no rota el token, no da la entrega por enviada, no cuenta descargas ni cobra nada.
 */
export default async function VistaClientePage({ params }: { params: Promise<{ pedidoId: string }> }) {
  const { pedidoId } = await params;
  const ctx = await contextoDigitalizacion("VIEW");
  if (!ctx) notFound();
  const vista = await abrirVistaPreviaDelEquipo(ctx.workspaceId, pedidoId);
  if (!vista) notFound();
  return (
    <>
      <div role="status" className="sticky top-0 z-50 border-b-2 border-amber-500 bg-amber-300 px-4 py-3 text-center text-sm font-semibold text-amber-950">
        Vista previa: así ve esta página el cliente. Nada de lo que hagas acá cuenta.
      </div>
      <PaginaVideos modo="PREVIA" vista={vista} />
    </>
  );
}
