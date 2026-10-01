import "server-only";

import {
  deletePartnerLogo,
  extensionForPartnerLogoMime,
  getPartnerLogoStorage,
  resolvePartnerLogoStorage,
} from "@/lib/admin/partners/partner-logo-storage";
import { createProposal, type ProposalRow } from "@repo/db/partners-proposals";
import {
  detectPartnerFileMime,
  resolvePlateTreatment,
  type ProposalPlan,
} from "@repo/partners";
import { measureLogo } from "./compose";

/**
 * Guardar la propuesta que se acaba de armar.
 *
 * Dos cosas que conviene no perder de vista:
 *
 * 1. **El logo va al mismo namespace que los logos de sponsors.** No es
 *    descuido: cuando la propuesta se convierta en alta (etapa 4), el archivo ya
 *    está donde tiene que estar y no hay que volver a pedírselo a nadie.
 * 2. **Guardar no puede romper el generador.** La pantalla es pública y su
 *    trabajo es entregar el PDF. Si la tabla todavía no existe o R2 no está
 *    configurado, se devuelve el PDF igual y sin código: peor es no vender.
 */

export type PropuestaGuardada = {
  code: string;
  expiresAt: Date;
  id: string;
};

type GuardarInput = {
  plan: ProposalPlan;
  logo: Buffer;
  period: { startsAt: Date; endsAt: Date };
  contactUrl?: string | null;
  clientKeyHash?: string | null;
  createdByUserId?: number | null;
  now: Date;
};

/** Sube el logo con el mime que dicen sus bytes, no el que declaró el navegador. */
async function subirLogo(
  logo: Buffer,
): Promise<{ key: string; mime: string } | null> {
  if (resolvePartnerLogoStorage().kind === "unavailable") return null;
  const detectado = detectPartnerFileMime(logo);
  const almacenamiento = getPartnerLogoStorage();
  const guardado = await almacenamiento.put({
    extension: extensionForPartnerLogoMime(detectado.mime),
    body: logo,
    contentType: detectado.mime,
  });
  return { key: guardado.key, mime: detectado.mime };
}

/**
 * Lo medido del logo, para no tener que volver a mirarlo.
 *
 * Se guarda con la propuesta para poder mostrar en el panel por qué se eligió
 * placa clara u oscura sin abrir el archivo.
 */
async function medirLogo(logo: Buffer, mime: string | null) {
  try {
    const medida = await measureLogo(logo);
    const placa = resolvePlateTreatment(medida);
    return {
      mime,
      bytes: logo.length,
      meanLuminance: medida.meanLuminance,
      hasAlpha: medida.hasAlpha,
      plate: placa.plate,
    };
  } catch {
    return { mime, bytes: logo.length };
  }
}

/**
 * Guarda la propuesta y devuelve su código, o `null` si no se pudo guardar.
 *
 * Nunca lanza: quien llama tiene que poder entregar el PDF igual.
 */
export async function guardarPropuesta(
  input: GuardarInput,
): Promise<PropuestaGuardada | null> {
  let subido: { key: string; mime: string } | null = null;
  try {
    subido = await subirLogo(input.logo);

    const fila: ProposalRow = await createProposal({
      brandName: input.plan.brandName,
      industry: input.plan.industry,
      contactUrl: input.contactUrl ?? null,
      period: input.period,
      logoStorageKey: subido?.key ?? null,
      logoMeta: await medirLogo(input.logo, subido?.mime ?? null),
      clientKeyHash: input.clientKeyHash ?? null,
      createdByUserId: input.createdByUserId ?? null,
      now: input.now,
      items: input.plan.lines.map((linea) => ({
        kind: linea.kind,
        pieceId: linea.pieceId,
        placementKey: linea.placementKey,
        label: linea.label,
        location: linea.location,
        quantity: linea.quantity,
        unitPriceMinor: linea.unitPriceMinor,
        currency: linea.currency,
        selection: linea.selection,
        sortOrder: linea.sortOrder,
      })),
    });

    return { code: fila.code, expiresAt: fila.expiresAt, id: fila.id };
  } catch (err) {
    // El logo ya subido sin fila que lo referencie es basura que nadie va a
    // borrar: el barrido diario solo mira las filas.
    if (subido) await deletePartnerLogo(subido.key).catch(() => undefined);
    console.warn("[propuesta] no se pudo guardar; se entrega el PDF sin código", err);
    return null;
  }
}

/** Trae el logo guardado de una propuesta. `null` si ya no está. */
export async function leerLogoGuardado(key: string | null): Promise<Buffer | null> {
  if (!key) return null;
  try {
    return await getPartnerLogoStorage().get(key);
  } catch (err) {
    console.warn("[propuesta] el logo guardado ya no está", err);
    return null;
  }
}
