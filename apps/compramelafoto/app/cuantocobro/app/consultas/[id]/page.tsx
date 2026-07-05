import ConsultaDetailClient from "@/components/cuantocobro/consultas/ConsultaDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CuantoCobroConsultaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const consultaId = Number(id);

  if (!Number.isFinite(consultaId) || consultaId <= 0) {
    return null;
  }

  return <ConsultaDetailClient consultaId={consultaId} />;
}
