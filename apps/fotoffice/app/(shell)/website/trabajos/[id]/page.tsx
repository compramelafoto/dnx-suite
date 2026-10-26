import { notFound } from "next/navigation";
import { requireBlogEditor } from "@/lib/blog/access";
import { loadPublicSlug } from "@/lib/blog/admin-queries";
import { listarCategorias, obtenerTrabajo } from "@/lib/trabajos/repositorio";
import { esTablaFaltante } from "@/lib/trabajos/reglas";
import { TRABAJOS_PUBLIC_SEGMENT } from "@/lib/website/constants";
import { AvisoTablasFaltantes, TrabajosShell } from "@/components/website/trabajos/trabajos-shell";
import { TrabajoEditor } from "@/components/website/trabajos/trabajo-editor";
import { TrabajoFotos } from "@/components/website/trabajos/trabajo-fotos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function cargar(workspaceId: string, id: string) {
  try {
    const [trabajo, categorias, publicSlug] = await Promise.all([
      obtenerTrabajo(workspaceId, id),
      listarCategorias(workspaceId),
      loadPublicSlug(workspaceId),
    ]);
    return { trabajo, categorias, publicSlug, faltanTablas: false };
  } catch (err) {
    if (esTablaFaltante(err)) return { trabajo: null, categorias: [], publicSlug: null, faltanTablas: true };
    throw err;
  }
}

export default async function TrabajoPage({ params }: Props) {
  const { workspace } = await requireBlogEditor();
  const { id } = await params;
  // Con el filtro de la institución: el id de un trabajo de otra institución da 404.
  const { trabajo, categorias, publicSlug, faltanTablas } = await cargar(workspace.id, id);
  if (faltanTablas) {
    return (
      <TrabajosShell>
        <AvisoTablasFaltantes />
      </TrabajosShell>
    );
  }
  if (!trabajo) notFound();

  const categoria = trabajo.categoriaId ? categorias.find((c) => c.id === trabajo.categoriaId) : undefined;
  const publicado = trabajo.estado === "PUBLICADO";
  // Sólo hay página pública con trabajo publicado en una categoría visible.
  const enlacePublico =
    publicado && categoria?.visible && publicSlug
      ? `/w/${publicSlug}/${TRABAJOS_PUBLIC_SEGMENT}/${categoria.slug}/${trabajo.slug}`
      : null;
  const aviso = !publicado
    ? "Borrador: no se ve en el sitio hasta que lo publiques."
    : !categoria
      ? "Está publicado pero sin categoría: no se ve en el sitio hasta que le elijas una."
      : !categoria.visible
        ? `Está publicado pero la categoría «${categoria.nombre}» está oculta: no se ve en el sitio.`
        : "Publicado: se ve en la sección Trabajos de tu sitio.";

  return (
    <TrabajosShell
      title={trabajo.titulo}
      description={aviso}
      actions={
        enlacePublico ? (
          <a href={enlacePublico} target="_blank" rel="noreferrer" className="fo-btn fo-btn-secondary">
            Ver publicado
          </a>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <TrabajoEditor
          id={trabajo.id}
          publicado={publicado}
          categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre, visible: c.visible }))}
          inicial={{
            titulo: trabajo.titulo,
            slug: trabajo.slug,
            categoriaId: trabajo.categoriaId ?? "",
            lugar: trabajo.lugar ?? "",
            // Día calendario guardado como medianoche UTC: se lee en UTC.
            fecha: trabajo.fecha ? trabajo.fecha.toISOString().slice(0, 10) : "",
            descripcionHtml: trabajo.descripcionHtml ?? "",
            destacado: trabajo.destacado,
            seoTitle: trabajo.seoTitle ?? "",
            seoDescription: trabajo.seoDescription ?? "",
          }}
        />
        <TrabajoFotos
          trabajoId={trabajo.id}
          portadaUrl={trabajo.portadaUrl}
          fotos={trabajo.fotos.map((f) => ({ id: f.id, tipo: f.tipo, url: f.url, alt: f.alt, ancho: f.ancho, alto: f.alto }))}
        />
      </div>
    </TrabajosShell>
  );
}
