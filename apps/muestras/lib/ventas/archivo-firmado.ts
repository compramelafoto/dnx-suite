import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@repo/db";
import { editionLabel, xmpPacket } from "@repo/muestras";
import { urlDeVerificacion } from "./certificado";
import { leerPrivado, subirPrivado } from "./r2-privado";

/**
 * La copia digital firmada (etapa 8, D20): el original pasado a JPEG calidad 95, en su tamaño, con
 * un paquete XMP (`dc:title`, `dc:creator`, derechos, la dirección de verificación y el bloque `mf:`
 * con código, número, huella del original, `kid` y firma). Se arma la primera vez y se guarda en
 * `ventas/<orderId>/<código>.jpg`; después se lee de ahí. El original nunca sale del bucket privado.
 */
export type ArchivoFirmado = { bytes: Buffer; nombre: string };

const ORIGINAL_MAX = 100 * 1024 * 1024;
/** El mismo tope que al confirmar el original: 400 MP (una imagen más grande no se decodifica). */
const ORIGINAL_MAX_PIXELES = 400_000_000;

/** Arma el JPEG con XMP (sin base ni bucket). */
export async function jpegConXmp(original: Buffer, xmp: string): Promise<Buffer> {
  return sharp(original, { limitInputPixels: ORIGINAL_MAX_PIXELES })
    .rotate()
    .withXmp(xmp)
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

const nombreDeArchivo = (titulo: string, codigo: string) => {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "obra";
  return `${base}-${codigo}.jpg`;
};

/** El archivo firmado de un pedido pagado con copia certificada, o `null` si todavía no corresponde. */
export async function archivoFirmado(orderId: string): Promise<ArchivoFirmado | null> {
  const pedido = await prisma.culturalSaleOrder.findUnique({ where: { id: orderId }, select: { id: true, status: true, copyId: true, offerId: true } });
  if (!pedido || pedido.status !== "PAID" || !pedido.copyId) return null;
  const copia = await prisma.culturalEditionCopy.findUnique({
    where: { id: pedido.copyId },
    select: { status: true, kind: true, number: true, certificateCode: true, certificateKid: true, certificateSignature: true },
  });
  if (!copia || copia.status !== "ISSUED" || !copia.certificateCode || !copia.certificateKid || !copia.certificateSignature) return null;
  const oferta = await prisma.culturalWorkOffer.findUnique({
    where: { id: pedido.offerId },
    select: { activityWorkId: true, editionKind: true, editionSize: true, proofCount: true },
  });
  if (!oferta) return null;
  const [obra, original] = await Promise.all([
    prisma.culturalActivityWork.findUnique({ where: { id: oferta.activityWorkId }, select: { title: true, authorName: true } }),
    prisma.culturalSaleFile.findUnique({ where: { activityWorkId: oferta.activityWorkId }, select: { storageKey: true, sha256: true, status: true } }),
  ]);
  if (!obra || !original || original.status !== "READY" || !original.sha256) return null;

  const nombre = nombreDeArchivo(obra.title, copia.certificateCode);
  const clave = `ventas/${pedido.id}/${copia.certificateCode}.jpg`;
  const guardado = await leerPrivado(clave, { maxBytes: ORIGINAL_MAX });
  if (guardado) return { bytes: guardado, nombre };

  const bytesOriginal = await leerPrivado(original.storageKey, { maxBytes: ORIGINAL_MAX });
  if (!bytesOriginal) return null;
  // El archivo tiene que ser el mismo que se midió al confirmarlo (la huella está en el certificado):
  // si alguien lo reemplazó en el bucket después, no se entrega.
  if (createHash("sha256").update(bytesOriginal).digest("hex") !== original.sha256) {
    console.error("[muestras][ventas] el original no coincide con su huella: no se arma la copia digital");
    return null;
  }
  const xmp = xmpPacket({
    title: obra.title,
    creator: obra.authorName,
    rights: `© ${obra.authorName}. Todos los derechos reservados. Copia ${editionLabel({ kind: copia.kind, number: copia.number, size: oferta.editionSize, editionKind: oferta.editionKind, proofCount: oferta.proofCount })} con certificado ${copia.certificateCode}.`,
    webStatement: urlDeVerificacion(copia.certificateCode),
    code: copia.certificateCode,
    edition: editionLabel({ kind: copia.kind, number: copia.number, size: oferta.editionSize, editionKind: oferta.editionKind, proofCount: oferta.proofCount }),
    originalSha256: original.sha256,
    kid: copia.certificateKid,
    signature: copia.certificateSignature,
  });
  const bytes = await jpegConXmp(bytesOriginal, xmp);
  await subirPrivado(clave, bytes, "image/jpeg");
  return { bytes, nombre };
}
