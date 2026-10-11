import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_CODE_LENGTH, certificatePayload, certificateView, formatCertificateCode, newCertificateCode,
  normalizeCertificateCode, xmpPacket, type CertificateData,
} from "./certificates";

const datos: CertificateData = {
  code: "ABCDEFGHJKMN",
  kid: "mf-2026-10",
  activityTitle: "Luz del sur",
  workTitle: "Puerto",
  authorName: "Ana Pérez",
  format: "PRINT",
  editionKind: "LIMITED",
  kind: "COPY",
  number: 3,
  editionSize: 10,
  proofCount: 2,
  paper: "Hahnemühle Photo Rag 308 g",
  widthCm: 40,
  heightCm: 60,
  originalSha256: "a".repeat(64),
  issuedAt: new Date("2026-11-14T15:00:00Z"),
  buyerName: "Juan Gómez",
  buyerOnCertificate: true,
  isTest: false,
};

describe("código", () => {
  it("12 símbolos del alfabeto sin ambiguos, en mayúsculas", () => {
    let i = 0;
    const c = newCertificateCode(() => i++ % 31);
    expect(c).toHaveLength(CERTIFICATE_CODE_LENGTH);
    expect(c).toBe("23456789ABCD");
    expect(normalizeCertificateCode(c)).toBe(c);
  });
  it("normaliza lo que escribe la gente", () => {
    expect(normalizeCertificateCode(" abcd-efgh-jkmn ")).toBe("ABCDEFGHJKMN");
    expect(normalizeCertificateCode("abcd efgh jkmn")).toBe("ABCDEFGHJKMN");
    expect(normalizeCertificateCode("ABCD-EFGH-JKM0")).toBeNull();
    expect(normalizeCertificateCode("ABCD")).toBeNull();
    expect(normalizeCertificateCode("ABCDEFGHJKMNI")).toBeNull();
  });
  it("se muestra en grupos de cuatro", () => expect(formatCertificateCode("ABCDEFGHJKMN")).toBe("ABCD-EFGH-JKMN"));
});

describe("texto canónico", () => {
  it("vector fijo", () => {
    expect(certificatePayload(datos)).toBe(
      '{"activity":"Luz del sur","author":"Ana Pérez","buyer":"Juan Gómez","code":"ABCDEFGHJKMN","edition":"LIMITED","format":"PRINT","heightCm":60,"issuedOn":"2026-11-14","kid":"mf-2026-10","kind":"COPY","number":3,"originalSha256":"' +
        "a".repeat(64) +
        '","paper":"Hahnemühle Photo Rag 308 g","size":10,"v":1,"widthCm":40,"work":"Puerto"}',
    );
  });
  it("no depende del orden de las claves", () => {
    const desordenado = Object.fromEntries(Object.entries(datos).reverse()) as CertificateData;
    expect(certificatePayload(desordenado)).toBe(certificatePayload(datos));
  });
  it("sin aceptación no aparece el comprador", () => {
    expect(certificatePayload({ ...datos, buyerOnCertificate: false })).not.toContain("Juan");
    expect(certificatePayload({ ...datos, buyerName: null })).not.toContain("buyer");
  });
  it("la prueba lo dice", () => {
    expect(certificatePayload({ ...datos, isTest: true })).toContain('"test":true');
    expect(certificatePayload(datos)).not.toContain("test");
  });
  it("lo digital no lleva papel ni medida; la P/A lleva su total", () => {
    const d = certificatePayload({ ...datos, format: "DIGITAL", paper: null, widthCm: null, heightCm: null });
    expect(d).not.toContain("paper");
    expect(d).not.toContain("widthCm");
    const pa = JSON.parse(certificatePayload({ ...datos, kind: "PROOF", number: 1 })) as Record<string, unknown>;
    expect(pa).toMatchObject({ kind: "PROOF", number: 1, size: 2 });
  });
});

describe("vista de verificación", () => {
  const base = { status: "ISSUED", isTest: false, voidedAt: null, signatureValid: true, label: "3/10", workTitle: "Puerto", authorName: "Ana", issuedAt: datos.issuedAt };
  it("los cuatro casos", () => {
    expect(certificateView(base)).toEqual({ state: "VALID", title: "Copia auténtica 3/10 de Puerto de Ana, emitida el 14 de noviembre de 2026" });
    expect(certificateView({ ...base, status: "VOIDED", voidedAt: new Date("2026-11-20T15:00:00Z") })).toEqual({
      state: "VOIDED", title: "Esta copia fue anulada el 20 de noviembre de 2026. El número no se vuelve a usar.",
    });
    expect(certificateView({ ...base, isTest: true }).state).toBe("TEST");
    expect(certificateView({ ...base, isTest: true }).title).toBe("Certificado de prueba, sin validez");
    expect(certificateView({ ...base, signatureValid: false })).toEqual({ state: "INVALID_SIGNATURE", title: "La firma no coincide: este certificado no es válido" });
  });
  it("una reserva no es un certificado", () => expect(certificateView({ ...base, status: "RESERVED" }).state).toBe("INVALID_SIGNATURE"));
});

describe("XMP", () => {
  it("escapa y lleva el bloque propio", () => {
    const x = xmpPacket({
      title: "Sol & <luna>", creator: "Ana \"la\" O'Brien", rights: "© 2026 Ana", webStatement: "https://muestrasfotograficas.com/verificar/ABCDEFGHJKMN",
      code: "ABCDEFGHJKMN", edition: "3/10", originalSha256: "a".repeat(64), kid: "mf-2026-10", signature: "c2ln",
    });
    expect(x).toContain("Sol &amp; &lt;luna&gt;");
    expect(x).toContain("Ana &quot;la&quot; O&apos;Brien");
    expect(x).not.toContain("<luna>");
    expect(x).toContain('xmlns:mf="https://muestrasfotograficas.com/ns/certificado/1.0/"');
    expect(x).toContain("<mf:code>ABCDEFGHJKMN</mf:code>");
    expect(x).toContain("<xmpRights:WebStatement>https://muestrasfotograficas.com/verificar/ABCDEFGHJKMN</xmpRights:WebStatement>");
    expect(x.startsWith("<?xpacket")).toBe(true);
  });
});
