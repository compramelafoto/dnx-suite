import "server-only";
import { Mail } from "lucide-react";
import { cargarPanelMensaje } from "@/lib/plantillas/ficha";
import { PedirTestimonioFicha } from "@/components/website/testimonios/pedir-testimonio-ficha";
import { PanelMensaje } from "./panel-mensaje";

/**
 * Tarjeta "Mensaje" de la ficha (Cliente, Socio o Consulta). Componente de servidor:
 * `cargarPanelMensaje` hace la guarda (sesión, workspace, `operar`, módulo y registro del
 * workspace) ANTES de leer plantillas o datos de contacto. Sin `operar` no se ve. En la del cliente,
 * al lado va «Pedir testimonio» (sitio web, PR 3).
 */
export async function Mensaje({
  entityType,
  entityId,
  compacto = false,
  correoAlternativo = null,
}: {
  entityType: "CLIENTE" | "SOCIO" | "CONSULTA";
  entityId: string;
  /** Sólo los botones de ícono, para la fila de contacto del encabezado de la ficha. */
  compacto?: boolean;
  /** En la versión compacta, sin permiso para enviar desde el sistema: un `mailto:` a este correo. */
  correoAlternativo?: string | null;
}) {
  const panel = await cargarPanelMensaje(entityType, entityId);
  if (!panel) {
    const mail = correoAlternativo?.trim();
    if (!compacto || !mail) return null;
    return (
      <a href={`mailto:${mail}`} className="fo-icon-btn" data-tip={`Escribir a ${mail}`} aria-label={`Escribir a ${mail}`}>
        <Mail className="size-4" aria-hidden />
      </a>
    );
  }
  if (compacto) {
    return (
      <>
        <PanelMensaje entityType={entityType} entityId={entityId} panel={panel} compacto />
        {entityType === "CLIENTE" ? <PedirTestimonioFicha clientId={entityId} compacto /> : null}
      </>
    );
  }
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
