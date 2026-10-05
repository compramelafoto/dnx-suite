import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireStoreConfigurer } from "@/lib/store/access";
import { ContestsSection } from "./contests-section";
import { OrganizationLinksSection } from "./organization-links-section";

export const dynamic = "force-dynamic";

/**
 * Obras de concursos de FotoRank (etapa 3). Cada parte de la pantalla es un componente propio
 * que carga sus datos: vínculos con organizaciones acá; formatos, concursos y regalías se
 * suman como secciones aparte.
 */
export default async function TiendaObrasPage() {
  const { user, workspace } = await requireStoreConfigurer();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Obras"
        description="Vendé copias impresas y cuadros de las obras de tus concursos de FotoRank, con permiso de cada autor y pagándole una regalía."
      />

      <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/ventas/tienda/obras/formatos" className="underline">
          Formatos de impresión y calidad mínima →
        </Link>
        <Link href="/ventas/tienda/obras/regalias" className="underline">
          Regalías de los autores →
        </Link>
      </p>

      <ContestsSection workspaceId={workspace.id} />

      <OrganizationLinksSection userId={user.id} workspaceId={workspace.id} />
    </div>
  );
}
