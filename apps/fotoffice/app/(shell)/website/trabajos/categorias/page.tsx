import { requireBlogEditor } from "@/lib/blog/access";
import { listarCategorias, listarTrabajos } from "@/lib/trabajos/repositorio";
import { esTablaFaltante } from "@/lib/trabajos/reglas";
import { AvisoTablasFaltantes, TrabajosShell } from "@/components/website/trabajos/trabajos-shell";
import { CategoriasTrabajos } from "@/components/website/trabajos/categorias-trabajos";

export const dynamic = "force-dynamic";

const TITULO = "Categorías de Trabajos";
const DESCRIPCION =
  "Ordenan los trabajos en el sitio (Casamientos, XV, Books…). Cada una tiene su página. Una categoría oculta esconde todos sus trabajos.";

async function cargar(workspaceId: string) {
  try {
    const [categorias, trabajos] = await Promise.all([listarCategorias(workspaceId), listarTrabajos(workspaceId)]);
    return { categorias, trabajos, faltanTablas: false };
  } catch (err) {
    if (esTablaFaltante(err)) return { categorias: [], trabajos: [], faltanTablas: true };
    throw err;
  }
}

export default async function CategoriasTrabajosPage() {
  const { workspace } = await requireBlogEditor();
  const { categorias, trabajos, faltanTablas } = await cargar(workspace.id);
  if (faltanTablas) {
    return (
      <TrabajosShell title={TITULO} description={DESCRIPCION}>
        <AvisoTablasFaltantes />
      </TrabajosShell>
    );
  }
  const cuantos = new Map<string, number>();
  for (const t of trabajos) if (t.categoriaId) cuantos.set(t.categoriaId, (cuantos.get(t.categoriaId) ?? 0) + 1);

  return (
    <TrabajosShell title={TITULO} description={DESCRIPCION}>
      <CategoriasTrabajos
        categorias={categorias.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          slug: c.slug,
          visible: c.visible,
          trabajos: cuantos.get(c.id) ?? 0,
        }))}
      />
    </TrabajosShell>
  );
}
