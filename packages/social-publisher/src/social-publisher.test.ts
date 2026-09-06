import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCaption,
  createInMemorySocialPublisherStore,
  createInstagramPublishProvider,
  createSocialPublisherEngine,
  decryptSecret,
  encodeSocialMasterKeyForTest,
  encryptSecret,
  isDue,
  nextRetryAt,
  planSchedule,
  SocialPublisherError,
} from "./test-helpers";

// re-export helpers from test-helpers that wrap real modules

test("PublishRequest + approval flow", () => {
  const store = createInMemorySocialPublisherStore();
  store.accounts.set("acc1", {
    id: "acc1",
    platform: "INSTAGRAM",
    ownerUserId: 1,
    externalAccountId: "178414000",
    businessId: null,
    username: "clickaton",
    displayName: "Clickatón",
    scopes: ["instagram_content_publish"],
    status: "ACTIVE",
    expiresAt: null,
    lastValidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  store.tokens.set("acc1", "token");
  const providers = new Map([["INSTAGRAM", createInstagramPublishProvider()]]);
  const eng = createSocialPublisherEngine(store, providers, { livePublish: false });

  const req = eng.createRequest({
    application: "CLICKATON",
    entityType: "WELCOME_CARD",
    entityId: "card1",
    caption: "¡Bienvenido!",
    hashtags: ["clickaton"],
    assets: [
      {
        assetId: "a1",
        kind: "IMAGE",
        publicUrl: "https://cdn.example.com/w.png",
      },
    ],
    target: { platform: "INSTAGRAM", socialAccountId: "acc1" },
    approvalRequired: true,
    idempotencyKey: "ck:welcome:card1",
  });
  assert.equal(req.status, "PENDING_APPROVAL");

  const again = eng.createRequest({
    application: "CLICKATON",
    entityType: "WELCOME_CARD",
    entityId: "card1",
    caption: "otro",
    assets: [{ assetId: "a1", kind: "IMAGE", publicUrl: "https://cdn.example.com/w.png" }],
    target: { platform: "INSTAGRAM", socialAccountId: "acc1" },
    idempotencyKey: "ck:welcome:card1",
  });
  assert.equal(again.id, req.id);

  const approved = eng.approve(req.id, 99);
  assert.equal(approved.status, "APPROVED");
  assert.equal(approved.approvedByUserId, 99);
});

test("scheduler reschedule cancel retry", async () => {
  const store = createInMemorySocialPublisherStore();
  store.accounts.set("acc1", {
    id: "acc1",
    platform: "INSTAGRAM",
    ownerUserId: 1,
    externalAccountId: "ig1",
    businessId: null,
    username: "u",
    displayName: "u",
    scopes: [],
    status: "ACTIVE",
    expiresAt: null,
    lastValidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  store.tokens.set("acc1", "t");
  const eng = createSocialPublisherEngine(
    store,
    new Map([["INSTAGRAM", createInstagramPublishProvider()]]),
    { livePublish: false },
  );
  const future = new Date(Date.now() + 86_400_000);
  let req = eng.createRequest({
    application: "CLICKATON",
    entityType: "WELCOME_CARD",
    entityId: "c2",
    caption: "hola",
    assets: [{ assetId: "a", kind: "IMAGE", publicUrl: "https://x.com/a.png" }],
    target: { platform: "INSTAGRAM", socialAccountId: "acc1" },
    scheduleAt: future,
    approvalRequired: true,
    idempotencyKey: "k2",
  });
  req = eng.approve(req.id, 1);
  assert.equal(req.status, "SCHEDULED");
  req = eng.schedule(req.id, new Date(Date.now() - 1000));
  assert.equal(req.status, "APPROVED");
  req = await eng.processOne(req.id);
  assert.equal(req.status, "PUBLISHED");
  assert.ok(req.permalink?.includes("instagram.com"));
  assert.equal(store.attempts[0]?.dryRun, true);

  const dup = eng.duplicate(req.id);
  assert.equal(dup.status, "PENDING_APPROVAL");
  eng.cancel(dup.id);
  assert.equal(eng.list({ status: "CANCELLED" }).length, 1);
});

test("reject + invalid transitions", () => {
  const store = createInMemorySocialPublisherStore();
  store.accounts.set("acc1", {
    id: "acc1",
    platform: "INSTAGRAM",
    ownerUserId: 1,
    externalAccountId: "ig1",
    businessId: null,
    username: "u",
    displayName: null,
    scopes: [],
    status: "ACTIVE",
    expiresAt: null,
    lastValidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const eng = createSocialPublisherEngine(
    store,
    new Map([["INSTAGRAM", createInstagramPublishProvider()]]),
  );
  const req = eng.createRequest({
    application: "FOTORANK",
    entityType: "POSTER",
    entityId: "p1",
    caption: "x",
    assets: [{ assetId: "a", kind: "IMAGE", publicUrl: "https://x.com/a.png" }],
    target: { platform: "INSTAGRAM", socialAccountId: "acc1" },
    idempotencyKey: "k3",
  });
  eng.reject(req.id, 2, "no");
  assert.equal(store.requests.get(req.id)!.status, "REJECTED");
  assert.throws(() => eng.approve(req.id, 1), (e: unknown) => e instanceof SocialPublisherError);
});

test("instagram adapter dry-run requires url", async () => {
  const provider = createInstagramPublishProvider();
  await assert.rejects(
    () =>
      provider.publish({
        account: {
          id: "a",
          platform: "INSTAGRAM",
          ownerUserId: 1,
          externalAccountId: "ig",
          businessId: null,
          username: null,
          displayName: null,
          scopes: [],
          status: "ACTIVE",
          expiresAt: null,
          lastValidatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        accessToken: "x",
        caption: "c",
        assets: [{ assetId: "1", kind: "IMAGE", publicUrl: null }],
        dryRun: true,
      }),
    (e: unknown) => e instanceof SocialPublisherError && e.code === "ASSET_URL_REQUIRED",
  );
});

test("scheduling helpers + caption + vault", () => {
  assert.equal(planSchedule({}).mode, "IMMEDIATE");
  assert.equal(planSchedule({ scheduleAt: new Date(Date.now() + 10_000) }).mode, "SCHEDULED");
  assert.equal(isDue(new Date(Date.now() - 1)), true);
  assert.ok(nextRetryAt(0));
  assert.equal(nextRetryAt(99), null);
  assert.ok(buildCaption({ caption: "Hola", hashtags: ["a"], mentions: ["b"] }).includes("#a"));

  const key = encodeSocialMasterKeyForTest();
  const enc = encryptSecret("super-secret-token", key);
  assert.notEqual(enc.ciphertext, "super-secret-token");
  assert.equal(decryptSecret(enc, key), "super-secret-token");
});

test("no auto publish from PENDING_APPROVAL", async () => {
  const store = createInMemorySocialPublisherStore();
  store.accounts.set("acc1", {
    id: "acc1",
    platform: "INSTAGRAM",
    ownerUserId: 1,
    externalAccountId: "ig",
    businessId: null,
    username: null,
    displayName: null,
    scopes: [],
    status: "ACTIVE",
    expiresAt: null,
    lastValidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  store.tokens.set("acc1", "t");
  const eng = createSocialPublisherEngine(
    store,
    new Map([["INSTAGRAM", createInstagramPublishProvider()]]),
    { livePublish: false },
  );
  eng.createRequest({
    application: "CLICKATON",
    entityType: "WELCOME_CARD",
    entityId: "c",
    caption: "c",
    assets: [{ assetId: "a", kind: "IMAGE", publicUrl: "https://x.com/a.png" }],
    target: { platform: "INSTAGRAM", socialAccountId: "acc1" },
    idempotencyKey: "pending-only",
  });
  const n = await eng.processDue();
  assert.equal(n, 0);
  assert.equal(eng.list({ status: "PENDING_APPROVAL" }).length, 1);
});

test("el motor pasa formato y colaboradores desde metadata", async () => {
  const store = createInMemorySocialPublisherStore();
  store.accounts.set("acc1", {
    id: "acc1",
    platform: "INSTAGRAM",
    ownerUserId: 1,
    externalAccountId: "178414000",
    businessId: null,
    username: "clf",
    displayName: "CLF",
    scopes: ["instagram_business_content_publish"],
    status: "ACTIVE",
    expiresAt: null,
    lastValidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  store.tokens.set("acc1", "token");

  // Envuelto en un objeto: si fuera un `let` reasignado dentro del closure de
  // `publish`, tsc lo termina angostando a `never` en el uso de más abajo
  // (limitación conocida del control-flow narrowing con closures).
  const recibido: { current: { format?: string; collaborators?: string[] } | null } = {
    current: null,
  };
  const providers = new Map([
    [
      "INSTAGRAM" as const,
      {
        platform: "INSTAGRAM" as const,
        async publish(input: { format?: string; collaborators?: string[] }) {
          recibido.current = { format: input.format, collaborators: input.collaborators };
          return {
            ok: true as const,
            dryRun: true,
            externalMediaId: "m1",
            externalPostId: "p1",
            permalink: null,
            providerRawSanitized: {},
          };
        },
      },
    ],
  ]);
  const eng = createSocialPublisherEngine(store, providers as never, {
    livePublish: false,
  });

  const req = eng.createRequest({
    application: "COMPRAMELAFOTO",
    entityType: "ALBUM",
    entityId: "42",
    caption: "Álbum nuevo",
    assets: [
      { assetId: "a1", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/1.jpg" },
      { assetId: "a2", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/2.jpg" },
    ],
    target: { platform: "INSTAGRAM", socialAccountId: "acc1" },
    idempotencyKey: "clf:album-carousel:42",
    metadata: { format: "CAROUSEL", collaborators: ["fotografo"] },
  });
  eng.approve(req.id, 1);
  await eng.processDue(new Date());

  assert.equal(recibido.current?.format, "CAROUSEL");
  assert.deepEqual(recibido.current?.collaborators, ["fotografo"]);
});
