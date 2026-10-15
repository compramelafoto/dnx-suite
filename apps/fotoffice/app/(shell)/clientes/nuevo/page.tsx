import { PageHeader } from "@/components/page-header";
import { requireClientsEditor } from "@/lib/clients/access";
import { ClientForm } from "../client-form";

export const dynamic = "force-dynamic";

export default async function NuevoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Es sólo el formulario de alta: sin MANAGE no hay nada para ver acá, vuelve al padrón.
  await requireClientsEditor();
  const params = await searchParams;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Nuevo cliente"
        description="Alta de un cliente del negocio. Los datos fiscales se pueden completar más adelante, salvo que sea responsable inscripto."
      />
      <ClientForm client={null} error={params.error} />
    </div>
  );
}
