import { readDesignDocument, renderSvgPages, resolveVariables } from "@repo/design-studio";
import { editorADocumento, type EditorBlock, type EditorCanvas } from "../design-studio-bridge";
import { buildContractForProduct } from "../design-studio-contract";
import { createExampleDataForProduct } from "../resolve-template-product";
import type { TemplateProductId } from "../resolve-template-product";

/**
 * Vista previa sin navegador.
 *
 * La anterior levantaba un navegador headless para sacarle una foto a la página. Anda en una
 * computadora y no en el servidor de producción, donde ese binario no existe: la vista previa
 * respondía "playwright-core no disponible en este runtime" y no se podía ver ningún diseño.
 *
 * Esta dibuja con el mismo motor que produce el PDF que va a la imprenta, que ya funciona en
 * producción desde que se emite el primer carnet. Además de andar, es más fiel: usa el mismo
 * medidor de texto, así que los cortes de línea son los del archivo impreso y no una
 * aproximación del navegador.
 */

export type PreviewSvgResult =
  | { ok: true; pages: string[]; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * El renderizador marca cada imagen con `data-resource-ref` y deja que quien lo use decida cómo
 * resolverla: para el PDF hay que descargar los bytes e incrustarlos, porque el archivo tiene
 * que ser autónomo. En la vista previa no hace falta — el SVG se muestra dentro del navegador de
 * quien diseña, que puede cargar la imagen por su cuenta. Alcanza con darle el `href`.
 *
 * Solo se convierten `http(s)` y datos de imagen de mapa de bits. Un `data:image/svg+xml` queda
 * fuera a propósito: el contenido lo escribe quien diseña, y un SVG es un documento con todo lo
 * que eso implica. Cualquier otra referencia se deja marcada y sin cargar.
 */
function conImagenesVisibles(svg: string): string {
  return svg.replace(
    /data-resource-ref="((?:https?:\/\/|data:image\/(?:png|jpeg|jpg|webp|gif);)[^"]*)"/g,
    (_todo, ref: string) => `href="${ref}" data-resource-ref="${ref}"`,
  );
}

export async function renderPreviewSvg(input: {
  canvas: EditorCanvas;
  blocks: readonly EditorBlock[];
  product: TemplateProductId | "unknown";
  name?: string;
}): Promise<PreviewSvgResult> {
  const puente = editorADocumento({
    canvas: input.canvas,
    blocks: input.blocks,
    nombre: input.name,
  });

  const leido = readDesignDocument(puente.document);
  if (!leido.ok) {
    return { ok: false, errors: leido.errors };
  }

  const contrato = buildContractForProduct(input.product);
  /*
   * Los QR de dirección fija no salen de ningún dato: el puente les inventa una variable y
   * entrega su valor. Sin sumarlas acá, la emisión las rechaza por no estar declaradas.
   */
  const contratoCompleto = {
    variables: [
      ...contrato.variables,
      ...puente.variablesSinteticas.map((v) => ({
        key: v.key,
        type: "qrPayload" as const,
        label: v.label,
        required: false,
        sampleValue: v.value,
      })),
    ],
  };

  const valores = {
    ...createExampleDataForProduct(input.product),
    ...Object.fromEntries(puente.variablesSinteticas.map((v) => [v.key, v.value])),
  };

  const resueltas = resolveVariables(contratoCompleto, valores as never);
  if (!resueltas.ok) {
    return { ok: false, errors: resueltas.errors ?? ["No se pudieron resolver las variables"] };
  }

  const svg = await renderSvgPages(leido.value, resueltas.value);
  if (!svg.ok) {
    return { ok: false, errors: svg.errors };
  }

  return {
    ok: true,
    pages: svg.value.map(conImagenesVisibles),
    warnings: puente.avisos,
  };
}
