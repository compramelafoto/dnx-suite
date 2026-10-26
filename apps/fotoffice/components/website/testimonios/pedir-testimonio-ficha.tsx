import "server-only";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { contextoDelPanelMensaje } from "@/lib/plantillas/ficha";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { PedirTestimonio } from "./pedir-testimonio";

/**
 * «Pedir testimonio» en una ficha. Componente de servidor: la misma guarda que «Mensaje» del cliente
 * (sesión, `operar` en Clientes, módulo y cliente del workspace) y el sitio web encendido (el
 * testimonio se deja en el sitio). Sin eso no se dibuja; la acción lo vuelve a exigir.
 */
export async function PedirTestimonioFicha({
  clientId,
  proyectoId = null,
  conTarjeta = false,
}: {
  clientId: string;
  proyectoId?: string | null;
  /** En la ficha del proyecto va en su propia tarjeta; en la del cliente, dentro de «Mensaje». */
  conTarjeta?: boolean;
}) {
  const ctx = await contextoDelPanelMensaje("CLIENTE", clientId);
  if (!ctx || !(await isModuleEnabledForWorkspace(ctx.workspaceId, WEBSITE_MODULE_KEY))) return null;
  const boton = <PedirTestimonio clientId={clientId} proyectoId={proyectoId} />;
  if (!conTarjeta) return boton;
  return (
    <section className="fo-card space-y-2 p-4" aria-labelledby={`testimonio-${proyectoId ?? clientId}`}>
      <h2 id={`testimonio-${proyectoId ?? clientId}`} className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Testimonio
      </h2>
      <p className="text-xs text-[var(--fo-muted)]">Pedile al cliente que cuente cómo le fue con este trabajo. Queda atado al proyecto.</p>
      {boton}
    </section>
  );
}
