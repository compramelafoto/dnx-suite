import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PARTNER_LOGO_MAX_BYTES,
  buildPartnerLogoKey,
  extensionForPartnerLogoMime,
  isPartnerLogoKey,
  resolvePartnerLogoStorage,
  validatePartnerLogoFile,
} from "./partner-logo-storage";

describe("validatePartnerLogoFile", () => {
  it("acepta PNG, JPG y WebP", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      assert.deepEqual(validatePartnerLogoFile({ type, size: 1024 }), { ok: true });
    }
  });

  it("rechaza SVG y otros formatos", () => {
    for (const type of ["image/svg+xml", "image/gif", "application/pdf", ""]) {
      const result = validatePartnerLogoFile({ type, size: 1024 });
      assert.equal(result.ok, false);
    }
  });

  it("rechaza archivos vacíos y los que superan 5 MB", () => {
    assert.equal(validatePartnerLogoFile({ type: "image/png", size: 0 }).ok, false);
    assert.equal(
      validatePartnerLogoFile({ type: "image/png", size: PARTNER_LOGO_MAX_BYTES + 1 }).ok,
      false
    );
    assert.equal(
      validatePartnerLogoFile({ type: "image/png", size: PARTNER_LOGO_MAX_BYTES }).ok,
      true
    );
  });
});

describe("claves de logo", () => {
  it("genera claves con fecha y uuid dentro del namespace", () => {
    const key = buildPartnerLogoKey("png", new Date("2026-08-25T10:00:00Z"));
    assert.match(key, /^clickaton\/partners\/logos\/2026-08-25\/[0-9a-f-]+\.png$/);
    assert.ok(isPartnerLogoKey(key));
  });

  it("rechaza claves de otros namespaces y traversal", () => {
    for (const key of [
      "clickaton/blog/hero/2026-08-25/a.png",
      "clickaton/partners/contratos/2026-08-25/a.pdf",
      "clickaton/partners/logos/2026-08-25/../../private/a.png",
      "",
    ]) {
      assert.equal(isPartnerLogoKey(key), false, `debería rechazar ${key}`);
    }
  });

  it("deriva la extensión del mime y cae al nombre del archivo", () => {
    assert.equal(extensionForPartnerLogoMime("image/jpeg"), "jpg");
    assert.equal(extensionForPartnerLogoMime("image/webp"), "webp");
    assert.equal(extensionForPartnerLogoMime("image/avif", "logo.avif"), "avif");
    assert.equal(extensionForPartnerLogoMime("desconocido"), "png");
  });
});

describe("resolvePartnerLogoStorage", () => {
  const R2_ENV = {
    R2_BUCKET_NAME: "bucket",
    R2_ENDPOINT: "https://r2.example.com",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
  };

  it("usa R2 cuando están las cuatro variables", () => {
    assert.equal(resolvePartnerLogoStorage(R2_ENV).kind, "r2");
  });

  it("cae a disco local sólo en desarrollo", () => {
    assert.equal(resolvePartnerLogoStorage({ NODE_ENV: "development" }).kind, "local");
  });

  it("no usa el filesystem efímero de Vercel sin R2", () => {
    for (const env of [
      { NODE_ENV: "development", VERCEL: "1" },
      { NODE_ENV: "development", VERCEL_ENV: "preview" },
      { NODE_ENV: "production" },
    ]) {
      const resolved = resolvePartnerLogoStorage(env);
      assert.equal(resolved.kind, "unavailable", JSON.stringify(env));
    }
  });

  it("R2 incompleto no se degrada en silencio a local en producción", () => {
    const resolved = resolvePartnerLogoStorage({
      NODE_ENV: "production",
      R2_BUCKET_NAME: "bucket",
      R2_ENDPOINT: "https://r2.example.com",
    });
    assert.equal(resolved.kind, "unavailable");
  });
});
