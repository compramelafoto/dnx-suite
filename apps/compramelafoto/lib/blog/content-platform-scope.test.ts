/**
 * CMS ETAPA 03 — tests de scope multiplataforma (sin DB staging).
 * Ejecutar:
 *   pnpm --filter @repo/payments exec tsx --tsconfig ../../apps/compramelafoto/tsconfig.json --test ../../apps/compramelafoto/lib/blog/content-platform-scope.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CLF_CONTENT_PLATFORM,
  CONTENT_PLATFORMS,
  clfPlatformWhere,
  isContentPlatform,
} from "./content-platform";

describe("content-platform constants", () => {
  it("CLF platform is lowercase compramelafoto", () => {
    assert.equal(CLF_CONTENT_PLATFORM, "compramelafoto");
    assert.equal(clfPlatformWhere.platform, "compramelafoto");
  });

  it("recognizes known content platforms", () => {
    for (const p of CONTENT_PLATFORMS) {
      assert.equal(isContentPlatform(p), true);
    }
    assert.equal(isContentPlatform("CLICKATON"), false);
    assert.equal(isContentPlatform("infospot"), false);
    assert.equal(isContentPlatform(""), false);
  });

  it("CONTENT_PLATFORMS includes expected suite brands", () => {
    assert.deepEqual([...CONTENT_PLATFORMS], [
      "compramelafoto",
      "clickaton",
      "fotorank",
      "fotoffice",
    ]);
  });
});

describe("clfPlatformWhere helper shape", () => {
  it("is usable in Prisma where spreads", () => {
    assert.deepEqual(clfPlatformWhere, { platform: "compramelafoto" });
    const merged = { ...clfPlatformWhere, status: "PUBLISHED" };
    assert.equal(merged.platform, CLF_CONTENT_PLATFORM);
    assert.equal(merged.status, "PUBLISHED");
  });
});

describe("requireBlogAdmin roles", () => {
  it("allows ADMIN and SUPER_ADMIN (aligned with /admin layout)", async () => {
    const { Role } = await import("@prisma/client");
    assert.equal(Role.ADMIN, "ADMIN");
    assert.equal(Role.SUPER_ADMIN, "SUPER_ADMIN");
    // Source contract (avoid loading Next.js auth graph in unit test):
    const src = readFileSync(fileURLToPath(new URL("./admin-route-utils.ts", import.meta.url)), "utf8");
    assert.match(src, /requireAuth\(\[Role\.ADMIN,\s*Role\.SUPER_ADMIN\]\)/);
  });
});

describe("client cannot set platform via parsers", () => {
  it("strips platform from category/tag/author/post payloads", async () => {
    const { parseBlogCategoryCreate, parseBlogCategoryUpdate } = await import(
      "./validate-blog-category"
    );
    const { parseBlogTagCreate } = await import("./validate-blog-tag");
    const { parseBlogAuthorCreate } = await import("./validate-blog-author");
    const { parseBlogPostCreate, parseBlogPostUpdate } = await import("./validate-blog-post");

    const categoryCreate = parseBlogCategoryCreate({
      name: "Guías de prueba",
      slug: "guias-de-prueba-platform",
      platform: "clickaton",
    });
    assert.equal(categoryCreate.success, true);
    if (categoryCreate.success) {
      assert.equal("platform" in categoryCreate.data, false);
    }

    const categoryUpdate = parseBlogCategoryUpdate({
      name: "Guías de prueba",
      platform: "fotorank",
    });
    assert.equal(categoryUpdate.success, true);
    if (categoryUpdate.success) {
      assert.equal("platform" in categoryUpdate.data, false);
    }

    const tag = parseBlogTagCreate({
      name: "Tag de prueba",
      slug: "tag-de-prueba-platform",
      platform: "clickaton",
    });
    assert.equal(tag.success, true);
    if (tag.success) {
      assert.equal("platform" in tag.data, false);
    }

    const author = parseBlogAuthorCreate({
      name: "Autor de prueba",
      slug: "autor-de-prueba-platform",
      platform: "fotoffice",
    });
    assert.equal(author.success, true);
    if (author.success) {
      assert.equal("platform" in author.data, false);
    }

    const contentJson = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hola" }] }],
    };
    const postCreate = parseBlogPostCreate({
      title: "Nota de prueba",
      slug: "nota-de-prueba-platform",
      contentJson,
      platform: "clickaton",
    });
    assert.equal(postCreate.success, true);
    if (postCreate.success) {
      assert.equal("platform" in postCreate.data, false);
    }

    const postUpdate = parseBlogPostUpdate({
      title: "Nota de prueba 2",
      platform: "fotorank",
    });
    assert.equal(postUpdate.success, true);
    if (postUpdate.success) {
      assert.equal("platform" in postUpdate.data, false);
    }
  });
});
