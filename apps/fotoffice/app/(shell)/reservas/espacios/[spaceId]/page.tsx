import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBookingsAdmin } from "@/lib/bookings/access";
import { getSpace, listCompatibilities, listSpaces } from "@/lib/bookings/repository";
import { compatibleSpaceIds } from "@/lib/bookings/conflicts";
import { SpaceForm } from "../space-form";

export const dynamic = "force-dynamic";

export default async function EditarEspacioPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace } = await requireBookingsAdmin();
  const { spaceId } = await params;
  const query = await searchParams;

  const [espacio, espacios, compatibilidades] = await Promise.all([
    getSpace(workspace.id, spaceId),
    listSpaces(workspace.id, { includeInactive: true }),
    listCompatibilities(workspace.id),
  ]);
  if (!espacio) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={espacio.name}
        description="Horarios, tarifas y convivencia de este espacio."
      />
      <SpaceForm
        space={espacio}
        otrosEspacios={espacios
          .filter((e) => e.id !== spaceId)
          .map((e) => ({ id: e.id, name: e.name }))}
        compatibleCon={compatibleSpaceIds(spaceId, compatibilidades)}
        error={query.error}
      />
    </div>
  );
}
