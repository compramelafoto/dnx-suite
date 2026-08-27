import { TemplateEditorShell } from "@repo/template-editor-ui";
import { requireClickatonAdmin } from "@/lib/admin/auth";
// El import registra el runtime del editor (base, sesión y almacenamiento).
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ templateId: string; versionId: string }> };

export default async function ClickatonTemplateEditorPage({ params }: Props) {
  await requireClickatonAdmin();
  const { templateId, versionId } = await params;
  return <TemplateEditorShell templateId={templateId} versionId={versionId} />;
}
