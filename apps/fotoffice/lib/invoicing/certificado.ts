import { createPrivateKey, X509Certificate } from "node:crypto";

/**
 * Lo que se revisa del certificado que la persona baja de ARCA y sube a FOTOFFICE, antes de
 * guardarlo. Módulo PURO.
 */

export type CertificadoRevisado =
  | { ok: true; certPem: string; serial: string; venceEl: Date; asunto: string }
  | { ok: false; error: string };

/** Acepta el PEM tal cual lo baja ARCA (.crt o .pem), con o sin espacios de más. */
export function revisarCertificado(texto: string, keyPem: string, cuit: string, ahora: Date): CertificadoRevisado {
  const m = texto.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
  if (!m) return { ok: false, error: "El archivo no es un certificado. Tiene que ser el .crt que bajaste de ARCA." };
  let cert: X509Certificate;
  try {
    cert = new X509Certificate(m[0]);
  } catch {
    return { ok: false, error: "El certificado está dañado o incompleto. Bajalo de nuevo de ARCA." };
  }
  let corresponde = false;
  try {
    corresponde = cert.checkPrivateKey(createPrivateKey(keyPem));
  } catch {
    corresponde = false;
  }
  if (!corresponde) {
    return {
      ok: false,
      error: "Este certificado no corresponde al pedido que generó FOTOFFICE para este ambiente. Revisá que sea el de este ambiente y el último pedido.",
    };
  }
  if (!cert.subject.includes(`CUIT ${cuit}`)) {
    return { ok: false, error: `El certificado es de otro CUIT. Tiene que ser del ${cuit}.` };
  }
  const venceEl = new Date(cert.validTo);
  if (isNaN(venceEl.getTime()) || venceEl.getTime() <= ahora.getTime()) {
    return { ok: false, error: "El certificado ya está vencido. Generá un pedido nuevo y pedí otro en ARCA." };
  }
  return { ok: true, certPem: cert.toString(), serial: cert.serialNumber, venceEl, asunto: cert.subject.replace(/\n/g, ", ") };
}

/** Días que le quedan al certificado (redondeado hacia abajo). */
export function diasParaVencer(venceEl: Date, ahora: Date): number {
  return Math.floor((venceEl.getTime() - ahora.getTime()) / 86_400_000);
}
