import "server-only";
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { PDFDocument, degrees, rgb, type PDFPage } from "pdf-lib";
import { prisma } from "@repo/db";
import { formatArDayLong, formatCertificateCode } from "@repo/muestras";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { GRIS, LINEA, MM, TINTA, bloque, bloqueCentrado, cargarFuentes, dibujarQr, prepararDocumento } from "@/lib/piezas/dibujo";
import { credencialesDeVentas } from "./config";
import { leerPrivado, subirPrivado } from "./r2-privado";

/**
 * Certificados de autenticidad (etapa 8, D18–D20): la firma Ed25519 de DNX sobre el texto canónico
 * (`certificatePayload`), el PDF del certificado con la firma escaneada del autor y el QR a la
 * página de verificación, y la etiqueta de 10 × 6 cm para el dorso de la impresión. Los PDF se
 * generan la primera vez y se guardan en el bucket privado.
 */
export class FaltaLaClaveDelCertificado extends Error {
  constructor() {
    super("Falta MUESTRAS_CERT_PRIVATE_KEY o MUESTRAS_CERT_KEY_ID: no se pueden firmar certificados.");
    this.name = "FaltaLaClaveDelCertificado";
  }
}

/** La clave privada (PKCS8 PEM guardada en base64) y su `kid`; `null` si falta o no se entiende. */
function clavePrivada(): { kid: string; clave: KeyObject } | null {
  const { certPrivateKey, certKeyId } = credencialesDeVentas();
  if (!certPrivateKey || !certKeyId) return null;
  try {
    const pem = Buffer.from(certPrivateKey, "base64").toString("utf8");
    const clave = createPrivateKey(pem);
    return clave.asymmetricKeyType === "ed25519" ? { kid: certKeyId, clave } : null;
  } catch {
    return null;
  }
}

/** El `kid` con el que se firma ahora (va dentro del texto firmado), o `null` si falta la clave. */
export function kidActual(): string | null {
  return clavePrivada()?.kid ?? null;
}

/** Firma el texto canónico: `{ kid, signature }` con la firma en base64url. */
export function firmarCertificado(payload: string): { kid: string; signature: string } {
  const k = clavePrivada();
  if (!k) throw new FaltaLaClaveDelCertificado();
  return { kid: k.kid, signature: sign(null, Buffer.from(payload, "utf8"), k.clave).toString("base64url") };
}

/** Las claves públicas por `kid`: la actual (derivada de la privada) y las anteriores, si se rotó. */
export function clavesPublicas(): Record<string, string> {
  const out: Record<string, string> = { ...credencialesDeVentas().certOldPublicKeys };
  const k = clavePrivada();
  if (k) out[k.kid] = createPublicKey(k.clave).export({ type: "spki", format: "pem" }).toString();
  return out;
}

