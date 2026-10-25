import EditorDePlantilla from "./EditorDePlantilla";

type Props = {
  params: Promise<{ templateId: string; versionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function TemplateV2EditorPage({ params, searchParams }: Props) {
  const { templateId, versionId } = await params;
  const { diseno } = await searchParams;
  // `?diseno=<id>`: se abrió desde la revisión para retocar el armado de un solo diseño.
  const disenoId = typeof diseno === "string" && /^\d+$/.test(diseno) ? Number(diseno) : null;
  return <EditorDePlantilla templateId={templateId} versionId={versionId} disenoId={disenoId} />;
}
