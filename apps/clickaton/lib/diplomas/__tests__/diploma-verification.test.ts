import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDiplomaVerification } from "@/lib/diplomas/diploma-verification";

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
});
