import { createHash, createSign, type KeyObject } from "node:crypto";
import {
  children,
  contextConstructed,
  integer,
  nullValue,
  octetString,
  oid,
  pemToDer,
  readNode,
  sequence,
  setOf,
  TAG,
  utcTime,
} from "./der";

/**
 * Firma CMS SignedData (PKCS#7) del pedido de acceso (TRA) para WSAA.
 *
 * Es lo mismo que hace `openssl cms -sign -in tra.xml -signer cert -inkey clave -nodetach
 * -outform DER`: el contenido va adentro (no separado), con el certificado y tres atributos
 * firmados (tipo de contenido, hora de firma y resumen SHA-256). Módulo PURO.
 */

const OID_SIGNED_DATA = "1.2.840.113549.1.7.2";
const OID_DATA = "1.2.840.113549.1.7.1";
const OID_SHA256 = "2.16.840.1.101.3.4.2.1";
const OID_RSA_ENCRYPTION = "1.2.840.113549.1.1.1";
const OID_ATTR_CONTENT_TYPE = "1.2.840.113549.1.9.3";
const OID_ATTR_MESSAGE_DIGEST = "1.2.840.113549.1.9.4";
const OID_ATTR_SIGNING_TIME = "1.2.840.113549.1.9.5";

export type EmisorYSerie = { issuerRaw: Buffer; serialRaw: Buffer };

/**
 * Del certificado salen el emisor y el número de serie tal cual vinieron: el verificador los
 * compara byte a byte, así que no se recodifican.
 */
export function emisorYSerie(certDer: Buffer): EmisorYSerie {
  const cert = readNode(certDer);
  if (cert.tag !== TAG.SEQUENCE) throw new Error("El certificado no es válido.");
  const tbs = children(cert)[0];
  if (!tbs || tbs.tag !== TAG.SEQUENCE) throw new Error("El certificado no es válido.");
  const campos = children(tbs);
  // La versión es opcional ([0] EXPLICIT); si está, el número de serie es el segundo.
  const i = campos[0]?.tag === 0xa0 ? 1 : 0;
  const serial = campos[i];
  const issuer = campos[i + 2];
  if (!serial || serial.tag !== TAG.INTEGER || !issuer || issuer.tag !== TAG.SEQUENCE) {
    throw new Error("El certificado no es válido.");
  }
  return { issuerRaw: issuer.raw, serialRaw: serial.raw };
}

function atributo(oidTexto: string, valor: Buffer): Buffer {
  return sequence(oid(oidTexto), setOf(valor));
}

/**
 * Firma `contenido` y devuelve el CMS en DER.
 *
 * `ahora` se inyecta para que las pruebas sean repetibles.
 */
export function firmarCms(contenido: Buffer, certPem: string, privateKey: KeyObject, ahora: Date = new Date()): Buffer {
  const certDer = pemToDer(certPem, "CERTIFICATE");
  const { issuerRaw, serialRaw } = emisorYSerie(certDer);
  const sha256 = sequence(oid(OID_SHA256), nullValue());

  const resumen = createHash("sha256").update(contenido).digest();
  const atributos = setOf(
    atributo(OID_ATTR_CONTENT_TYPE, oid(OID_DATA)),
    atributo(OID_ATTR_SIGNING_TIME, utcTime(ahora)),
    atributo(OID_ATTR_MESSAGE_DIGEST, octetString(resumen)),
  );
  // La firma va sobre el SET (etiqueta 0x31); en el SignerInfo viaja como [0] IMPLICIT.
  const signer = createSign("sha256");
  signer.update(atributos);
  const firma = signer.sign(privateKey);
  const atributosImplicitos = Buffer.concat([Buffer.from([0xa0]), atributos.subarray(1)]);

  const signerInfo = sequence(
    integer(1),
    sequence(issuerRaw, serialRaw),
    sha256,
    atributosImplicitos,
    sequence(oid(OID_RSA_ENCRYPTION), nullValue()),
    octetString(firma),
  );

  const signedData = sequence(
    integer(1),
    setOf(sha256),
    sequence(oid(OID_DATA), contextConstructed(0, octetString(contenido))),
    // certificates [0] IMPLICIT SET OF Certificate.
    contextConstructed(0, certDer),
    setOf(signerInfo),
  );

  return sequence(oid(OID_SIGNED_DATA), contextConstructed(0, signedData));
}
