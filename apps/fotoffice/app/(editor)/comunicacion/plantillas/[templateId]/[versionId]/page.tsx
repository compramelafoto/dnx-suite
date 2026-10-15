import { redirect } from "next/navigation";
import { TemplateEditorShell } from "@repo/template-editor-ui";
import { canDesignPlacas, canDesignTemplates } from "@/lib/template-v2/access";
import { FOTOFFICE_EDITOR_THEME } from "@/lib/template-v2/theme";
import { templateKeyForTemplate } from "@/lib/template-v2/keyed-template";
import { isPlacaTemplateKey } from "@/lib/placas/constants";
import { PLACAS_EDITOR_BASE_PATH } from "@/lib/placas/editor-path";
import { requireActiveWorkspace } from "@/lib/workspace";
// El import registra el runtime del editor: base, sesión y almacenamiento de esta app.
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ templateId: string; versionId: string }> };

/**
 * El editor de una plantilla de placa.
 *
 * Sólo abre placas: con esta ruta no se puede abrir el carnet aunque se conozca su id. Lo pueden
 * usar quien gestiona Comunicación y quien gestiona Socios (que ya diseña todas las plantillas).
 */
export default async function PlacaEditorPage({ params }: Props) {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const [placas, todas] = await Promise.all([
    canDesignPlacas(user.id, workspace.id),
    canDesignTemplates(user.id, workspace.id),
  ]);
  if (!placas && !todas) redirect("/workspace");

  const { templateId, versionId } = await params;
  const { found, templateKey } = await templateKeyForTemplate(workspace.id, templateId);
  if (!found || !isPlacaTemplateKey(templateKey)) redirect(PLACAS_EDITOR_BASE_PATH);

  return (
    <TemplateEditorShell
      templateId={templateId}
      versionId={versionId}
      basePath={PLACAS_EDITOR_BASE_PATH}
      theme={FOTOFFICE_EDITOR_THEME}
    />
  );
}
