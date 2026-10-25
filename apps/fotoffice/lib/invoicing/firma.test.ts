import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey, verify, X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { children, decodeOid, derToPem, encodeLength, integer, oid, pemToDer, readNode, setOf, TAG } from "./der";
import { aliasValido, construirCsr, generarClaveYCsr } from "./csr";
import { emisorYSerie, firmarCms } from "./cms";

/** ¿Hay openssl en la máquina? Las pruebas de verificación cruzada lo usan si está. */
function hayOpenssl(): boolean {
  try {
    execFileSync("openssl", ["version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
const OPENSSL = hayOpenssl();

describe("der", () => {
  it("codifica largos cortos y largos", () => {
    expect(encodeLength(5)).toEqual(Buffer.from([5]));
    expect(encodeLength(127)).toEqual(Buffer.from([127]));
    expect(encodeLength(128)).toEqual(Buffer.from([0x81, 0x80]));
    expect(encodeLength(300)).toEqual(Buffer.from([0x82, 0x01, 0x2c]));
  });

  it("codifica enteros con el cero de signo cuando hace falta", () => {
    expect(integer(0)).toEqual(Buffer.from([2, 1, 0]));
    expect(integer(1)).toEqual(Buffer.from([2, 1, 1]));
    expect(integer(128)).toEqual(Buffer.from([2, 2, 0, 128]));
    expect(integer(Buffer.from([0, 0, 5]))).toEqual(Buffer.from([2, 1, 5]));
    expect(integer(Buffer.from([0xff]))).toEqual(Buffer.from([2, 2, 0, 0xff]));
  });

  it("codifica y lee OIDs", () => {
    // sha256WithRSAEncryption, el ejemplo clásico.
    expect(oid("1.2.840.113549.1.1.11").toString("hex")).toBe("06092a864886f70d01010b");
    expect(decodeOid(readNode(oid("2.16.840.1.101.3.4.2.1")))).toBe("2.16.840.1.101.3.4.2.1");
  });

  it("ordena los SET OF por su codificación", () => {
    const a = Buffer.from([2, 1, 9]);
    const b = Buffer.from([2, 1, 1]);
    expect(setOf(a, b)).toEqual(Buffer.from([0x31, 6, 2, 1, 1, 2, 1, 9]));
  });

  it("rechaza un DER truncado", () => {
    expect(() => readNode(Buffer.from([0x30, 5, 1]))).toThrow();
  });

  it("ida y vuelta de PEM", () => {
    const der = Buffer.from("hola mundo");
    expect(pemToDer(derToPem(der, "PRUEBA"), "PRUEBA")).toEqual(der);
  });
});

describe("pedido de certificado (CSR)", () => {
  const datos = { cuit: "20123456786", razonSocial: "DNX Estudio de Daniel Cuart", alias: "fotoffice" };

  it("valida el alias", () => {
    expect(aliasValido("fotoffice2026")).toBe(true);
    expect(aliasValido("con espacio")).toBe(false);
    expect(aliasValido("")).toBe(false);
  });

  it("rechaza un CUIT mal escrito", () => {
    const { privateKey, publicKey } = keyPair();
    expect(() => construirCsr({ ...datos, cuit: "20-12345678-6" }, privateKey, publicKey)).toThrow();
  });

  it("arma un PKCS#10 cuya firma verifica con la clave pública que lleva adentro", () => {
    const { csrPem, keyPem } = generarClaveYCsr(datos);
    expect(keyPem).toContain("BEGIN PRIVATE KEY");
    const der = pemToDer(csrPem, "CERTIFICATE REQUEST");
    const [info, alg, firma] = children(readNode(der));
    expect(decodeOid(children(alg!)[0]!)).toBe("1.2.840.113549.1.1.11");
    const spki = children(info!)[2]!;
    const pub = createPublicKey({ key: spki.raw, format: "der", type: "spki" });
    expect(verify("sha256", info!.raw, pub, firma!.content.subarray(1))).toBe(true);
    // La pública es la de la clave privada generada.
    expect(createPublicKey(createPrivateKey(keyPem)).export({ type: "spki", format: "der" })).toEqual(spki.raw);
  });

  it.skipIf(!OPENSSL)("openssl req -verify lo acepta y lee el asunto que pide ARCA", () => {
    const { csrPem } = generarClaveYCsr(datos);
    const dir = mkdtempSync(path.join(tmpdir(), "fo-csr-"));
    try {
      writeFileSync(path.join(dir, "pedido.csr"), csrPem);
      const out = execFileSync(
        "openssl",
        ["req", "-in", path.join(dir, "pedido.csr"), "-noout", "-verify", "-subject", "-nameopt", "RFC2253"],
        { stdio: "pipe" },
      ).toString();
      const salida = out + "";
      expect(salida).toContain("serialNumber=CUIT 20123456786");
      expect(salida).toContain("CN=fotoffice");
      expect(salida).toContain("O=DNX Estudio de Daniel Cuart");
      expect(salida).toContain("C=AR");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function keyPair() {
  const { keyPem } = generarClaveYCsr({ cuit: "20123456786", razonSocial: "X", alias: "x" });
  const privateKey = createPrivateKey(keyPem);
  return { privateKey, publicKey: createPublicKey(privateKey) };
}

describe.skipIf(!OPENSSL)("firma CMS del pedido de acceso (WSAA)", () => {
  let dir = "";
  let certPem = "";
  let keyPem = "";
  const tra = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"></loginTicketRequest>');

  beforeAll(() => {
    // El certificado lo firma "ARCA": acá, una CA de prueba hecha con openssl sobre nuestro CSR.
    const generado = generarClaveYCsr({ cuit: "20123456786", razonSocial: "DNX Estudio", alias: "fotoffice" });
    keyPem = generado.keyPem;
    dir = mkdtempSync(path.join(tmpdir(), "fo-cms-"));
    writeFileSync(path.join(dir, "pedido.csr"), generado.csrPem);
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", path.join(dir, "ca.key"), "-out", path.join(dir, "ca.crt"), "-subj", "/CN=CA de prueba", "-days", "2"], { stdio: "pipe" });
    execFileSync("openssl", ["x509", "-req", "-in", path.join(dir, "pedido.csr"), "-CA", path.join(dir, "ca.crt"), "-CAkey", path.join(dir, "ca.key"), "-set_serial", "0x00ab12cd34", "-days", "2", "-out", path.join(dir, "cert.crt")], { stdio: "pipe" });
    certPem = readFileSync(path.join(dir, "cert.crt"), "utf8");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("toma el emisor y la serie del certificado tal cual", () => {
    const { serialRaw } = emisorYSerie(pemToDer(certPem, "CERTIFICATE"));
    const cert = new X509Certificate(certPem);
    expect(readNode(serialRaw).content.toString("hex").replace(/^0+/, "").toUpperCase()).toBe(cert.serialNumber.replace(/^0+/, ""));
  });

  it("openssl cms -verify acepta la firma y devuelve el TRA intacto", () => {
    const cms = firmarCms(tra, certPem, createPrivateKey(keyPem), new Date("2026-10-25T15:00:00Z"));
    writeFileSync(path.join(dir, "tra.cms"), cms);
    const contenido = execFileSync(
      "openssl",
      ["cms", "-verify", "-noverify", "-inform", "DER", "-in", path.join(dir, "tra.cms")],
      { stdio: "pipe" },
    );
    expect(Buffer.from(contenido)).toEqual(tra);
    // Y la cadena completa contra la CA de prueba, que es lo que hace ARCA con la suya.
    execFileSync("openssl", ["cms", "-verify", "-inform", "DER", "-in", path.join(dir, "tra.cms"), "-CAfile", path.join(dir, "ca.crt"), "-out", path.join(dir, "salida.xml")], { stdio: "pipe" });
    expect(readFileSync(path.join(dir, "salida.xml"))).toEqual(tra);
  });

  it("un TRA alterado ya no verifica", () => {
    const cms = Buffer.from(firmarCms(tra, certPem, createPrivateKey(keyPem)));
    // Cambiar un byte del contenido (que viaja adentro) rompe el resumen firmado.
    const i = cms.indexOf(Buffer.from("loginTicketRequest"));
    cms[i] = "X".charCodeAt(0);
    writeFileSync(path.join(dir, "alterado.cms"), cms);
    expect(() =>
      execFileSync("openssl", ["cms", "-verify", "-noverify", "-inform", "DER", "-in", path.join(dir, "alterado.cms")], { stdio: "pipe" }),
    ).toThrow();
  });

  it("los atributos firmados llevan el resumen SHA-256 del contenido", () => {
    const cms = firmarCms(tra, certPem, createPrivateKey(keyPem));
    const contentInfo = children(readNode(cms));
    const signedData = children(children(contentInfo[1]!)[0]!);
    const signerInfos = signedData[signedData.length - 1]!;
    expect(signerInfos.tag).toBe(TAG.SET);
    const signerInfo = children(children(signerInfos)[0]!);
    const attrs = children(signerInfo[3]!);
    const digest = attrs.find((a) => decodeOid(children(a)[0]!) === "1.2.840.113549.1.9.4")!;
    const valor = children(children(digest)[1]!)[0]!.content;
    expect(valor).toEqual(createHash("sha256").update(tra).digest());
  });
});
