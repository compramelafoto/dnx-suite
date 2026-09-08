import { PageHeader } from "@/components/page-header";
import { requireBookingsAdmin } from "@/lib/bookings/access";
import { listSpaces } from "@/lib/bookings/repository";
import { SpaceForm } from "../space-form";

export const dynamic = "force-dynamic";

export default async function NuevoEspacioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace } = await requireBookingsAdmin();
  const params = await searchParams;
  const espacios = await listSpaces(workspace.id, { includeInactive: true });

  return (
    <div className="space-y-8">
      <PageHeader title="Nuevo espacio" description="Un espacio que la institución alquila." />
      <SpaceForm
        space={null}
        otrosEspacios={espacios.map((e) => ({ id: e.id, name: e.name }))}
        compatibleCon={[]}
        error={params.error}
      />
    </div>
  );
}
