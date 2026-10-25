import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";
import { asegurarAjustesPedidosDnx, leerAjustesPedidos, rubrosDeIngreso } from "@/lib/pedidos/ajustes";
import { leerPlantillasChecklist } from "@/lib/pedidos/checklist";
import { prisma } from "@repo/db";
import { AjustesPedidosForm } from "./ajustes-form";
import { PlantillasChecklistForm } from "./plantillas-checklist-form";

export const dynamic = "force-dynamic";

/**
 * Configuración → Pedidos (etapa 3, Entrega B1): recordatorio de cuotas, rubro de ingreso por
 * omisión y plantillas de checklist. Permiso: `configurar`. Se puede configurar con el módulo
 * apagado, para dejarlo listo antes de encenderlo; sólo cambia el aviso de arriba.
 */
export default async function ConfiguracionPedidosPage() {
  const { workspace, role } = await requireActiveWorkspaceRole();

  // El permiso va antes que cualquier lectura.
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Pedidos" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar los pedidos.</p>
      </div>
    );
  }

  // DNX Estudio arranca con el recordatorio un día antes, encendido. Nunca pisa una fila.
  await asegurarAjustesPedidosDnx(workspace.id);

  const [ajustes, rubros, encendido, plantillas] = await Promise.all([
    leerAjustesPedidos(workspace.id),
    rubrosDeIngreso(workspace.id),
    isModuleEnabledForWorkspace(workspace.id, ORDERS_MODULE_KEY),
    leerPlantillasChecklist(prisma, workspace.id),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Pedidos"
        description="Recordatorio de cuotas, rubro de ingreso por omisión y plantillas de checklist de los pedidos."
      />
      {!encendido ? (
        <div role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          El módulo Pedidos todavía no está encendido. Podés dejar los ajustes listos; para encenderlo, pedilo desde{" "}
          <Link href="/workspace/configuracion/modulos" className="text-[var(--fo-accent)] hover:underline">
            Configuración → Módulos
          </Link>
          .
        </div>
      ) : null}
      <AjustesPedidosForm ajustes={ajustes} rubros={rubros} />

      {/* Plantillas de checklist (Entrega B1): se copian a cada pedido al confirmarlo. */}
      <section className="fo-card space-y-4 p-5" aria-labelledby="checklist-pedido-titulo" data-seccion="checklist">
        <div className="space-y-1">
          <h2 id="checklist-pedido-titulo" className="text-base font-semibold">
            Plantillas de checklist
          </h2>
          <p className="text-sm text-[var(--fo-muted)]">
            Las listas de tareas que se copian a cada pedido al confirmarlo (por omisión, la primera; al confirmar se puede
            elegir otra o ninguna). Después, cada pedido puede tildar, agregar y quitar tareas sin afectar a la plantilla.
          </p>
        </div>
        <PlantillasChecklistForm plantillas={plantillas} />
      </section>

      <section className="fo-card space-y-2 p-5 text-sm" aria-labelledby="otros-ajustes-pedido-titulo">
        <h2 id="otros-ajustes-pedido-titulo" className="text-base font-semibold">
          Textos y numeración
        </h2>
        <p className="text-[var(--fo-muted)]">
          Los textos del recibo de pago y del recordatorio de cuotas se editan en{" "}
          <Link href="/workspace/configuracion/plantillas?canal=automaticos" className="text-[var(--fo-accent)] hover:underline">
            Configuración → Plantillas
          </Link>
          , en la pestaña Automáticos.
        </p>
        <p className="text-[var(--fo-muted)]">
          El número de cada pedido (prefijo, año y próximo número) se configura en{" "}
          <Link href="/workspace/configuracion/numeracion" className="text-[var(--fo-accent)] hover:underline">
            Configuración → Numeración
          </Link>
          , en la fila «Pedidos».
        </p>
      </section>
    </div>
  );
}
