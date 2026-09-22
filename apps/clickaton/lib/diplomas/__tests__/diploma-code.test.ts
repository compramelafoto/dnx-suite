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
