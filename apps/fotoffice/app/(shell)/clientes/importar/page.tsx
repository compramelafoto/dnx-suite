import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireClientsEditor } from "@/lib/clients/access";
import { ENCABEZADO_EJEMPLO_CLIENTES, MAX_FILAS_IMPORTACION_CLIENTES } from "@/lib/clients/importar";
import { ImportarClientes } from "@/components/contactos/importar-clientes";

export const dynamic = "force-dynamic";
// La confirmación (server action) corre bajo la configuración de esta página: hasta 2.000 filas.
export const maxDuration = 300;

/** Clientes → Importar: CSV con los datos del cliente y los ampliados (spec §3.6). Pide Gestionar. */
export default async function ImportarClientesPage() {
  await requireClientsEditor();
  return (
    <div className="space-y-8">
      <PageHeader
        title="Importar clientes"
        description={`Cargá hasta ${MAX_FILAS_IMPORTACION_CLIENTES.toLocaleString("es-AR")} clientes a la vez desde un CSV, con su categoría y sus datos de contacto.`}
        actions={
          <Link href="/clientes" className="fo-btn fo-btn-secondary text-sm">
            Volver a clientes
          </Link>
        }
      />
      <ImportarClientes encabezado={ENCABEZADO_EJEMPLO_CLIENTES} />
    </div>
  );
}
