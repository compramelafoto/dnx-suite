import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { PageContainer } from "../../../../components/PageContainer";
import { getFotorankContestById } from "../../../../lib/fotorank/contests";
import { ContestDashboard } from "./ContestDashboard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContestDetailPage({ params }: PageProps) {
  const { id } = await params;
  const contest = await getFotorankContestById(id);

  if (!contest) {
    notFound();
  }

  return (
    <PageContainer
      title={contest.title}
      description={contest.shortDescription ?? "Centro de configuración del concurso."}
    >
      <ContestDashboard contest={contest} />
    </PageContainer>
  );
}
