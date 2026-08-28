import "server-only";
import { prisma } from "@repo/db";
import { emitDesign, type ResourceResolver } from "@repo/design-studio";
import { CARNET_VARIABLE_CONTRACT, carnetDesignDocument } from "./template";
import { findCarnetTemplate } from "./template-store";
import { openCardToken } from "./token-vault";

/**
 * Genera los archivos de una tarjeta impresa.
 *
 * El PDF sale con sangrado, listo para imprenta. Se genera **a pedido** y no al crear el
 * carnet: la plantilla puede cambiar entre que el socio pide la tarjeta y alguien la imprime,
 * y lo que importa es que salga con la versión vigente al momento de imprimir.
 */

export type RenderedCard = {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  checksum: string;
};

export type RenderCardResult =
  | { ok: true; files: RenderedCard[]; rendererVersion: string; schemaVersion: number }
  | { ok: false; errors: string[] };

/**
 * Resuelve la foto del socio.
 *
 * Las fotos viven en R2 con URL pública. Se descargan acá en vez de pasarle la URL al módulo
 * de diseño porque ese módulo no sabe de red a propósito: recibe bytes.
 */
function resourceResolver(): ResourceResolver {
  return {
    async read(ref: string): Promise<Uint8Array | null> {
      if (!/^https?:\/\//.test(ref)) return null;
      try {
        const respuesta = await fetch(ref);
        if (!respuesta.ok) return null;
        return new Uint8Array(await respuesta.arrayBuffer());
      } catch {
        return null;
      }
    },
  };
}

export async function renderPrintedCard(input: {
  workspaceId: string;
  cardId: string;
  baseUrl: string;
}): Promise<RenderCardResult> {
  const card = await prisma.memberCard.findFirst({
    where: { id: input.cardId, workspaceId: input.workspaceId, format: "PRINTED" },
    select: {
      cardNumber: true,
      validUntil: true,
      tokenCiphertext: true,
      tokenNonce: true,
      tokenAuthTag: true,
      member: {
        select: {
          firstName: true,
          lastName: true,
          memberNumber: true,
          avatarUrl: true,
          documentNumber: true,
          joinedAt: true,
          email: true,
          phone: true,
          city: true,
          category: { select: { name: true } },
        },
      },
      workspace: { select: { id: true, name: true } },
    },
  });
  if (!card) return { ok: false, errors: ["No encontramos esa tarjeta."] };

  const token = openCardToken({
    ciphertext: card.tokenCiphertext ?? undefined,
    nonce: card.tokenNonce ?? undefined,
    authTag: card.tokenAuthTag ?? undefined,
  });
  if (!token) {
    return {
      ok: false,
      errors: ["No pudimos leer el código de verificación de esta tarjeta. Emitila de nuevo."],
    };
  }

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: card.workspace.id },
    select: { commercialName: true, logoUrl: true },
  });

  // La institución puede haber editado su carnet en el módulo de diseño. Si todavía no lo
  // hizo, se usa el diseño de fábrica: nadie se queda sin poder imprimir por no haber pasado
  // por el editor.
  const plantilla = await findCarnetTemplate(card.workspace.id);

  /*
   * Un QR de dirección fija no sale de ningún dato del socio: el puente le inventa una
   * variable y entrega su valor. Se suman acá, al contrato y a los valores, porque la
   * emisión rechaza cualquier marcador que el contrato no declare.
   */
  const sinteticas = plantilla?.variablesSinteticas ?? [];
  const contract = sinteticas.length
    ? {
        variables: [
          ...CARNET_VARIABLE_CONTRACT.variables,
          ...sinteticas.map((v) => ({
            key: v.key,
            type: "qrPayload" as const,
            label: v.label,
            required: true,
            sampleValue: v.value,
          })),
        ],
      }
    : CARNET_VARIABLE_CONTRACT;

  const salida = await emitDesign({
    document: plantilla?.document ?? carnetDesignDocument(),
    contract,
    values: {
      institutionName: branding?.commercialName?.trim() || card.workspace.name,
      fullName: `${card.member.firstName} ${card.member.lastName}`.trim(),
      memberNumber: Number(card.member.memberNumber) || 0,
      cardNumber: card.cardNumber,
      category: card.member.category?.name ?? null,
      validUntil: card.validUntil,
      photo: card.member.avatarUrl,
      verificationUrl: `${input.baseUrl.replace(/\/+$/, "")}/c/${token}`,
      // Las que existen para quien diseña su propia plantilla. El diseño de fábrica no las
      // usa; si alguien las arrastra al lienzo, tienen que tener valor.
      firstName: card.member.firstName,
      lastName: card.member.lastName,
      documentNumber: card.member.documentNumber,
      joinedAt: card.member.joinedAt,
      email: card.member.email,
      phone: card.member.phone,
      city: card.member.city,
      institutionLogo: branding?.logoUrl ?? null,
      ...Object.fromEntries(sinteticas.map((v) => [v.key, v.value])),
    },
    // Solo PDF, a propósito. El PNG del módulo se obtiene rasterizando el PDF con un binario
    // nativo (@napi-rs/canvas), que es específico de plataforma: al construir en Mac se
    // rastrearía el binario de Mac y en Vercel no existiría. La imprenta necesita el PDF, y
    // la vista en pantalla ya la resuelve el carnet digital, así que no hace falta pagar ese
    // riesgo. El día que haga falta el PNG, se genera donde corre, no en el build.
    formats: ["PDF"],
    includeBleed: true,
    resources: resourceResolver(),
    fileBaseName: `carnet-${card.cardNumber}`,
  });

  if (!salida.ok) return { ok: false, errors: salida.errors };

  // Se registra con qué se dibujó, para poder reproducir la pieza tal como salió. Incluye la
  // versión de la plantilla: si mañana alguien la edita, esta tarjeta sigue sabiendo con cuál
  // se imprimió.
  await prisma.memberCard.update({
    where: { id: input.cardId },
    data: {
      designTemplateVersionId: plantilla?.versionId ?? null,
      rendererVersion: salida.rendererVersion,
      designSchemaVersion: salida.schemaVersion,
      files: salida.files.map((f) => ({
        name: f.name,
        contentType: f.contentType,
        checksum: f.checksum,
        bytes: f.bytes.byteLength,
      })),
    },
  });

  return {
    ok: true,
    files: salida.files.map((f) => ({
      fileName: f.name,
      contentType: f.contentType,
      bytes: f.bytes,
      checksum: f.checksum,
    })),
    rendererVersion: salida.rendererVersion,
    schemaVersion: salida.schemaVersion,
  };
}
