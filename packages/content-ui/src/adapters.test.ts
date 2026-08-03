import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContentMediaAdapter } from "./adapters";
import type { ContentMediaItem } from "./types";

describe("ContentMediaAdapter shape", () => {
  it("accepts an in-memory adapter implementation", async () => {
    const store: ContentMediaItem[] = [];
    const adapter: ContentMediaAdapter = {
      async listMedia() {
        return store;
      },
      async uploadMedia(file) {
        const item: ContentMediaItem = {
          id: store.length + 1,
          createdAt: new Date().toISOString(),
          title: file.name,
          altText: null,
          caption: null,
          filename: file.name,
          url: `memory://${file.name}`,
          mimeType: file.type || "image/jpeg",
          sizeBytes: file.size,
        };
        store.push(item);
        return item;
      },
      async updateMedia(id, meta) {
        const item = store.find((m) => m.id === id);
        if (!item) throw new Error("missing");
        Object.assign(item, meta);
        return item;
      },
      async deleteMedia(id) {
        const idx = store.findIndex((m) => m.id === id);
        if (idx >= 0) store.splice(idx, 1);
      },
      async uploadHero(file) {
        return { url: `memory-hero://${file.name}` };
      },
    };

    const fakeFile = { name: "a.jpg", type: "image/jpeg", size: 10 } as File;
    const uploaded = await adapter.uploadMedia(fakeFile);
    assert.equal(uploaded.filename, "a.jpg");
    assert.equal((await adapter.listMedia()).length, 1);
    const hero = await adapter.uploadHero?.(fakeFile);
    assert.equal(hero?.url, "memory-hero://a.jpg");
  });
});
