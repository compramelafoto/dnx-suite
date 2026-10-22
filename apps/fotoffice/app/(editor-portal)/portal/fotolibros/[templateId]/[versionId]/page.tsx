import { redirect } from "next/navigation";
import { ModoFotolibro } from "@/components/fotolibro/modo/modo-fotolibro";
import { requireAuth } from "@/lib/auth";
import { RUTA_FOTOLIBROS_SOCIO } from "@/lib/fotolibro/constantes";
import { accesoFotolibrosSocio, esFotolibroDelSocio } from "@/lib/fotolibro/socio";
// El import registra el runtime del editor: base, sesión y almacenamiento de esta app.
import "@/lib/template-v2/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ templateId: string; versionId: string }> };

/**
 * El Modo Fotolibro de un fotolibro del socio (el editor de siempre queda en `./libre`). Sólo abre fotolibros personales de quien mira: con esta
 * ruta no se abre ninguna plantilla de la institución, ni el fotolibro de otro socio.
 */
export default async function FotolibroSocioEditorPage({ params }: Props) {
  const user = await requireAuth();
  if (!(await accesoFotolibrosSocio(user.id))) redirect("/portal");

  const { templateId, versionId } = await params;
  if (!(await esFotolibroDelSocio(user.id, templateId))) redirect(RUTA_FOTOLIBROS_SOCIO);

  return (
    <ModoFotolibro
      templateId={templateId}
      versionId={versionId}
      salirHref={RUTA_FOTOLIBROS_SOCIO}
      libreHref={`${RUTA_FOTOLIBROS_SOCIO}/${templateId}/${versionId}/libre`}
    />
  );
}
