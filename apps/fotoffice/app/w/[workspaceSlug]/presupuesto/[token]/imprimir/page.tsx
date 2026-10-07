import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/governance/print-button";
import { ESTILO_IMPRESION, PresupuestoPublico } from "@/components/presupuestos/presupuesto-publico";
import { abrirPresupuestoPublico } from "@/lib/presupuestos/publico";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import { visitanteDelEnlace } from "../visitante";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Presupuesto", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * El presupuesto listo para imprimir o "Guardar como PDF" desde el navegador (sin dependencia
 * nueva). Al imprimir sale sólo el presupuesto. No cuenta como visita (eso es la página).
 */
export default async function ImprimirPresupuestoPage({ params }: Props) {
  const { workspaceSlug, token } = await params;
  const visitante = await visitanteDelEnlace();
  if (!visitante.permitido) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <p>Hubo demasiadas visitas desde tu conexión. Esperá unos minutos y volvé a abrir el enlace.</p>
      </main>
    );
  }
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();
  const r = await abrirPresupuestoPublico(workspaceId, token, { registrar: false, ipHash: null, userAgent: null });
  if (!r) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-6 bg-white px-4 py-8 text-black md:px-8">
      <style>{ESTILO_IMPRESION}</style>
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--fo-muted)]">En el diálogo de impresión elegí «Guardar como PDF».</p>
        <PrintButton />
      </div>
      <PresupuestoPublico vista={r.vista} />
    </main>
  );
}
