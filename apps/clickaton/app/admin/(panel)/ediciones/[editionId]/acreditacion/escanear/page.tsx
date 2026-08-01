import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AccreditationScanner } from "@/components/admin/accreditation/AccreditationScanner";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";

type Props = { params: Promise<{ editionId: string }> };

export default async function AccreditationScanPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true },
  });
  if (!edition) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <AdminPageHeader
        title="Escanear credencial"
        description={`${edition.name}. El código QR identifica al participante durante la acreditación. Optimizado para celular.`}
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Acreditación", href: `${adminRoutes.editions}/${editionId}/acreditacion` },
          { label: "Escanear credencial" },
        ]}
        actions={
          <Button
            href={`${adminRoutes.editions}/${editionId}/acreditacion`}
            variant="secondary"
            className="min-h-11"
          >
            Volver al panel
          </Button>
        }
      />
      <Card variant="outlined" className="p-5">
        <AccreditationScanner editionId={editionId} />
      </Card>
    </div>
  );
}
