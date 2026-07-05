import AdminCatalogTemplateForm from "@/components/admin/catalog-templates/AdminCatalogTemplateForm";
import AdminCatalogTemplateShell from "@/components/admin/catalog-templates/AdminCatalogTemplateShell";

export default function AdminCatalogTemplateNewPage() {
  return (
    <AdminCatalogTemplateShell
      breadcrumbs={[
        { label: "Templates del sistema", href: "/admin/catalog-templates" },
        { label: "Nuevo" },
      ]}
      title="Nuevo template"
      subtitle="Definí el producto sugerido. Los fotógrafos lo verán solo si está activo."
    >
      <AdminCatalogTemplateForm mode="create" />
    </AdminCatalogTemplateShell>
  );
}
