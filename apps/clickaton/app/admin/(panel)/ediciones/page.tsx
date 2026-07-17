import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export default async function AdminEditionsPage() {
  await requireClickatonAdmin();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Ediciones"
        description="Cada edición de Clickatón puede tener una o varias sedes. Aquí se administrará el producto de marca; la competencia asociada se ejecutará en FotoRank."
        breadcrumbs={[{ label: "Ediciones" }]}
        actions={
          <Button type="button" variant="primary" disabled title="Disponible en la Etapa 10C">
            Crear edición
          </Button>
        }
      />

      <AdminEmptyState
        title="No hay ediciones todavía"
        description="El listado y el alta de ediciones se implementarán en la próxima etapa. Esta pantalla no muestra datos simulados."
        note="Próxima etapa: modelo y CRUD mínimo de ediciones y sedes (10C)."
        action={
          <Button type="button" variant="secondary" disabled>
            Crear edición (próximamente)
          </Button>
        }
      />
    </div>
  );
}
