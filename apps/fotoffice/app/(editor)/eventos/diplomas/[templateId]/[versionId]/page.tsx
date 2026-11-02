import { redirect } from "next/navigation";
import { TemplateEditorShell } from "@repo/template-editor-ui";
import { canDesignDiplomas, canDesignTemplates } from "@/lib/template-v2/access";
import { FOTOFFICE_EDITOR_THEME } from "@/lib/template-v2/theme";
import { templateKeyForTemplate } from "@/lib/template-v2/keyed-template";
import { DIPLOMA_TEMPLATE_KEY, DIPLOMAS_EDITOR_BASE_PATH } from "@/lib/eventos/diploma-constantes";
import { requireActiveWorkspace } from "@/lib/workspace";
// El import registra el runtime del editor: base, sesión y almacenamiento de esta app.
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ templateId: string; versionId: string }> };

/**
 * El editor de un diploma de evento. Sólo abre diplomas: con esta ruta no se abre el carnet ni
 * una placa aunque se conozca su id. Lo usan quien gestiona Eventos y quien diseña todo.
 */
export default async function DiplomaEditorPage({ params }: Props) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const [diplomas, todas] = await Promise.all([
    canDesignDiplomas(user.id, workspace.id),
    canDesignTemplates(user.id, workspace.id),
  ]);
  if (!diplomas && !todas) redirect("/workspace");

  const { templateId, versionId } = await params;
  const { found, templateKey } = await templateKeyForTemplate(workspace.id, templateId);
  if (!found || templateKey !== DIPLOMA_TEMPLATE_KEY) redirect("/eventos");

  return (
    <TemplateEditorShell
      templateId={templateId}
      versionId={versionId}
      basePath={DIPLOMAS_EDITOR_BASE_PATH}
      theme={FOTOFFICE_EDITOR_THEME}
    />
  );
}
