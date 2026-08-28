import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { TemplateEditorShell } from "@repo/template-editor-ui";
import { requireActiveWorkspace } from "@/lib/workspace";
// El import registra el runtime del editor: base, sesión y almacenamiento de esta app.
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ templateId: string; versionId: string }> };

/**
 * Editor de una plantilla.
 *
 * Se comprueba que la plantilla sea de la institución activa antes de abrirla: sin eso,
 * alguien con el enlace podría editar el carnet de otra institución.
 */
export default async function PlantillaEditorPage({ params }: Props) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  if (!["OWNER", "ADMIN"].includes(String(membership?.role ?? ""))) redirect("/workspace");

  const { templateId, versionId } = await params;
  const template = await prisma.templateV2.findFirst({
    where: { id: templateId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!template) redirect("/plantillas");

  return <TemplateEditorShell templateId={templateId} versionId={versionId} />;
}
