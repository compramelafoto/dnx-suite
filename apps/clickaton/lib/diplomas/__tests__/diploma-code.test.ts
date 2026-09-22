import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDiplomaCode, generateVerificationToken } from "@/lib/diplomas/diploma-code";

describe("buildDiplomaCode", () => {
  it("usa el código visible del participante cuando existe", () => {
    assert.equal(
      buildDiplomaCode({
        visibleCode: "CK1-0042",
        registrationId: "reg_x",
        editionSlug: "dia-del-fotografo-2026",
      }),
      "DIP-CK1-0042"
    );
  });

  it("cae al slug de la edición y al final del id si no hay código visible", () => {
    const code = buildDiplomaCode({
      visibleCode: null,
      registrationId: "cms78cthj0000xpc4841bihf4",
      editionSlug: "dia-del-fotografo-2026",
    });
    assert.match(code, /^DIP-DIADELF-[A-Z0-9]{6}$/);
  });

  it("no depende de un número de edición inexistente", () => {
    const a = buildDiplomaCode({ visibleCode: "CK1-0001", registrationId: "r1", editionSlug: "a" });
    const b = buildDiplomaCode({ visibleCode: "CK2-0001", registrationId: "r2", editionSlug: "b" });
    assert.notEqual(a, b);
  });
});

describe("generateVerificationToken", () => {
  it("es largo, aleatorio y seguro para una URL", () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    assert.notEqual(a, b);
    assert.ok(a.length >= 24);
    assert.match(a, /^[A-Za-z0-9_-]+$/);
  });

  it("no contiene el número de inscripción", () => {
    const token = generateVerificationToken();
    assert.ok(!token.includes("0042"));
  });
});
