import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import {
  bitString,
  contextConstructed,
  derToPem,
  integer,
  nullValue,
  oid,
  printableString,
  sequence,
  setOf,
  utf8String,
} from "./der";

/**
 * La clave privada y el pedido de certificado (CSR, PKCS#10) que se suben a ARCA.
 *
 * Es el equivalente exacto de lo que el manual de ARCA pide hacer con openssl:
 *
 *   openssl genrsa -out clave 2048
 *   openssl req -new -key clave -subj "/C=AR/O=<razón social>/CN=<alias>/serialNumber=CUIT <cuit>"
 *
 * pero hecho en el servidor, para que la persona no tenga que abrir una terminal. Módulo PURO.
 */

export const OID_SHA256_WITH_RSA = "1.2.840.113549.1.1.11";
const OID_COUNTRY = "2.5.4.6";
const OID_ORGANIZATION = "2.5.4.10";
const OID_COMMON_NAME = "2.5.4.3";
const OID_SERIAL_NUMBER = "2.5.4.5";

export type DatosCsr = {
  /** CUIT sin guiones, 11 dígitos. */
  cuit: string;
  razonSocial: string;
  /** Nombre corto del certificado (lo que ARCA llama "nombre simbólico del DN"). */
  alias: string;
};

/** El alias que acepta ARCA: letras y números, sin espacios. */
export function aliasValido(alias: string): boolean {
  return /^[A-Za-z0-9]{1,50}$/.test(alias);
}

function rdn(oidTexto: string, valor: Buffer): Buffer {
  return setOf(sequence(oid(oidTexto), valor));
}

/** El asunto del certificado: C=AR, O=razón social, CN=alias, serialNumber=CUIT n. */
export function nombreDelAsunto(d: DatosCsr): Buffer {
  return sequence(
    rdn(OID_COUNTRY, printableString("AR")),
    rdn(OID_ORGANIZATION, utf8String(d.razonSocial)),
    rdn(OID_COMMON_NAME, utf8String(d.alias)),
    rdn(OID_SERIAL_NUMBER, printableString(`CUIT ${d.cuit}`)),
  );
}

export function algoritmoSha256ConRsa(): Buffer {
  return sequence(oid(OID_SHA256_WITH_RSA), nullValue());
}

/** Arma el CSR firmado con la clave privada. Devuelve el PEM. */
export function construirCsr(d: DatosCsr, privateKey: KeyObject, publicKey: KeyObject): string {
  if (!/^\d{11}$/.test(d.cuit)) throw new Error("El CUIT tiene que tener 11 dígitos.");
  if (!aliasValido(d.alias)) throw new Error("El alias sólo puede tener letras y números.");
  if (!d.razonSocial.trim()) throw new Error("Falta la razón social.");
  const spki = publicKey.export({ type: "spki", format: "der" });
  const info = sequence(
    integer(0),
    nombreDelAsunto({ ...d, razonSocial: d.razonSocial.trim() }),
    spki,
    // attributes [0] IMPLICIT SET OF Attribute: vacío.
    contextConstructed(0, Buffer.alloc(0)),
  );
  const signer = createSign("sha256");
  signer.update(info);
  const firma = signer.sign(privateKey);
  const csr = sequence(info, algoritmoSha256ConRsa(), bitString(firma));
  return derToPem(csr, "CERTIFICATE REQUEST");
}

/** Clave RSA de 2048 bits (lo que pide ARCA) y su CSR. La clave sale en PEM PKCS#8. */
export function generarClaveYCsr(d: DatosCsr): { keyPem: string; csrPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const csrPem = construirCsr(d, privateKey, publicKey);
  const keyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  return { keyPem, csrPem };
}
