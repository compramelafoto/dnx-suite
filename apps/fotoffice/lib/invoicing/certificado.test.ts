import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { diasParaVencer, revisarCertificado } from "./certificado";
import { generarClaveYCsr } from "./csr";

function hayOpenssl(): boolean {
  try {
    execFileSync("openssl", ["version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hayOpenssl())("revisión del certificado que sube la persona", () => {
  let dir = "";
  let certPem = "";
  let keyPem = "";
  let otraClave = "";
  const AHORA = new Date();

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), "fo-cert-"));
    const g = generarClaveYCsr({ cuit: "20123456786", razonSocial: "DNX Estudio", alias: "fotoffice" });
    keyPem = g.keyPem;
    otraClave = generarClaveYCsr({ cuit: "20123456786", razonSocial: "DNX Estudio", alias: "otra" }).keyPem;
    writeFileSync(path.join(dir, "p.csr"), g.csrPem);
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", path.join(dir, "ca.key"), "-out", path.join(dir, "ca.crt"), "-subj", "/CN=CA", "-days", "2"], { stdio: "pipe" });
    execFileSync("openssl", ["x509", "-req", "-in", path.join(dir, "p.csr"), "-CA", path.join(dir, "ca.crt"), "-CAkey", path.join(dir, "ca.key"), "-set_serial", "77", "-days", "730", "-out", path.join(dir, "c.crt")], { stdio: "pipe" });
    certPem = readFileSync(path.join(dir, "c.crt"), "utf8");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("acepta el certificado del pedido y lee su vencimiento", () => {
    const r = revisarCertificado(`basura antes\n${certPem}\nbasura después`, keyPem, "20123456786", AHORA);
    expect(r.ok).toBe(true);
    if (r.ok) expect(diasParaVencer(r.venceEl, AHORA)).toBeGreaterThan(700);
  });
  it("rechaza un certificado de otra clave", () => {
    expect(revisarCertificado(certPem, otraClave, "20123456786", AHORA)).toMatchObject({ ok: false });
  });
  it("rechaza otro CUIT", () => {
    const r = revisarCertificado(certPem, keyPem, "30000000007", AHORA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("otro CUIT");
  });
  it("rechaza uno vencido", () => {
    expect(revisarCertificado(certPem, keyPem, "20123456786", new Date(AHORA.getTime() + 800 * 86_400_000))).toMatchObject({ ok: false });
  });
  it("rechaza lo que no es un certificado", () => {
    expect(revisarCertificado("hola", keyPem, "20123456786", AHORA)).toMatchObject({ ok: false });
  });
});
