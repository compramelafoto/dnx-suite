import { PageHeader } from "@/components/page-header";
import { requireSalesStaff } from "@/lib/sales/access";
import { listProductCategories, listProducts } from "@/lib/sales/repository";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { listClients } from "@/lib/clients/repository";
import { Pos } from "./pos";

export const dynamic = "force-dynamic";

/**
 * La caja de kiosco. Se usa con gente esperando del otro lado del mostrador, así que acá se
 * arma todo lo que la pantalla necesita de una sola vez —catálogo, categorías, y clientes
 * sólo si ese módulo está prendido— y el resto es trabajo del cliente (`pos.tsx`): agregar y
 * cobrar no pueden depender de ida y vuelta al servidor por cada clic.
 */
export default async function VentasPage() {
  const { workspace } = await requireSalesStaff();

  const clientsEnabled = await isModuleEnabledForWorkspace(workspace.id, CLIENTS_MODULE_KEY);
  // Sólo para el cartel fijo de "esto no se va a depositar": `recordSale` vuelve a preguntar
  // esto mismo antes de escribir (nunca confía en lo que decidió la pantalla), así que acá no
  // es control de acceso — es avisarle al mostrador de antemano, no después del hecho.
  const cashEnabled = await isModuleEnabledForWorkspace(workspace.id, CASH_MODULE_KEY);

  const [productos, categorias, clientes] = await Promise.all([
    listProducts(workspace.id, { onlyActive: true }),
    listProductCategories(workspace.id),
    clientsEnabled ? listClients(workspace.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Caja" description="Buscá o escaneá, armá el ticket y cobrá." />
      <Pos
        products={productos}
        categories={categorias}
        clientsEnabled={clientsEnabled}
        clients={clientes}
        cashEnabled={cashEnabled}
      />
    </div>
  );
}
