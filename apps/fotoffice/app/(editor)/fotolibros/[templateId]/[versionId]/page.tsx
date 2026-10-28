import { redirect } from "next/navigation";
import { ModoFotolibro } from "@/components/fotolibro/modo/modo-fotolibro";
import { canDesignTemplates } from "@/lib/template-v2/access";
import { canDesignFotolibros } from "@/lib/fotolibro/acceso";
import { FOTOLIBRO_TEMPLATE_KEY, FOTOLIBROS_BASE_PATH } from "@/lib/fotolibro/constantes";
import { templateKeyForTemplate } from "@/lib/template-v2/keyed-template";
import { requireActiveWorkspace } from "@/lib/workspace";
// El import registra el runtime del editor: base, sesión y almacenamiento de esta app.
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ templateId: string; versionId: string }> };

/**
 * El Modo Fotolibro de un fotolibro del estudio: la pantalla para armarlo pliego por pliego.
 * El editor de siempre queda en `./libre`, para textos y ajustes a mano.
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
    <ModoFotolibro
      templateId={templateId}
      versionId={versionId}
      salirHref={FOTOLIBROS_BASE_PATH}
      libreHref={`${FOTOLIBROS_BASE_PATH}/${templateId}/${versionId}/libre`}
    />
  );
}
