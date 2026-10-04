import "server-only";
import { prisma } from "@repo/db";
import {
  emitDesign,
  type ResourceResolver,
  type VariableContract,
  type VariableDeclaration,
} from "@repo/design-studio";
import { CARNET_VARIABLE_CONTRACT } from "@/lib/carnet/template";
import { loadKeyedTemplate } from "@/lib/template-v2/keyed-template";
import {
  PLACA_FORMAT_PX,
  PLACA_DPI,
  PLACA_KIND_LABEL,
  placaTemplateKey,
  type PlacaFormat,
  type PlacaKind,
} from "./constants";
import { placaDesignDocument } from "./designs";
import { pruneEmptyBlocks } from "./prune";
import { placaValues, type PlacaExtras } from "./values";
import { prepararImagen, type ImagenLista } from "./images";

/**
 * Dibuja una placa de Comunicación como PNG.
 *
 * Se genera **a pedido**, cada vez que alguien la abre o la descarga, y no se guarda: si el socio
 * cambia su foto o Comunicación retoca la plantilla, la placa sale con lo vigente. Es el mismo
 * motor del carnet (`@repo/design-studio`), que dibuja un PDF y lo rasteriza con `mupdf` —sin
 * navegador—, como las placas de participante de Clickatón.
 */

/**
 * El contrato de una placa: todo lo que el catálogo del diseñador ofrece, **todo opcional**.
 *
 * Incluye las variables del carnet porque el catálogo es uno solo y alguien puede arrastrar
 * "Número de credencial" a una placa: la emisión rechaza cualquier marcador no declarado. Las que
 * en el carnet son obligatorias (la foto, el QR) acá no lo son: una placa nunca deja de salir
 * porque falte un dato.
 */
const PLACA_CONTRACT: VariableContract = {
  variables: CARNET_VARIABLE_CONTRACT.variables.map(
    (v): VariableDeclaration => ({ ...v, required: false }),
  ),
};

/**
 * Prepara de antemano las imágenes que vienen de datos del socio.
 *
 * Una foto que no se puede leer (borrada del almacenamiento, formato roto) se trata como
 * ausente, y su bloque se poda. Si se la dejara llegar al módulo de diseño, la placa entera
 * fallaría por una foto destacada.
 */
async function prepararImagenesDeDatos(
  values: Record<string, unknown>,
): Promise<Map<string, ImagenLista>> {
  const claves = PLACA_CONTRACT.variables.filter((v) => v.type === "image").map((v) => v.key);
  const listas = new Map<string, ImagenLista>();
  await Promise.all(
    claves.map(async (clave) => {
      const ref = values[clave];
      if (typeof ref !== "string" || ref.trim() === "") return;
      if (listas.has(ref)) return;
      const lista = await prepararImagen(ref);
      if (lista) listas.set(ref, lista);
      else values[clave] = null;
    }),
  );
  return listas;
}

function resolvedor(cache: Map<string, ImagenLista>): ResourceResolver {
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

export type RenderPlacaResult =
  | { ok: true; png: Uint8Array; fileName: string; fromTemplate: boolean }
  | { ok: false; errors: string[] };

export async function renderPlaca(input: {
  workspaceId: string;
  memberId: string;
  kind: PlacaKind;
  format: PlacaFormat;
  extras?: PlacaExtras;
}): Promise<RenderPlacaResult> {
  const socio = await prisma.member.findFirst({
    where: { id: input.memberId, workspaceId: input.workspaceId },
    select: {
      firstName: true,
      lastName: true,
      memberNumber: true,
      joinedAt: true,
      avatarUrl: true,
      profilePhotoUrl: true,
      city: true,
      province: true,
      studioCity: true,
      studioProvince: true,
      specialties: true,
      instagram: true,
      workspace: { select: { name: true } },
    },
  });
  if (!socio) return { ok: false, errors: ["No encontramos a ese socio en esta institución."] };

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: input.workspaceId },
    select: { commercialName: true, logoUrl: true },
  });

  const plantilla = await loadKeyedTemplate({
    workspaceId: input.workspaceId,
    templateKey: placaTemplateKey(input.kind, input.format),
    documentName: PLACA_KIND_LABEL[input.kind],
    fallbackCanvas: PLACA_FORMAT_PX[input.format],
  });

  const values: Record<string, unknown> = placaValues({
    member: socio,
    institution: {
      name: branding?.commercialName?.trim() || socio.workspace.name,
      logoUrl: branding?.logoUrl ?? null,
    },
    extras: input.extras,
  });

  // Un QR de dirección fija no sale de ningún dato del socio: el puente le inventa una variable.
  const sinteticas = plantilla?.variablesSinteticas ?? [];
  for (const v of sinteticas) values[v.key] = v.value;
  const contract: VariableContract = sinteticas.length
    ? {
        variables: [
          ...PLACA_CONTRACT.variables,
          ...sinteticas.map((v) => ({
            key: v.key,
            type: "qrPayload" as const,
            label: v.label,
            required: true,
            sampleValue: v.value,
          })),
        ],
      }
    : PLACA_CONTRACT;

  const imagenes = await prepararImagenesDeDatos(values);
  const { document } = pruneEmptyBlocks(
    plantilla?.document ?? placaDesignDocument(input.kind, input.format),
    values,
  );

  const nombreArchivo = `${input.kind}-${input.format}-${slug(`${socio.firstName} ${socio.lastName}`)}`;
  const salida = await emitDesign({
    document,
    contract,
    values: values as Record<string, string | number | Date | null>,
    formats: ["PNG_PER_SIDE"],
    pngDpi: PLACA_DPI,
    includeBleed: false,
    resources: resolvedor(imagenes),
    fileBaseName: nombreArchivo,
  });
  if (!salida.ok) return { ok: false, errors: salida.errors };

  // Una placa es una sola imagen: si alguien agregó una segunda página en el editor, va la primera.
  const png = salida.files.find((f) => f.contentType === "image/png");
  if (!png) return { ok: false, errors: ["El diseño no produjo ninguna imagen."] };

  return {
    ok: true,
    png: png.bytes,
    fileName: `${nombreArchivo}.png`,
    fromTemplate: plantilla !== null,
  };
}

function slug(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "socio"
  );
}
