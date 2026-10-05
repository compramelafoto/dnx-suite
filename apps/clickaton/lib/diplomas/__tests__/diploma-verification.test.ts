import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeRouteToken,
  resolveDiplomaVerification,
} from "@/lib/diplomas/diploma-verification";

const issue = {
  diplomaCode: "DIP-CK1-0042",
  issuedAt: new Date("2026-09-22T12:00:00Z"),
  revokedAt: null as Date | null,
  registration: { firstName: "Ana", lastName: "Pérez" },
  edition: { name: "1ª Edición", startAt: new Date("2026-09-19T19:00:00Z") },
};

describe("resolveDiplomaVerification", () => {
  it("muestra el diploma válido", async () => {
    const out = await resolveDiplomaVerification("tok", { loadIssue: async () => issue });
    assert.equal(out.state, "VALID");
    assert.equal(out.state === "VALID" && out.participantName, "Ana Pérez");
  });

  it("dice que no existe con un token desconocido", async () => {
    const out = await resolveDiplomaVerification("nope", { loadIssue: async () => null });
    assert.equal(out.state, "NOT_FOUND");
  });

  it("muestra el estado revocado", async () => {
    const out = await resolveDiplomaVerification("tok", {
      loadIssue: async () => ({ ...issue, revokedAt: new Date("2026-09-23T00:00:00Z") }),
    });
    assert.equal(out.state, "REVOKED");
  });

  it("no expone datos de contacto", async () => {
    const out = await resolveDiplomaVerification("tok", { loadIssue: async () => issue });
    assert.ok(!JSON.stringify(out).includes("@"));
  });

  it("si la tabla de diplomas todavía no existe (migración pendiente), dice que no lo encuentra en vez de reventar", async () => {
    const missingTableError = Object.assign(new Error("The table `public.ClickatonDiplomaIssue` does not exist"), {
      code: "P2021",
    });
    const out = await resolveDiplomaVerification("tok", {
      loadIssue: async () => {
        throw missingTableError;
      },
    });
    assert.equal(out.state, "NOT_FOUND");
  });

  it("un error de base que no es 'tabla ausente' sigue reventando (no se lo traga)", async () => {
    await assert.rejects(
      resolveDiplomaVerification("tok", {
        loadIssue: async () => {
          throw new Error("la conexión a la base se cayó");
        },
      })
    );
  });
});

describe("normalizeRouteToken", () => {
  it("recorta espacios", () => {
    assert.equal(normalizeRouteToken("  tok  "), "tok");
  });

  it("da cadena vacía sin token", () => {
    assert.equal(normalizeRouteToken(undefined), "");
    assert.equal(normalizeRouteToken(null), "");
  });

  it("no revienta con un token con basura tipeada a mano (ej. %zz)", () => {
    // Next.js ya entrega el segmento de ruta decodificado; un segundo
    // decodeURIComponent sobre "%zz" tiraría URIError.
    assert.doesNotThrow(() => normalizeRouteToken("abc%zzdef"));
    assert.equal(normalizeRouteToken("abc%zzdef"), "abc%zzdef");
  });
});
