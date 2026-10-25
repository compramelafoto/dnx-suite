"use client";

import { useCallback, useEffect, useState } from "react";
import { TemplateEditorShell, TEMPLATE_V2_BASE_PATHS } from "@repo/template-editor-ui";
import CambioDePlantillaDialog from "@/components/design-v2/CambioDePlantillaDialog";
import type { ResumenDeCambio } from "@/lib/design-v2/cambio-de-plantilla-tipos";

/** «(3 para revisar · 1 aprobado sin imprimir).» */
function resumenCorto(r: ResumenDeCambio): string {
  const t = r.totales;
  const partes = [
    t.pendiente ? `${t.pendiente} para revisar` : null,
    t.aprobado ? `${t.aprobado} aprobado${t.aprobado === 1 ? "" : "s"} sin imprimir` : null,
    t.produccion ? `${t.produccion} en imprenta o entregado${t.produccion === 1 ? "" : "s"} (no se tocan)` : null,
    t["editado-a-mano"] ? `${t["editado-a-mano"]} editado${t["editado-a-mano"] === 1 ? "" : "s"} a mano` : null,
    t["revision-manual"] ? `${t["revision-manual"]} para revisar a mano` : null,
  ].filter(Boolean);
  return partes.length ? `(${partes.join(" · ")}).` : "";
}

/**
 * El diseñador de plantillas de ComprameLaFoto, con lo que agrega esta app:
 *
 * - Abierto desde la revisión de un diseño (`disenoId`), se retoca sólo ese librito y «Cerrar»
 *   vuelve a la revisión.
 * - Abierto sobre una plantilla con diseños armados, avisa que los cambios van a una versión nueva
 *   y deja elegir a qué diseños aplicarlos.
 */
export default function EditorDePlantilla({
  templateId,
  versionId,
  disenoId,
}: {
  templateId: string;
  versionId: string;
  disenoId: number | null;
}) {
  const [resumen, setResumen] = useState<ResumenDeCambio | null>(null);
  const [abierto, setAbierto] = useState(false);

  const cargarResumen = useCallback(async (): Promise<ResumenDeCambio | null> => {
    if (disenoId != null) return null;
    try {
      const res = await fetch(`/api/fotografo/diseno/plantillas/${encodeURIComponent(templateId)}/cambio-de-plantilla`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) return null;
      setResumen(body as ResumenDeCambio);
      return body as ResumenDeCambio;
    } catch {
      return null;
    }
  }, [templateId, disenoId]);

  useEffect(() => {
    void cargarResumen();
  }, [cargarResumen]);

  if (disenoId != null) {
    return (
      <TemplateEditorShell
        templateId={templateId}
        versionId={versionId}
        basePath={TEMPLATE_V2_BASE_PATHS.compramelafoto}
        exitHref={`/fotografo/disenos/${disenoId}`}
        notice={
          <span>
            <strong>Estás retocando sólo el diseño de este librito.</strong> La plantilla y los demás diseños no cambian.
            Si ya estaba aprobado, vuelve a revisión. Cuando termines, tocá «Cerrar» para volver a revisarlo.
          </span>
        }
      />
    );
  }

  const ofrecibles = resumen ? resumen.totales.pendiente + resumen.totales.aprobado : 0;
  // Los que están en imprenta o se editaron a mano no esperan nada de la plantilla: no se avisa
  // por ellos (sí se listan en el detalle, para que se sepa que existen).
  const conVersionAnterior = resumen ? ofrecibles + resumen.totales["revision-manual"] : 0;

  const aviso =
    conVersionAnterior > 0 ? (
      <span className="flex flex-wrap items-center gap-2">
        <span>
          {conVersionAnterior === 1
            ? "Hay 1 diseño armado con una versión anterior de esta plantilla."
            : `Hay ${conVersionAnterior} diseños armados con versiones anteriores de esta plantilla.`}{" "}
          {resumenCorto(resumen!)}
          {ofrecibles > 0 ? " Cuando termines, elegí a cuáles aplicarles los cambios." : ""}
        </span>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="rounded-md bg-[#c27b3d] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#a8662f]"
        >
          ¿A qué diseños aplico el cambio?
        </button>
      </span>
    ) : resumen && resumen.enVersionVigente > 0 ? (
      <span>
        {resumen.enVersionVigente === 1
          ? "Hay 1 diseño armado con esta plantilla."
          : `Hay ${resumen.enVersionVigente} diseños armados con esta plantilla.`}{" "}
        Lo que cambies se guarda como una versión nueva: esos diseños no cambian hasta que elijas aplicárselo.
      </span>
    ) : null;

  return (
    <>
      <TemplateEditorShell
        templateId={templateId}
        versionId={versionId}
        basePath={TEMPLATE_V2_BASE_PATHS.compramelafoto}
        notice={aviso}
        // No se abre solo: el primer guardado suele ser automático, en medio del trabajo. El aviso
        // de arriba queda con los números y el botón para elegir cuando termine.
        onVersionForked={() => void cargarResumen()}
      />
      {abierto && resumen ? (
        <CambioDePlantillaDialog
          templateId={templateId}
          resumen={resumen}
          onClose={() => setAbierto(false)}
          onApplied={() => void cargarResumen()}
        />
      ) : null}
    </>
  );
}
