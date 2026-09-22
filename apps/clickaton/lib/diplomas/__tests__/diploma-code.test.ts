import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDiplomaCode, generateVerificationToken } from "@/lib/diplomas/diploma-code";

describe("buildDiplomaCode", () => {
  it("usa el código visible del participante, con la edición adelante", () => {
    const code = buildDiplomaCode({
      visibleCode: "CK1-0042",
      registrationId: "reg_x",
      editionId: "ed_1",
    });
    assert.match(code, /^DIP-[A-Z0-9]{6}-CK1-0042$/);
  });

  it("cae a la huella de la inscripción si no hay código visible", () => {
    const code = buildDiplomaCode({
      visibleCode: null,
      registrationId: "cms78cthj0000xpc4841bihf4",
      editionId: "ed_1",
    });
    assert.match(code, /^DIP-[A-Z0-9]{6}-[A-Z0-9]{6}$/);
  });

  it("dos ediciones con el MISMO código visible dan códigos distintos", () => {
    // Es el choque real que motivó el cambio: el prefijo visible por defecto
    // es "CK" para todas las ediciones y se copia al clonar una, así que el
    // participante 1 de la 2ª edición tiene el mismo código visible que el
    // de la 1ª. El índice único de `diplomaCode` es global.
    const primera = buildDiplomaCode({
      visibleCode: "CK-0001",
      registrationId: "reg_a",
      editionId: "ed_primera",
    });
    const segunda = buildDiplomaCode({
      visibleCode: "CK-0001",
      registrationId: "reg_b",
      editionId: "ed_segunda",
    });
    assert.notEqual(primera, segunda);
  });

  it("la misma edición siempre produce la misma huella", () => {
    const a = buildDiplomaCode({ visibleCode: "CK-0001", registrationId: "r1", editionId: "ed_1" });
    const b = buildDiplomaCode({ visibleCode: "CK-0002", registrationId: "r2", editionId: "ed_1" });
    assert.equal(a.slice(0, 10), b.slice(0, 10));
  });

  it("no depende del slug de la edición, que se puede editar", () => {
    // Mismo id de edición: el código no cambia aunque la edición se renombre.
    const a = buildDiplomaCode({ visibleCode: "CK-0001", registrationId: "r1", editionId: "ed_1" });
    const b = buildDiplomaCode({ visibleCode: "CK-0001", registrationId: "r1", editionId: "ed_1" });
    assert.equal(a, b);
  });

  it("dos ids cortos distintos dan códigos distintos", () => {
    const a = buildDiplomaCode({ visibleCode: null, registrationId: "a", editionId: "ed_1" });
    const b = buildDiplomaCode({ visibleCode: null, registrationId: "a0000", editionId: "ed_1" });
    assert.notEqual(a, b);
  });

  it("el mismo id llamado dos veces da el mismo código", () => {
    const input = { visibleCode: null, registrationId: "abc123xyz", editionId: "ed_1" };
    assert.equal(buildDiplomaCode(input), buildDiplomaCode(input));
  });
});

describe("generateVerificationToken", () => {
  it("es aleatorio, no derivable de los datos del participante", () => {
    // La función no recibe datos del participante: eso garantiza
    // que no puede depender de ellos.
    const tokens = Array.from({ length: 50 }, () => generateVerificationToken());

    // Ningún token se repite
    const unique = new Set(tokens);
    assert.equal(unique.size, 50, "todos los tokens deben ser distintos");

    // Todos tienen longitud esperada
    tokens.forEach((token) => {
      assert.equal(token.length, 32, "cada token debe tener 32 caracteres (24 bytes en base64url)");
    });

    // Todos contienen solo caracteres seguros para URL
    const urlSafeRegex = /^[A-Za-z0-9_-]{32}$/;
    tokens.forEach((token) => {
      assert.match(token, urlSafeRegex, "debe ser seguro para URL");
    });

    // Ninguno contiene fragmentos predecibles de datos de participante
    // (probamos con "0042" como ejemplo de código visible)
    tokens.forEach((token) => {
      assert.ok(!token.includes("0042"), "no debe contener el código visible");
      // Probamos también que no contiene fragmentos de un id conocido
      assert.ok(!token.includes("cms78"), "no debe contener fragmentos del id");
    });
  });
});
