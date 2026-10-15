import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHiddenSelfieDeletionPath,
  getHiddenSelfieDeletionSecret,
  signHiddenSelfieDeletionToken,
  verifyHiddenSelfieDeletionToken,
} from "@/lib/hidden-album-selfie-deletion";

const SECRET = "secreto-de-prueba";
const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);
const EXP = NOW + 7 * 24 * 3600 * 1000;
const ATTEMPT = "6f1c2c4e-1111-4222-8333-944455556666";

function firmar(overrides: Partial<{ attemptId: string; albumId: number; expiresAtMs: number; secret: string }> = {}) {
  return signHiddenSelfieDeletionToken({ attemptId: ATTEMPT, albumId: 10, expiresAtMs: EXP, secret: SECRET, ...overrides });
}

describe("enlace de borrado de la selfie", () => {
  it("token válido", () => {
    assert.deepEqual(verifyHiddenSelfieDeletionToken(firmar(), { secret: SECRET, albumId: 10, nowMs: NOW }), {
      attemptId: ATTEMPT,
      albumId: 10,
      expiresAtMs: EXP,
    });
  });

  it("token adulterado (cambio de intento con la firma vieja)", () => {
    const decoded = Buffer.from(firmar(), "base64url").toString("utf-8");
    const tampered = Buffer.from(decoded.replace(ATTEMPT, "otro-intento"), "utf-8").toString("base64url");
    assert.equal(verifyHiddenSelfieDeletionToken(tampered, { secret: SECRET, albumId: 10, nowMs: NOW }), null);
  });

  it("token con la firma alterada", () => {
    const decoded = Buffer.from(firmar(), "base64url").toString("utf-8");
    const last = decoded.slice(-1) === "0" ? "1" : "0";
    const tampered = Buffer.from(decoded.slice(0, -1) + last, "utf-8").toString("base64url");
    assert.equal(verifyHiddenSelfieDeletionToken(tampered, { secret: SECRET, albumId: 10, nowMs: NOW }), null);
  });

  it("token de otro álbum no sirve", () => {
    assert.equal(verifyHiddenSelfieDeletionToken(firmar({ albumId: 11 }), { secret: SECRET, albumId: 10, nowMs: NOW }), null);
  });

  it("cada intento tiene su propio token (no intercambiables)", () => {
    const a = firmar();
    const b = firmar({ attemptId: "otro-intento" });
    assert.notEqual(a, b);
    assert.equal(verifyHiddenSelfieDeletionToken(b, { secret: SECRET, albumId: 10, nowMs: NOW })!.attemptId, "otro-intento");
  });

  it("firmado con otro secreto no sirve", () => {
    assert.equal(verifyHiddenSelfieDeletionToken(firmar({ secret: "otro" }), { secret: SECRET, albumId: 10, nowMs: NOW }), null);
  });

  it("vencido no sirve", () => {
    assert.equal(verifyHiddenSelfieDeletionToken(firmar(), { secret: SECRET, albumId: 10, nowMs: EXP + 1 }), null);
  });

  it("basura y tokens de otro flujo (interesados) no sirven", () => {
    for (const t of ["", "xyz", Buffer.from("10:mail@x.com:999999999999999:abc").toString("base64url")]) {
      assert.equal(verifyHiddenSelfieDeletionToken(t, { secret: SECRET, albumId: 10, nowMs: NOW }), null);
    }
  });

  it("sin secreto configurado no se ofrece enlace (nunca un literal por defecto)", () => {
    assert.equal(getHiddenSelfieDeletionSecret({} as NodeJS.ProcessEnv), null);
    assert.equal(getHiddenSelfieDeletionSecret({ CRON_SECRET: "  " } as unknown as NodeJS.ProcessEnv), null);
    assert.equal(getHiddenSelfieDeletionSecret({ CRON_SECRET: "c" } as unknown as NodeJS.ProcessEnv), "c");
    assert.equal(
      getHiddenSelfieDeletionSecret({ BIOMETRIC_DELETION_SECRET: "b", CRON_SECRET: "c" } as unknown as NodeJS.ProcessEnv),
      "b",
    );
  });

  it("ruta del enlace", () => {
    assert.equal(buildHiddenSelfieDeletionPath(10, "a b"), "/api/albums/10/hidden/selfie/delete?token=a%20b");
  });
});
