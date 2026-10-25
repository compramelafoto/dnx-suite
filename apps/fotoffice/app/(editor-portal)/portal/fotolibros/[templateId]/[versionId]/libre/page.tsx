import { redirect } from "next/navigation";
import { TemplateEditorShell } from "@repo/template-editor-ui";
import { requireAuth } from "@/lib/auth";
import { RUTA_FOTOLIBROS_SOCIO } from "@/lib/fotolibro/constantes";
import { accesoFotolibrosSocio, esFotolibroDelSocio } from "@/lib/fotolibro/socio";
import { FOTOFFICE_EDITOR_THEME } from "@/lib/template-v2/theme";
// El import registra el runtime del editor: base, sesión y almacenamiento de esta app.
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ templateId: string; versionId: string }> };

/**
 * Diseño libre del fotolibro: el editor de siempre, para agregar textos, formas o mover algo a
 * mano. Las fotos las sigue acomodando el Modo Fotolibro (la página de al lado).
 *
 * El editor de un fotolibro del socio. Sólo abre fotolibros personales de quien mira: con esta
 * ruta no se abre ninguna plantilla de la institución, ni el fotolibro de otro socio.
 */
export default async function FotolibroSocioDisenoLibrePage({ params }: Props) {
  const user = await requireAuth();
  if (!(await accesoFotolibrosSocio(user.id))) redirect("/portal");

  const { templateId, versionId } = await params;
  if (!(await esFotolibroDelSocio(user.id, templateId))) redirect(RUTA_FOTOLIBROS_SOCIO);

  return (
    <TemplateEditorShell
      templateId={templateId}
      versionId={versionId}
      basePath={RUTA_FOTOLIBROS_SOCIO}
      theme={FOTOFFICE_EDITOR_THEME}
    />
  );
}
