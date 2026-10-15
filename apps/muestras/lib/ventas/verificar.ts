import "server-only";
import { prisma } from "@repo/db";
import { certificateView, formatCertificateCode, normalizeCertificateCode, workAccess, workPath, type CertificateState } from "@repo/muestras";
import { esUrlWeb } from "@/lib/url";
import { verificarFirma } from "./certificado";

/**
 * La página pública de verificación (etapa 8, D19). Lo que se muestra sale del texto firmado
 * guardado en la copia, y la firma se verifica en cada pedido con la clave pública: si alguien
 * cambia un carácter en la base, la página dice que la firma no coincide. Un código que no existe
 * da siempre el mismo mensaje (nunca "existe pero…").
 */
export type Verificacion =
  | { encontrado: false }
  | {
      encontrado: true;
      estado: CertificateState;
      titulo: string;
      codigo: string;
      numero: string;
      obra: string;
      autor: string;
      formato: string | null;
      papelYMedida: string | null;
      muestra: string;
      emitido: string | null;
      comprador: string | null;
      /** La imagen, sólo si la obra se ve online (respeta la sorpresa de la etapa 6). */
      miniatura: string | null;
      enlaceObra: string | null;
      enlaceAutor: string | null;
    };

const NO = { encontrado: false } as const;

export async function verificarCodigo(crudo: string, ahora: Date = new Date()): Promise<Verificacion> {
  const codigo = normalizeCertificateCode(crudo);
  if (!codigo) return NO;
  const copia = await prisma.culturalEditionCopy.findUnique({
    where: { certificateCode: codigo },
    select: { status: true, isTest: true, voidedAt: true, issuedAt: true, certificatePayload: true, certificateSignature: true, certificateKid: true, offerId: true },
  });
  if (!copia?.certificatePayload || !copia.certificateSignature || !copia.certificateKid) return NO;
  const firmaValida = verificarFirma(copia.certificatePayload, copia.certificateSignature, copia.certificateKid);
  let d: Record<string, unknown> = {};
  try {
    d = JSON.parse(copia.certificatePayload) as Record<string, unknown>;
  } catch {
    // Un texto que no se entiende no tiene firma válida: lo dice `certificateView`.
  }
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const n = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : null);
  const numero = s("kind") === "PROOF" ? `P/A ${n("number")}/${n("size")}` : s("edition") === "UNIQUE" ? "Copia única" : `${n("number")}/${n("size")}`;
  const vista = certificateView({
    status: copia.status, isTest: copia.isTest || d.test === true, voidedAt: copia.voidedAt, signatureValid: firmaValida && s("code") === codigo,
    label: numero, workTitle: s("work"), authorName: s("author"), issuedAt: copia.issuedAt,
  });

  // La obra, para la miniatura y los enlaces: sólo si la muestra está publicada y la obra se ve online.
  let miniatura: string | null = null;
  let enlaceObra: string | null = null;
  let enlaceAutor: string | null = null;
  if (vista.state !== "INVALID_SIGNATURE") {
    const oferta = await prisma.culturalWorkOffer.findUnique({ where: { id: copia.offerId }, select: { activityId: true, activityWorkId: true } });
    const a = oferta
      ? await prisma.culturalActivity.findUnique({
          where: { id: oferta.activityId },
          select: {
            slug: true, reviewStatus: true, galleryMode: true, visibility: true, startsAt: true, endsAt: true,
            works: { select: { id: true, isHighlight: true, sortOrder: true, imageUrl: true, authorProfile: { select: { slug: true } } } },
          },
        })
      : null;
    if (a && oferta && a.reviewStatus === "APPROVED") {
      const obra = a.works.find((w) => w.id === oferta.activityWorkId);
      if (obra?.authorProfile) enlaceAutor = `/fotografos/${obra.authorProfile.slug}`;
      if (obra && workAccess(a, a.works, obra.id, ahora) === "FULL") {
        enlaceObra = workPath(a.slug, obra.id);
        if (esUrlWeb(obra.imageUrl)) miniatura = obra.imageUrl;
      }
    }
  }

  const impresa = s("format") === "PRINT";
  const medida = n("widthCm") != null && n("heightCm") != null ? `${n("widthCm")} × ${n("heightCm")} cm` : null;
  return {
    encontrado: true,
    estado: vista.state,
    titulo: vista.title,
    codigo: formatCertificateCode(codigo),
    numero,
    obra: s("work"),
    autor: s("author"),
    formato: s("format") ? (impresa ? "Copia impresa Fine Art" : "Copia digital firmada") : null,
    papelYMedida: impresa ? [s("paper") || null, medida].filter(Boolean).join(" · ") || null : null,
    muestra: s("activity"),
    emitido: s("issuedOn") || null,
    comprador: s("buyer") || null,
    miniatura,
    enlaceObra,
    enlaceAutor,
  };
}
