import { requireBlogEditor } from "@/lib/blog/access";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { leerAjustesTestimonios } from "@/lib/testimonios/ajustes";
import { enlaceDeTestimonio } from "@/lib/testimonios/invitaciones";
import { contarPendientes } from "@/lib/testimonios/repositorio";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { AjustesTestimonios } from "@/components/website/testimonios/ajustes-testimonios";
import { TestimoniosShell } from "@/components/website/testimonios/testimonios-shell";

export const dynamic = "force-dynamic";

/**
 * Sitio web → Testimonios → Ajustes: el enlace abierto para compartir, el aviso al equipo y el pedido
 * automático (apagado por omisión; lo manda el cron diario). Encenderlo equivale a mandar correos.
 */
export default async function AjustesTestimoniosPage() {
  const { workspace } = await requireBlogEditor();
  const [ajustes, pendientes, sitio, sitioEncendido, clientesEncendido] = await Promise.all([
    leerAjustesTestimonios(workspace.id),
    contarPendientes(workspace.id),
    sitioDelWorkspace(workspace.id),
    isModuleEnabledForWorkspace(workspace.id, WEBSITE_MODULE_KEY),
    isModuleEnabledForWorkspace(workspace.id, CLIENTS_MODULE_KEY),
  ]);
  const enlaceAbierto =
    sitio?.slug || sitio?.customDomain ? enlaceDeTestimonio(sitio.slug ?? "", null, { customDomain: sitio.customDomain }) : null;
  // Lo mismo que mira la tarea diaria antes de mandar: si falta algo, los pedidos no salen.
  const faltaParaElAutomatico = !enlaceAbierto
    ? "el sitio todavía no tiene dirección pública (elegila en Sitio web)"
    : !sitioEncendido
      ? "el módulo Sitio web está apagado"
      : !clientesEncendido
        ? "el módulo Clientes está apagado"
        : null;

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
        faltaParaElAutomatico={faltaParaElAutomatico}
      />
    </TestimoniosShell>
  );
}
