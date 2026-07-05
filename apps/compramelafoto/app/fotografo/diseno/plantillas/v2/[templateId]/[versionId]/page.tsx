import { TemplateEditorShell } from "@/components/template-v2/TemplateEditorShell";

type Props = {
  params: Promise<{ templateId: string; versionId: string }>;
};

export default async function TemplateV2EditorPage({ params }: Props) {
  const { templateId, versionId } = await params;
  return <TemplateEditorShell templateId={templateId} versionId={versionId} />;
}
