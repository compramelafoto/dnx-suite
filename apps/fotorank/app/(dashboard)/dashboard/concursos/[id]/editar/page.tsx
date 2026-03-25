import { notFound } from "next/navigation";
import { PageContainer } from "../../../../../components/PageContainer";
import { getFotorankContestById } from "../../../../../lib/fotorank/contests";
import { EditContestForm } from "./EditContestForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditContestPage({ params }: PageProps) {
  const { id } = await params;
  const contest = await getFotorankContestById(id);

  if (!contest) {
    notFound();
  }

  return (
    <PageContainer
      title={`Editar: ${contest.title}`}
      description="Datos generales, estado y contenido que verán los participantes en la landing pública."
    >
      <EditContestForm contest={contest} />
    </PageContainer>
  );
}
