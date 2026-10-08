import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { NuevoPedido } from "@/components/pedidos/nuevo-pedido";
import { puedeEnContexto } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { requirePedidos } from "@/lib/pedidos/pagina";
import { catalogoParaEditor } from "@/lib/presupuestos/editor-datos";
import { contactoParaPresupuesto } from "@/lib/presupuestos/nuevo-datos";

export const dynamic = "force-dynamic";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * "Nuevo pedido" sin presupuesto, para un contacto (`?contacto=`, desde su ficha). Pide "Gestionar"
 * en Pedidos y "Ver" en Clientes (el nombre del contacto es un dato de Clientes). Un contacto de
 * otro workspace da 404. Sin contacto, explica dónde se crea. El catálogo va sin costos.
 */
export default async function NuevoPedidoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { workspace, ctx } = await requirePedidos("operar");
  const sp = await searchParams;
  const contactoId = typeof sp.contacto === "string" && ID_VALIDO.test(sp.contacto) ? sp.contacto : null;
  const veContactos = puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY);
  const contacto = contactoId && veContactos ? await contactoParaPresupuesto(workspace.id, contactoId) : null;
  if (contactoId && veContactos && !contacto) notFound();
  const catalogo = contacto ? await catalogoParaEditor(workspace.id) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo pedido"
        description={contacto ? `Para ${contacto.nombre}, sin presupuesto.` : "Un pedido sin presupuesto, para un contacto."}
        actions={
          <Link href="/pedidos" className="fo-btn fo-btn-secondary text-sm">
            Volver a Pedidos
          </Link>
        }
      />
      {contacto ? (
        <NuevoPedido clientId={contacto.id} catalogo={catalogo} />
      ) : (
        <div className="fo-card space-y-2 text-sm">
          <p>
            El pedido sin presupuesto se crea desde la ficha del contacto: abrí el contacto y tocá «Nuevo pedido» en la tarjeta
            Pedidos. Para un trabajo presupuestado, confirmá el pedido desde el presupuesto aceptado.
          </p>
          {veContactos ? (
            <Link href="/clientes" className="font-medium text-[var(--fo-accent)] hover:underline">
              Ir a Clientes
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
