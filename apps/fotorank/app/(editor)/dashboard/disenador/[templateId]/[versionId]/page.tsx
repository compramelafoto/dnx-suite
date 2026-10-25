import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { TemplateEditorShell, TEMPLATE_V2_BASE_PATHS } from "@repo/template-editor-ui";
import { requireAuth } from "../../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../../lib/fotorank/dashboard-org-context";
import { FOTORANK_EDITOR_THEME } from "../../../../../lib/fotorank/design/theme";
// El import registra el runtime del editor: base, sesión y almacenamiento de esta app.
import "../../../../../lib/fotorank/design/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ templateId: string; versionId: string }> };

/**
 * El diseñador abierto sobre una plantilla.
 *
 * Se comprueba que la plantilla sea de la organización activa antes de abrirla: sin eso,
 * alguien con el enlace podría editar el diploma de otra organización.
 */
export default async function DisenadorPage({ params }: Props) {
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) redirect("/dashboard");

  const { templateId, versionId } = await params;
  const template = await prisma.templateV2.findFirst({
    where: { id: templateId, workspaceId: org.org.id },
    select: { id: true },
  });
  if (!template) redirect("/dashboard/disenador");

  return (
    <TemplateEditorShell
      templateId={templateId}
      versionId={versionId}
      basePath={TEMPLATE_V2_BASE_PATHS.fotorank}
      theme={FOTORANK_EDITOR_THEME}
    />
  );
}
