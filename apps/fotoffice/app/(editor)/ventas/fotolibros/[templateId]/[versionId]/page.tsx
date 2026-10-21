import { redirect } from "next/navigation";
import { TemplateEditorShell } from "@repo/template-editor-ui";
import { canDesignTemplates } from "@/lib/template-v2/access";
import { canDesignFotolibros } from "@/lib/fotolibro/acceso";
import { FOTOLIBRO_TEMPLATE_KEY, FOTOLIBROS_BASE_PATH } from "@/lib/fotolibro/constantes";
import { FOTOFFICE_EDITOR_THEME } from "@/lib/template-v2/theme";
import { templateKeyForTemplate } from "@/lib/template-v2/keyed-template";
import { requireActiveWorkspace } from "@/lib/workspace";
// El import registra el runtime del editor: base, sesión y almacenamiento de esta app.
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ templateId: string; versionId: string }> };

/**
 * El editor de un fotolibro del estudio.
 *
 * Sólo abre fotolibros: con esta ruta no se puede abrir el carnet aunque se conozca su id.
 */
export default async function FotolibroEditorPage({ params }: Props) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const [fotolibros, todas] = await Promise.all([
    canDesignFotolibros(user.id, workspace.id),
    canDesignTemplates(user.id, workspace.id),
  ]);
  if (!fotolibros && !todas) redirect("/workspace");

  const { templateId, versionId } = await params;
  const { found, templateKey } = await templateKeyForTemplate(workspace.id, templateId);
  if (!found || templateKey !== FOTOLIBRO_TEMPLATE_KEY) redirect(FOTOLIBROS_BASE_PATH);

  return (
    <TemplateEditorShell
      templateId={templateId}
      versionId={versionId}
      basePath={FOTOLIBROS_BASE_PATH}
      theme={FOTOFFICE_EDITOR_THEME}
    />
  );
}
