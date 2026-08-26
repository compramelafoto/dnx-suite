import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ContentError } from "./errors";
import { assertContentPlatform, platformWhere } from "./platform";
import { getPublishedPostBySlug, listPublishedPosts } from "./repository/public-queries";
import { deleteContentPost } from "./repository/persistence";
import { listAdminPosts } from "./repository/admin";
import { getContentSitemapEntries } from "./repository/sitemap";

describe("repository platform scope (entry assert)", () => {
  const fakePrisma = {} as never;

  it("public queries require valid platform", async () => {
    await assert.rejects(
      () => listPublishedPosts({ prisma: fakePrisma, platform: "infospot" as never }),
      (err: unknown) =>
        err instanceof ContentError && err.code === "CONTENT_PLATFORM_REQUIRED"
    );
    await assert.rejects(
      () =>
        getPublishedPostBySlug({
          prisma: fakePrisma,
          platform: undefined as never,
          slug: "x",
        }),
      (err: unknown) =>
        err instanceof ContentError && err.code === "CONTENT_PLATFORM_REQUIRED"
    );
  });

  it("admin/sitemap/delete require valid platform", async () => {
    await assert.rejects(
      () => listAdminPosts({ prisma: fakePrisma, platform: "CLICKATON" as never }),
      (err: unknown) =>
        err instanceof ContentError && err.code === "CONTENT_PLATFORM_REQUIRED"
    );
    await assert.rejects(
      () => getContentSitemapEntries({ prisma: fakePrisma, platform: "" as never }),
      (err: unknown) =>
        err instanceof ContentError && err.code === "CONTENT_PLATFORM_REQUIRED"
    );
    await assert.rejects(
      () =>
        deleteContentPost({
          prisma: fakePrisma,
          platform: null as never,
          postId: 1,
        }),
      (err: unknown) =>
        err instanceof ContentError && err.code === "CONTENT_PLATFORM_REQUIRED"
    );
  });

  it("platformWhere is the pure scope helper", () => {
    assert.deepEqual(platformWhere(assertContentPlatform("fotorank")), {
      platform: "fotorank",
    });
  });
});
