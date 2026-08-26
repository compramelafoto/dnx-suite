import { createHash } from "node:crypto";
import { readDesignDocument } from "../document/migrate";
import { DESIGN_SCHEMA_VERSION } from "../document/schema";
import { resolveVariables } from "../variables/resolve";
import { renderPdf } from "../render/pdf";
import { pdfToPng } from "../render/png";
import { renderSvgPages } from "../render/svg";
import { RENDERER_VERSION } from "../render/version";
import type { EmitOutcome, EmitRequest, EmittedFile } from "./contract";

export function checksumOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function archivo(name: string, contentType: string, bytes: Uint8Array): EmittedFile {
  return { name, contentType, bytes, checksum: checksumOf(bytes) };
}

/**
 * La única puerta de emisión del módulo.
 *
 * El orden importa: primero se lee el documento, después se resuelven las variables y recién
 * entonces se dibuja. Así un dato obligatorio ausente detiene la emisión **antes** de gastar
 * en incrustar fuentes o rasterizar, y el mensaje de error habla del dato, no del render.
 */
export async function emitDesign(request: EmitRequest): Promise<EmitOutcome> {
  const documento = readDesignDocument(request.document);
  if (!documento.ok) return { ok: false, errors: documento.errors };

  const resueltas = resolveVariables(request.contract, request.values);
  if (!resueltas.ok) return { ok: false, errors: resueltas.errors };

  if (request.formats.length === 0) {
    return { ok: false, errors: ["No se pidió ningún formato de salida."] };
  }

  const doc = documento.value;
  const files: EmittedFile[] = [];
  const necesitaPdf =
    request.formats.includes("PDF") || request.formats.includes("PNG_PER_SIDE");

  let pdfBytes: Uint8Array | null = null;
  if (necesitaPdf) {
    const pdf = await renderPdf(doc, resueltas.value, {
      includeBleed: request.includeBleed ?? false,
      resources: request.resources,
    });
    if (!pdf.ok) return { ok: false, errors: pdf.errors };
    pdfBytes = pdf.value;
  }

  if (request.formats.includes("PDF") && pdfBytes) {
    files.push(archivo(`${request.fileBaseName}.pdf`, "application/pdf", pdfBytes));
  }

  if (request.formats.includes("PNG_PER_SIDE") && pdfBytes) {
    const dpi = request.pngDpi ?? doc.format.dpi ?? 300;
    for (const [indice, cara] of doc.sides.entries()) {
      const png = await pdfToPng(pdfBytes, { dpi, pageIndex: indice });
      if (!png.ok) return { ok: false, errors: png.errors };
      files.push(archivo(`${request.fileBaseName}-${cara.id}.png`, "image/png", png.value));
    }
  }

  if (request.formats.includes("SVG_PER_SIDE")) {
    const svgs = await renderSvgPages(doc, resueltas.value);
    if (!svgs.ok) return { ok: false, errors: svgs.errors };
    svgs.value.forEach((svg, indice) => {
      const cara = doc.sides[indice];
      if (!cara) return;
      files.push(
        archivo(
          `${request.fileBaseName}-${cara.id}.svg`,
          "image/svg+xml",
          new TextEncoder().encode(svg),
        ),
      );
    });
  }

  return {
    ok: true,
    files,
    rendererVersion: RENDERER_VERSION,
    schemaVersion: DESIGN_SCHEMA_VERSION,
    resolvedValues: resueltas.value.values,
    omittedVariables: resueltas.value.omitted,
  };
}
