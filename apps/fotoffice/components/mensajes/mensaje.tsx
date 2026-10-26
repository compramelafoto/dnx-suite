import "server-only";
import { cargarPanelMensaje } from "@/lib/plantillas/ficha";
import { PedirTestimonioFicha } from "@/components/website/testimonios/pedir-testimonio-ficha";
import { PanelMensaje } from "./panel-mensaje";

/**
 * Tarjeta "Mensaje" de la ficha (Cliente, Socio o Consulta). Componente de servidor:
 * `cargarPanelMensaje` hace la guarda (sesión, workspace, `operar`, módulo y registro del
 * workspace) ANTES de leer plantillas o datos de contacto. Sin `operar` no se ve. En la del cliente,
 * al lado va «Pedir testimonio» (sitio web, PR 3).
 */
export async function Mensaje({ entityType, entityId }: { entityType: "CLIENTE" | "SOCIO" | "CONSULTA"; entityId: string }) {
  const panel = await cargarPanelMensaje(entityType, entityId);
  if (!panel) return null;
  return (
    <section className="fo-card space-y-3 p-4" aria-labelledby={`mensaje-${entityId}`}>
      <h2 id={`mensaje-${entityId}`} className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Mensaje
      </h2>
      <PanelMensaje entityType={entityType} entityId={entityId} panel={panel} />
      {entityType === "CLIENTE" ? <PedirTestimonioFicha clientId={entityId} /> : null}
    </section>
  );
}
