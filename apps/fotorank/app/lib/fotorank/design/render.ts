import "server-only";
import {
  emitDesign,
  type ResourceResolver,
  type VariableContract,
} from "@repo/design-studio";
import { buildContractForProduct } from "@repo/template-editor-core/rendering";
import { DESIGN_DPI } from "./constants";
import { prepararImagen } from "./images";
import { pruneEmptyBlocks } from "./prune";
import type { LoadedDesign } from "./templates";

/**
 * Dibuja una pieza de FotoRank (diploma o imagen de ganador) con el motor compartido
 * `@repo/design-studio`: PDF con `pdf-lib` y PNG con `mupdf` (WebAssembly). Sin navegador, así
 * que corre en Vercel igual que las placas de FOTOFFICE y de Clickatón.
 */

export type DesignValues = {
  recipientName?: string | null;
  entryTitle?: string | null;
  /** Referencia de imagen: `fotorank-entry:<id>`, una URL o un `data:`. */
  entryImage?: string | null;
  prizeLabel?: string | null;
  categoryName?: string | null;
  contestTitle?: string | null;
  organizerName?: string | null;
  organizerLogo?: string | null;
  /** AAAA-MM-DD. */
  issuedDate?: string | null;
  diplomaCode?: string | null;
  verificationUrl?: string | null;
};

/**
 * El contrato de FotoRank: todas las variables del catálogo del diseñador, **todas opcionales**.
 * Una imagen de ganador no tiene código de diploma, y un diploma de colaborador no tiene obra:
 * lo que falta no se dibuja (ver `pruneEmptyBlocks`) en vez de frenar la pieza.
 */
function contrato(sinteticas: LoadedDesign["variablesSinteticas"]): VariableContract {
  const base = buildContractForProduct("fotorank").variables.map((v) =>
    // En un diploma la fecha va con el mes escrito: "20 de noviembre de 2026".
    v.key === "issuedDate" ? { ...v, dateFormat: "es-AR-long" as const } : v,
  );
  return {
    variables: [
      ...base,
      ...sinteticas.map((s) => ({
        key: s.key,
        type: "qrPayload" as const,
        label: s.label,
        required: true,
        sampleValue: s.value,
      })),
    ],
  };
}

function resolvedor(cache: Map<string, Uint8Array>): ResourceResolver {
  return {
    async read(ref: string) {
      const enCache = cache.get(ref);
      if (enCache) return enCache;
      // Imágenes fijas del diseño (un fondo subido en el editor): se preparan al pedirlas.
      const lista = await prepararImagen(ref);
      if (lista) cache.set(ref, lista);
      return lista;
    },
  };
}

export type RenderedDesign =
  | { ok: true; pdf: Uint8Array | null; png: Uint8Array | null }
  | { ok: false; errors: string[] };

export async function renderDesign(input: {
  design: LoadedDesign;
  values: DesignValues;
  formats: Array<"PDF" | "PNG">;
  fileBaseName: string;
  /** Resolución del PNG. Por omisión, la del diseño (1080 px de lienzo = 1080 px de PNG). */
  pngDpi?: number;
}): Promise<RenderedDesign> {
  const valores: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input.values)) {
    valores[k] = typeof v === "string" && v.trim() === "" ? null : (v ?? null);
  }
  for (const s of input.design.variablesSinteticas) valores[s.key] = s.value;

  // Las imágenes que vienen de datos se preparan antes: si no se pueden leer, se tratan como
  // ausentes y su bloque se poda, en vez de tumbar la pieza entera.
  const cache = new Map<string, Uint8Array>();
  for (const clave of ["entryImage", "organizerLogo"]) {
    const ref = valores[clave];
    if (typeof ref !== "string") continue;
    const lista = cache.get(ref) ?? (await prepararImagen(ref));
    if (lista) cache.set(ref, lista);
    else valores[clave] = null;
  }

  const { document } = pruneEmptyBlocks(input.design.document, valores);
  const salida = await emitDesign({
    document,
    contract: contrato(input.design.variablesSinteticas),
    values: valores as Record<string, string | number | Date | null>,
    formats: [
      ...(input.formats.includes("PDF") ? (["PDF"] as const) : []),
      ...(input.formats.includes("PNG") ? (["PNG_PER_SIDE"] as const) : []),
    ],
    pngDpi: input.pngDpi ?? DESIGN_DPI,
    includeBleed: false,
    resources: resolvedor(cache),
    fileBaseName: input.fileBaseName,
  });
  if (!salida.ok) return { ok: false, errors: salida.errors };

  // Una pieza es una sola cara: si alguien agregó otra página en el editor, el PNG es la primera.
  const pdf = salida.files.find((f) => f.contentType === "application/pdf")?.bytes ?? null;
  const png = salida.files.find((f) => f.contentType === "image/png")?.bytes ?? null;
  return { ok: true, pdf, png };
}

export function slugArchivo(texto: string, porDefecto = "pieza"): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || porDefecto
  );
}
