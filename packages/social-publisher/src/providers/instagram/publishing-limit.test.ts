import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchPublishingLimit, hasQuotaFor } from "./publishing-limit";

test("lee el cupo usado y el total", async () => {
  const fetchImpl = (async (input: string | URL) => {
    assert.ok(String(input).includes("/content_publishing_limit"));
    return new Response(
      JSON.stringify({ data: [{ quota_usage: 12, config: { quota_total: 100 } }] }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const limite = await fetchPublishingLimit("17841400000000000", "t", { fetchImpl });
  assert.deepEqual(limite, { used: 12, total: 100 });
});

test("si Meta no contesta el cupo, se asume disponible y no se frena la publicación", async () => {
  const fetchImpl = (async () =>
    new Response("{}", { status: 500 })) as unknown as typeof fetch;
  const limite = await fetchPublishingLimit("1", "t", { fetchImpl });
  assert.equal(limite, null);
});

test("hay cupo si entra lo que falta publicar", () => {
  assert.equal(hasQuotaFor({ used: 98, total: 100 }, 2), true);
  assert.equal(hasQuotaFor({ used: 99, total: 100 }, 2), false);
});

test("sin dato de cupo se deja pasar", () => {
  assert.equal(hasQuotaFor(null, 5), true);
});
