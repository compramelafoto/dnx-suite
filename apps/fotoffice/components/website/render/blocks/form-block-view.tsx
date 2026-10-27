import type { FormBlockConfig } from "@/lib/website/blocks";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";
import { configPublicaDelFormulario, contenidoRevelado, enlaceSeguroDelFormulario } from "@/lib/website/formularios";
import { FormBlockClient } from "./form-block-client";

/**
 * Formulario propio (bloque FORM). Este envoltorio NO es de cliente a propósito: en el sitio
 * público corre en el servidor y le pasa al componente de cliente la config SIN el contenido
 * oculto (`configPublicaDelFormulario`), así que «Mirá los videos acá» no está en el HTML ni en
 * los datos de la página: lo devuelve `submitSiteForm` después de un envío válido.
 *
 * En la vista previa del constructor (`data` es `undefined`) el formulario se ve deshabilitado y,
 * si el bloque revela contenido, se muestra abajo cómo se va a ver.
 */
export function FormBlockView({ config, blockId, data }: { config: FormBlockConfig; blockId?: string; data?: WebsiteDynamicData }) {
  const preview = data === undefined;
  if (data !== undefined && !data.formularios) return null;

  const redirectHref = config.afterSubmit === "redirect" ? enlaceSeguroDelFormulario(config.redirectUrl, data?.paginasDelSitio) : null;
  return (
    <FormBlockClient
      config={configPublicaDelFormulario(config)}
      blockId={blockId ?? ""}
      workspaceSlug={data?.formularios?.workspaceSlug ?? ""}
      preview={preview}
      redirectHref={redirectHref}
      ocultoDeMuestra={preview ? contenidoRevelado(config) : null}
    />
  );
}
