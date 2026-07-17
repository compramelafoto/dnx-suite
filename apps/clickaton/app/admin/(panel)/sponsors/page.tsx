import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminSponsorsPage() {
  await requireClickatonAdmin();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Sponsors"
        description="Empresas y alianzas vinculadas a una edición, con alcance global o por sede. Sin portal del sponsor en el MVP."
        breadcrumbs={[{ label: "Sponsors" }]}
      />

      <AdminEmptyState
        title="Sin sponsors cargados"
        description="Más adelante vas a poder registrar empresa, contactos, logos, categoría o paquete, beneficios y observaciones por edición o sede."
        note="No se construye CRM avanzado ni portal externo en esta etapa."
      />
    </div>
  );
}
