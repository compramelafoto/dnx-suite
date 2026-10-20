import { formatArDayLong, toArDay } from "./dates";
import { ROOM_CODE_ALPHABET } from "./room";

/**
 * Certificados de autenticidad (etapa 8, spec D18–D20). Acá: el código que va en el QR, el texto
 * canónico que se firma con Ed25519 (la firma la pone la app con `node:crypto`), lo que dice la
 * página de verificación y el paquete XMP del archivo digital firmado.
 */

/** Mismo alfabeto sin ambiguos que los códigos de sala, en mayúsculas: 12 símbolos ≈ 60 bits. */
export const CERTIFICATE_CODE_ALPHABET = ROOM_CODE_ALPHABET.toUpperCase();
export const CERTIFICATE_CODE_LENGTH = 12;
export const CERTIFICATE_PAYLOAD_VERSION = 1;
export const CERTIFICATE_XMP_NAMESPACE = "https://muestrasfotograficas.com/ns/certificado/1.0/";
const CODE_RE = new RegExp(`^[${CERTIFICATE_CODE_ALPHABET}]{${CERTIFICATE_CODE_LENGTH}}$`);

/** `randomInt(max)` devuelve un entero uniforme en [0, max) (`crypto.randomInt` en la app). */
export function newCertificateCode(randomInt: (max: number) => number): string {
  let s = "";
  for (let i = 0; i < CERTIFICATE_CODE_LENGTH; i++) s += CERTIFICATE_CODE_ALPHABET[randomInt(CERTIFICATE_CODE_ALPHABET.length)];
  return s;
}

/** Lo que escribe la gente ("abcd-efgh-jkmn") → "ABCDEFGHJKMN"; `null` si no es un código posible. */
export function normalizeCertificateCode(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\s-]+/g, "").toUpperCase();
  return CODE_RE.test(s) ? s : null;
}

/** "ABCD-EFGH-JKMN", para leerlo y dictarlo. */
export function formatCertificateCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

export type CertificateData = {
  code: string;
  kid: string;
  activityTitle: string;
  workTitle: string;
  /** Nombre del autor tal como firma. */
  authorName: string;
  format: string;
  editionKind: string;
  kind: string;
  number: number;
  editionSize: number;
  proofCount: number;
  paper: string | null;
  widthCm: number | null;
  heightCm: number | null;
  originalSha256: string;
  issuedAt: Date;
  buyerName: string | null;
  buyerOnCertificate: boolean;
  isTest: boolean;
};

function ordenado(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(ordenado);
  if (x !== null && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, ordenado(o[k])]));
  }
  return x;
}

/**
 * El texto canónico que se firma: JSON con las claves ordenadas y sin espacios. El comprador va sólo
 * si aceptó figurar; papel y medida, sólo si es impresa; `test: true` si es una venta de prueba.
 * En una P/A, `size` es la cantidad de pruebas.
 */
export function certificatePayload(d: CertificateData): string {
  const impresa = d.format === "PRINT";
  const obj: Record<string, unknown> = {
    v: CERTIFICATE_PAYLOAD_VERSION,
    code: d.code,
    kid: d.kid,
    activity: d.activityTitle,
    work: d.workTitle,
    author: d.authorName,
    format: d.format,
    edition: d.editionKind,
    kind: d.kind,
    number: d.number,
    size: d.kind === "PROOF" ? d.proofCount : d.editionSize,
    originalSha256: d.originalSha256,
    issuedOn: toArDay(d.issuedAt),
  };
  if (impresa) {
    const papel = d.paper?.trim();
    if (papel) obj.paper = papel;
    if (d.widthCm != null) obj.widthCm = d.widthCm;
    if (d.heightCm != null) obj.heightCm = d.heightCm;
  }
  const comprador = d.buyerName?.trim();
  if (d.buyerOnCertificate && comprador) obj.buyer = comprador;
  if (d.isTest) obj.test = true;
  return JSON.stringify(ordenado(obj));
}

export type CertificateState = "VALID" | "VOIDED" | "TEST" | "INVALID_SIGNATURE";

/**
 * Lo que dice `/verificar/<código>`. La firma se revisa primero: si no coincide, no importa lo demás.
 * Una copia que no está emitida ni anulada (una reserva) no es un certificado.
 */
export function certificateView(p: {
  status: string;
  isTest: boolean;
  voidedAt: Date | null;
  signatureValid: boolean;
  label: string;
  workTitle: string;
  authorName: string;
  issuedAt: Date | null;
}): { state: CertificateState; title: string } {
  const invalido = { state: "INVALID_SIGNATURE" as const, title: "La firma no coincide: este certificado no es válido" };
  if (!p.signatureValid || (p.status !== "ISSUED" && p.status !== "VOIDED")) return invalido;
  if (p.status === "VOIDED") {
    const cuando = p.voidedAt ? ` el ${formatArDayLong(p.voidedAt)}` : "";
    return { state: "VOIDED", title: `Esta copia fue anulada${cuando}. El número no se vuelve a usar.` };
  }
  if (p.isTest) return { state: "TEST", title: "Certificado de prueba, sin validez" };
  const emitida = p.issuedAt ? `, emitida el ${formatArDayLong(p.issuedAt)}` : "";
  return { state: "VALID", title: `Copia auténtica ${p.label} de ${p.workTitle} de ${p.authorName}${emitida}` };
}

const XML_ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => XML_ESC[c]!);

/** Paquete XMP para `sharp().withXmp()`: Dublin Core, derechos y el bloque propio `mf:`. */
export function xmpPacket(d: {
  title: string;
  creator: string;
  rights: string;
  webStatement: string;
  code: string;
  edition: string;
  originalSha256: string;
  kid: string;
  signature: string;
}): string {
  return [
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/" xmlns:mf="${CERTIFICATE_XMP_NAMESPACE}">`,
    `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(d.title)}</rdf:li></rdf:Alt></dc:title>`,
    `<dc:creator><rdf:Seq><rdf:li>${esc(d.creator)}</rdf:li></rdf:Seq></dc:creator>`,
    `<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${esc(d.rights)}</rdf:li></rdf:Alt></dc:rights>`,
    `<xmpRights:Marked>True</xmpRights:Marked>`,
    `<xmpRights:WebStatement>${esc(d.webStatement)}</xmpRights:WebStatement>`,
    `<mf:code>${esc(d.code)}</mf:code>`,
    `<mf:edition>${esc(d.edition)}</mf:edition>`,
    `<mf:originalSha256>${esc(d.originalSha256)}</mf:originalSha256>`,
    `<mf:kid>${esc(d.kid)}</mf:kid>`,
    `<mf:signature>${esc(d.signature)}</mf:signature>`,
    "</rdf:Description>",
    "</rdf:RDF>",
    "</x:xmpmeta>",
    '<?xpacket end="w"?>',
  ].join("\n");
}
