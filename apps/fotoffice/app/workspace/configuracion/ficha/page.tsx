import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { asegurarCategorias, listarCatalogoDeCategorias } from "@/lib/ficha/categorias";
import { listarCatalogoDeEtiquetas } from "@/lib/ficha/etiquetas";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { prisma } from "@repo/db";
import { CategoriasCatalogo } from "./categorias-catalogo";
import { EtiquetasCatalogo } from "./etiquetas-catalogo";

export const dynamic = "force-dynamic";

export default async function ConfiguracionFichaPage() {
  const { workspace, role } = await requireActiveWorkspaceRole();

  // El permiso va antes que cualquier lectura del catálogo.
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Ficha" />
        <p className="text-sm text-[var(--fo-muted)]">
          Sólo el dueño o un administrador pueden cambiar las categorías de notas y las etiquetas.
        </p>
      </div>
    );
  }

  // Un workspace que todavía no escribió notas arranca con sus categorías iniciales.
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { publicSlug: true },
  });
  await asegurarCategorias(workspace.id, branding?.publicSlug ?? "");
  const [categorias, etiquetas, vocabulario] = await Promise.all([
    listarCatalogoDeCategorias(workspace.id),
    listarCatalogoDeEtiquetas(workspace.id),
    loadPersonVocabulary(workspace.id),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title="Ficha"
        description={`Las categorías de las notas y las etiquetas que usa el equipo en las fichas de clientes y ${vocabulario.plural}.`}
      />
      <CategoriasCatalogo categorias={categorias} />
      <EtiquetasCatalogo etiquetas={etiquetas} />
    </div>
  );
}