/** ¿La firma corresponde a este texto con la clave de ese `kid`? Nunca lanza. */
export function verificarFirma(payload: string, signature: string, kid: string): boolean {
  const pem = clavesPublicas()[kid];
  if (!pem || !/^[A-Za-z0-9_-]{20,200}$/.test(signature)) return false;
  try {
    return verify(null, Buffer.from(payload, "utf8"), createPublicKey(pem), Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}

export function urlDeVerificacion(codigo: string): string {
  return `${baseUrlPublica()}/verificar/${codigo}`;
}

// ---------------------------------------------------------------------------------------------
// Las piezas

export type DatosDelCertificado = {
  codigo: string;
  kid: string;
  /** "3/10", "Copia única" o "P/A 1/2". */
  numero: string;
  obra: string;
  autor: string;
  /** "Copia impresa Fine Art · Hahnemühle Photo Rag 308 g · 40 × 60 cm". */
  formato: string;
  muestra: string;
  sede: string | null;
  emitido: Date;
  comprador: string | null;
  originalSha256: string;
  /** PNG de la firma escaneada del autor, o null. */
  firmaPng: Uint8Array | null;
  prueba: boolean;
};

const A4 = { ancho: 210, alto: 297 };

function marcaDePrueba(p: PDFPage, negrita: Awaited<ReturnType<typeof cargarFuentes>>["negrita"], ancho: number, alto: number) {
  const texto = "CERTIFICADO DE PRUEBA - SIN VALIDEZ";
  const size = 34;
  p.drawText(texto, {
    x: ancho * 0.1, y: alto * 0.25, size, font: negrita, color: rgb(0.75, 0.2, 0.15), opacity: 0.22, rotate: degrees(52),
  });
}

/** A4 vertical: el certificado con la firma escaneada, el QR y la huella del original. */
export async function pdfDeCertificado(d: DatosDelCertificado): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Certificado ${d.codigo}`, d.emitido);
  const f = await cargarFuentes(pdf);
  const ancho = A4.ancho * MM;
  const alto = A4.alto * MM;
  const p = pdf.addPage([ancho, alto]);
  const m = 20 * MM;
  const util = ancho - 2 * m;

  let y = bloqueCentrado(p, "CERTIFICADO DE AUTENTICIDAD", { x: m, y: alto - m, ancho: util, size: 11, font: f.negrita, color: GRIS, maxLineas: 1 });
  y -= 8;
  p.drawLine({ start: { x: m, y }, end: { x: ancho - m, y }, thickness: 0.5, color: LINEA });
  y -= 30;
  y = bloqueCentrado(p, d.obra, { x: m, y, ancho: util, size: 28, font: f.negrita, color: TINTA, maxLineas: 3, interlinea: 1.1 });
  y -= 6;
  y = bloqueCentrado(p, d.autor, { x: m, y, ancho: util, size: 16, font: f.normal, color: TINTA, maxLineas: 2 });
  y -= 26;
  y = bloqueCentrado(p, d.numero, { x: m, y, ancho: util, size: 44, font: f.negrita, color: TINTA, maxLineas: 1 });
  y -= 18;
  y = bloqueCentrado(p, d.formato, { x: m, y, ancho: util, size: 12, font: f.normal, color: TINTA, maxLineas: 3 });
  y -= 10;
  const muestra = d.sede ? `${d.muestra} · ${d.sede}` : d.muestra;
  y = bloqueCentrado(p, muestra, { x: m, y, ancho: util, size: 11, font: f.normal, color: GRIS, maxLineas: 2 });
  y = bloqueCentrado(p, `Emitido el ${formatArDayLong(d.emitido)}`, { x: m, y: y - 4, ancho: util, size: 11, font: f.normal, color: GRIS, maxLineas: 1 });
  if (d.comprador) y = bloqueCentrado(p, `A nombre de ${d.comprador}`, { x: m, y: y - 4, ancho: util, size: 11, font: f.normal, color: GRIS, maxLineas: 2 });

  // La firma escaneada del autor, con su nombre debajo.
  y -= 24;
  if (d.firmaPng) {
    try {
      const img = await pdf.embedPng(d.firmaPng);
      const maxAncho = 70 * MM;
      const maxAlto = 26 * MM;
      const escala = Math.min(maxAncho / img.width, maxAlto / img.height, 1);
      const w = img.width * escala;
      const h = img.height * escala;
      p.drawImage(img, { x: (ancho - w) / 2, y: y - h, width: w, height: h });
      y -= h + 2;
    } catch {
      // Una firma que no se puede leer no frena el certificado: queda la línea con el nombre.
      y -= 26 * MM;
    }
  } else {
    y -= 26 * MM;
  }
  p.drawLine({ start: { x: ancho / 2 - 40 * MM, y }, end: { x: ancho / 2 + 40 * MM, y }, thickness: 0.5, color: GRIS });
  bloqueCentrado(p, d.autor, { x: m, y: y - 2, ancho: util, size: 10, font: f.normal, color: GRIS, maxLineas: 1 });

  // Abajo: el QR (4 cm) y, a su derecha, el código, la huella y la firma digital.
  const lado = 40 * MM;
  const url = urlDeVerificacion(d.codigo);
  dibujarQr(p, url, m, m, lado);
  const xT = m + lado + 8 * MM;
  const anchoT = ancho - m - xT;
  let yT = bloque(p, "Verificá este certificado", { x: xT, y: m + lado, ancho: anchoT, size: 11, font: f.negrita, color: TINTA, maxLineas: 1 });
  yT = bloque(p, url.replace(/^https?:\/\//, ""), { x: xT, y: yT - 2, ancho: anchoT, size: 9, font: f.normal, color: GRIS, maxLineas: 2 });
  yT = bloque(p, `Código: ${formatCertificateCode(d.codigo)}`, { x: xT, y: yT - 6, ancho: anchoT, size: 12, font: f.negrita, color: TINTA, maxLineas: 1 });
  yT = bloque(p, `Huella del original: ${d.originalSha256.slice(0, 16)}…`, { x: xT, y: yT - 4, ancho: anchoT, size: 9, font: f.normal, color: GRIS, maxLineas: 1 });
  bloque(p, `Firma digital DNX ${d.kid}`, { x: xT, y: yT - 2, ancho: anchoT, size: 9, font: f.normal, color: GRIS, maxLineas: 1 });

  if (d.prueba) marcaDePrueba(p, f.negrita, ancho, alto);
  return pdf.save();
}

/** Marcas de corte en las cuatro esquinas de un rectángulo. */
function marcasDeCorte(p: PDFPage, x: number, y: number, w: number, h: number) {
  const largo = 5 * MM;
  const sep = 2 * MM;
  const linea = (x1: number, y1: number, x2: number, y2: number) => p.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.4, color: GRIS });
  for (const [cx, dx] of [[x, -1], [x + w, 1]] as const) {
    for (const [cy, dy] of [[y, -1], [y + h, 1]] as const) {
      linea(cx + dx * sep, cy, cx + dx * (sep + largo), cy);
      linea(cx, cy + dy * sep, cx, cy + dy * (sep + largo));
    }
  }
}

/** Una hoja A4 con la etiqueta de 10 × 6 cm para pegar al dorso, con marcas de corte. */
export async function pdfDeEtiqueta(d: DatosDelCertificado): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  prepararDocumento(pdf, `Etiqueta ${d.codigo}`, d.emitido);
  const f = await cargarFuentes(pdf);
  const ancho = A4.ancho * MM;
  const alto = A4.alto * MM;
  const p = pdf.addPage([ancho, alto]);
  const w = 100 * MM;
  const h = 60 * MM;
  const x = (ancho - w) / 2;
  const y = alto - 30 * MM - h;
  marcasDeCorte(p, x, y, w, h);

  const pad = 4 * MM;
  const lado = 40 * MM;
  dibujarQr(p, urlDeVerificacion(d.codigo), x + pad, y + (h - lado) / 2, lado);
  const xT = x + pad + lado + 4 * MM;
  const anchoT = x + w - pad - xT;
  let yT = bloque(p, d.numero, { x: xT, y: y + h - pad, ancho: anchoT, size: 20, font: f.negrita, color: TINTA, maxLineas: 1 });
  yT = bloque(p, d.obra, { x: xT, y: yT - 2, ancho: anchoT, size: 10, font: f.negrita, color: TINTA, maxLineas: 2 });
  yT = bloque(p, d.autor, { x: xT, y: yT, ancho: anchoT, size: 9, font: f.normal, color: TINTA, maxLineas: 1 });
  yT = bloque(p, formatCertificateCode(d.codigo), { x: xT, y: yT - 4, ancho: anchoT, size: 9, font: f.negrita, color: TINTA, maxLineas: 1 });
  bloque(p, "Verificá en muestrasfotograficas.com/verificar", { x: xT, y: yT - 2, ancho: anchoT, size: 7, font: f.normal, color: GRIS, maxLineas: 2 });
  if (d.prueba) bloque(p, "PRUEBA - SIN VALIDEZ", { x: x + pad, y: y + pad + 8, ancho: w, size: 7, font: f.negrita, color: rgb(0.75, 0.2, 0.15), maxLineas: 1 });
  bloqueCentrado(p, "Recortá por las marcas y pegala al dorso de la impresión.", { x: 0, y: y - 10 * MM, ancho, size: 9, font: f.normal, color: GRIS, maxLineas: 1 });
  return pdf.save();
}

// ---------------------------------------------------------------------------------------------
// Datos desde la base y caché en el bucket privado

/** Lo que dice el certificado de una copia emitida y firmada, o `null` si todavía no lo está. */
export async function datosDelCertificado(copyId: string): Promise<DatosDelCertificado | null> {
  const c = await prisma.culturalEditionCopy.findUnique({
    where: { id: copyId },
    select: { certificateCode: true, certificateKid: true, certificatePayload: true, issuedAt: true, isTest: true, offerId: true, status: true },
  });
  if (!c?.certificateCode || !c.certificateKid || !c.certificatePayload || !c.issuedAt) return null;
  let leido: Record<string, unknown>;
  try {
    leido = JSON.parse(c.certificatePayload) as Record<string, unknown>;
  } catch {
    return null;
  }
  const oferta = await prisma.culturalWorkOffer.findUnique({ where: { id: c.offerId }, select: { activityId: true, authorUserId: true, activityWorkId: true } });
  if (!oferta) return null;
  const [actividad, firma, archivo] = await Promise.all([
    prisma.culturalActivity.findUnique({ where: { id: oferta.activityId }, select: { venueName: true, city: true, isVirtualOnly: true } }),
    prisma.culturalAuthorSignature.findUnique({ where: { userId: oferta.authorUserId }, select: { storageKey: true } }),
    prisma.culturalSaleFile.findUnique({ where: { activityWorkId: oferta.activityWorkId }, select: { widthPx: true, heightPx: true } }),
  ]);
  const s = (k: string) => (typeof leido[k] === "string" ? (leido[k] as string) : "");
  const n = (k: string) => (typeof leido[k] === "number" ? (leido[k] as number) : null);
  const numero = s("kind") === "PROOF" ? `P/A ${n("number")}/${n("size")}` : s("edition") === "UNIQUE" ? "Copia única" : `${n("number")}/${n("size")}`;
  const formato = s("format") === "PRINT"
    ? ["Copia impresa Fine Art", s("paper") || null, n("widthCm") != null && n("heightCm") != null ? `${n("widthCm")} × ${n("heightCm")} cm` : null].filter(Boolean).join(" · ")
    : ["Copia digital firmada", archivo?.widthPx && archivo.heightPx ? `${archivo.widthPx} × ${archivo.heightPx} px` : null].filter(Boolean).join(" · ");
  const firmaPng = firma ? await leerPrivado(firma.storageKey, { maxBytes: 10 * 1024 * 1024 }).catch(() => null) : null;
  return {
    codigo: c.certificateCode,
    kid: c.certificateKid,
    numero,
    obra: s("work"),
    autor: s("author"),
    formato,
    muestra: s("activity"),
    sede: actividad && !actividad.isVirtualOnly ? [actividad.venueName, actividad.city].filter(Boolean).join(", ") || null : null,
    emitido: c.issuedAt,
    comprador: s("buyer") || null,
    originalSha256: s("originalSha256"),
    firmaPng: firmaPng ? new Uint8Array(firmaPng) : null,
    prueba: c.isTest,
  };
}

/** Carpeta de las piezas: la del pedido (D17) o, para una P/A sin pedido, la de la copia. */
const carpeta = (copia: { id: string; orderId: string | null }) => (copia.orderId ? `ventas/${copia.orderId}` : `ventas/pa-${copia.id}`);

/**
 * El PDF ("certificado" o "etiqueta") de una copia: del bucket si ya se generó; si no, se arma, se
 * guarda y se devuelve. `null` si la copia todavía no tiene certificado.
 */
export async function pdfGuardado(copyId: string, pieza: "certificado" | "etiqueta"): Promise<Uint8Array | null> {
  const copia = await prisma.culturalEditionCopy.findUnique({ where: { id: copyId }, select: { id: true, orderId: true, certificateCode: true, status: true } });
  // Una copia anulada (devolución, contracargo) no se entrega más, ni siquiera la pieza ya guardada.
  if (!copia?.certificateCode || copia.status !== "ISSUED") return null;
  const clave = `${carpeta(copia)}/${pieza}.pdf`;
  const guardado = await leerPrivado(clave, { maxBytes: 20 * 1024 * 1024 });
  if (guardado) return new Uint8Array(guardado);
  const datos = await datosDelCertificado(copyId);
  if (!datos) return null;
  const bytes = pieza === "certificado" ? await pdfDeCertificado(datos) : await pdfDeEtiqueta(datos);
  await subirPrivado(clave, bytes, "application/pdf");
  return bytes;
}
