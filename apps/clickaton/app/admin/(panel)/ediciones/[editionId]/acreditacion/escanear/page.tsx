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
        title="Scanner de acreditación"
        description={`${edition.name} — optimizado para celular. Validación en backend.`}
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Acreditación", href: `${adminRoutes.editions}/${editionId}/acreditacion` },
          { label: "Escanear" },
        ]}
        actions={
          <Button href={`${adminRoutes.editions}/${editionId}/acreditacion`} variant="secondary">
            Panel
          </Button>
        }
      />
      <Card variant="outlined" className="p-5">
        <AccreditationScanner editionId={editionId} />
      </Card>
    </div>
  );
}
