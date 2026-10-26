import { requireBlogEditor } from "@/lib/blog/access";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { leerAjustesTestimonios } from "@/lib/testimonios/ajustes";
import { enlaceDeTestimonio } from "@/lib/testimonios/invitaciones";
import { contarPendientes } from "@/lib/testimonios/repositorio";
import { AjustesTestimonios } from "@/components/website/testimonios/ajustes-testimonios";
import { TestimoniosShell } from "@/components/website/testimonios/testimonios-shell";

export const dynamic = "force-dynamic";

/**
 * Sitio web → Testimonios → Ajustes: el enlace abierto para compartir, el aviso al equipo y el pedido
 * automático (apagado por omisión; lo manda el cron diario). Encenderlo equivale a mandar correos.
 */
export default async function AjustesTestimoniosPage() {
  const { workspace } = await requireBlogEditor();
  const [ajustes, pendientes, sitio] = await Promise.all([
    leerAjustesTestimonios(workspace.id),
    contarPendientes(workspace.id),
    sitioDelWorkspace(workspace.id),
  ]);
  const enlaceAbierto =
    sitio?.slug || sitio?.customDomain ? enlaceDeTestimonio(sitio.slug ?? "", null, { customDomain: sitio.customDomain }) : null;

  return (
    <TestimoniosShell pendientes={pendientes}>
      <AjustesTestimonios
        inicial={{
          automaticoEncendido: ajustes.automaticoEncendido,
          diasDespues: ajustes.diasDespues,
          avisarAlEquipo: ajustes.avisarAlEquipo,
          encendidoAt: ajustes.encendidoAt?.toISOString() ?? null,
        }}
        enlaceAbierto={enlaceAbierto}
      />
    </TestimoniosShell>
  );
}
