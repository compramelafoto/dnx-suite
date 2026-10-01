import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryAffiliateConsentRepository } from "./in-memory-affiliate-consent-repository";
import {
  DNX_COLLECTOR_PROVIDER_USER_ID,
  getActiveSplitReceiver,
  inviteAffiliate,
  refreshAffiliateConsent,
  type AffiliateConsentProviderPort,
  type AffiliateConsentRecord,
} from "./split-consent";

const RECEIVER_UUID = "3f2b8c1e-6a4d-4e2f-9b1a-7c5d2e8f0a11";
const NOW = new Date("2026-10-01T15:00:00.000Z");

function affiliate(overrides: Partial<AffiliateConsentRecord> = {}): AffiliateConsentRecord {
  return {
    id: "af_1",
    userId: 42,
    displayName: "Ana Fotógrafa",
    mpSellerEmail: "Ana@Example.com ",
    paymentRecipientId: null,
    consentReceiverId: null,
    consentStatus: "NONE",
    consentInviteUrl: null,
    isActive: true,
    ...overrides,
  };
}

function fakeProvider(opts: {
  inviteStatus?: string;
  consentStatus?: string | null;
  inviteThrows?: Error;
} = {}) {
  const calls = {
    invite: [] as Parameters<AffiliateConsentProviderPort["invite"]>[0][],
    getConsent: [] as string[],
  };
  const provider: AffiliateConsentProviderPort = {
    async invite(input) {
      calls.invite.push(input);
      if (opts.inviteThrows) throw opts.inviteThrows;
      return input.sellerEmails.map((sellerEmail) => ({
        sellerEmail,
        receiverId: RECEIVER_UUID,
        status: opts.inviteStatus ?? "pending",
        inviteUrl: "https://mp.example/invite/abc",
      }));
    },
    async getConsent(receiverId) {
      calls.getConsent.push(receiverId);
      if (opts.consentStatus === null) return null;
      return { receiverId, status: opts.consentStatus ?? "ACTIVE" };
    },
  };
  return { provider, calls };
}

test("invitar guarda el receptor UUID, PENDING y el link; crea receptor y permiso", async () => {
  const repo = createInMemoryAffiliateConsentRepository([affiliate()]);
  const { provider, calls } = fakeProvider();

  const result = await inviteAffiliate("af_1", {
    provider,
    repo,
    now: () => NOW,
    newIdempotencyKey: () => "11111111-1111-4111-8111-111111111111",
  });

  assert.deepEqual(result, {
    ok: true,
    state: "PENDING",
    inviteUrl: "https://mp.example/invite/abc",
  });
  assert.deepEqual(calls.invite, [
    {
      environment: "production",
      sellerEmails: ["ana@example.com"],
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    },
  ]);

  const saved = repo.affiliates.get("af_1");
  assert.equal(saved?.consentReceiverId, RECEIVER_UUID);
  assert.equal(saved?.consentStatus, "PENDING");
  assert.equal(saved?.consentInviteUrl, "https://mp.example/invite/abc");
  assert.ok(saved?.paymentRecipientId);

  assert.deepEqual(repo.recipients.get(saved.paymentRecipientId), {
    userId: 42,
    recipientType: "AFFILIATE",
  });
  assert.deepEqual(repo.splitConsents.get(RECEIVER_UUID), {
    providerReceiverId: RECEIVER_UUID,
    recipientId: saved.paymentRecipientId,
    status: "PENDING",
    invitationReference: "https://mp.example/invite/abc",
    primaryProviderAccountReference: DNX_COLLECTOR_PROVIDER_USER_ID,
    checkedAt: NOW,
  });
});

test("la clave de idempotencia por defecto es un UUID v4", async () => {
  const repo = createInMemoryAffiliateConsentRepository([affiliate()]);
  const { provider, calls } = fakeProvider();
  await inviteAffiliate("af_1", { provider, repo });
  assert.match(
    calls.invite[0]?.idempotencyKey ?? "",
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test("reinvitar no duplica el receptor de pagos", async () => {
  const repo = createInMemoryAffiliateConsentRepository([affiliate()]);
  const { provider } = fakeProvider();
  await inviteAffiliate("af_1", { provider, repo });
  await inviteAffiliate("af_1", { provider, repo });
  assert.equal(repo.recipients.size, 1);
  assert.equal(repo.splitConsents.size, 1);
});

test("si MP rechaza la invitación no se guarda nada", async () => {
  const repo = createInMemoryAffiliateConsentRepository([affiliate()]);
  const { provider } = fakeProvider({
    inviteThrows: new Error("Split consent invite not allowed: PRODUCTION_FLAG_OFF"),
  });
  const result = await inviteAffiliate("af_1", { provider, repo });
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : "", /DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED/);
  assert.equal(repo.affiliates.get("af_1")?.consentReceiverId, null);
  assert.equal(repo.splitConsents.size, 0);
});

test("no invita a un afiliado desactivado", async () => {
  const repo = createInMemoryAffiliateConsentRepository([affiliate({ isActive: false })]);
  const { provider, calls } = fakeProvider();
  const result = await inviteAffiliate("af_1", { provider, repo });
  assert.equal(result.ok, false);
  assert.equal(calls.invite.length, 0);
});

test("refrescar consulta por el UUID del receptor, no por el id numérico", async () => {
  const repo = createInMemoryAffiliateConsentRepository([affiliate()]);
  const { provider, calls } = fakeProvider({ consentStatus: "active" });
  await inviteAffiliate("af_1", { provider, repo });

  const result = await refreshAffiliateConsent("af_1", { provider, repo, now: () => NOW });

  assert.deepEqual(calls.getConsent, [RECEIVER_UUID]);
  assert.notEqual(calls.getConsent[0], DNX_COLLECTOR_PROVIDER_USER_ID);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.state, "ACTIVE");
  assert.equal(repo.affiliates.get("af_1")?.consentStatus, "ACTIVE");
  assert.equal(repo.splitConsents.get(RECEIVER_UUID)?.status, "ACTIVE");
  // El link de la invitación se conserva aunque la consulta no lo traiga.
  assert.equal(repo.affiliates.get("af_1")?.consentInviteUrl, "https://mp.example/invite/abc");
});

test("refrescar sin invitación previa no consulta a MP", async () => {
  const repo = createInMemoryAffiliateConsentRepository([affiliate()]);
  const { provider, calls } = fakeProvider();
  const result = await refreshAffiliateConsent("af_1", { provider, repo });
  assert.equal(result.ok, false);
  assert.equal(calls.getConsent.length, 0);
});

test("si MP no encuentra el permiso, no se pisa el estado guardado", async () => {
  const repo = createInMemoryAffiliateConsentRepository([affiliate()]);
  const { provider } = fakeProvider({ consentStatus: null });
  await inviteAffiliate("af_1", { provider, repo });
  const result = await refreshAffiliateConsent("af_1", { provider, repo });
  assert.equal(result.ok, false);
  assert.equal(repo.affiliates.get("af_1")?.consentStatus, "PENDING");
});

test("el receptor para repartir sólo existe con el permiso ACTIVO", async () => {
  for (const status of ["pending", "rejected", "canceled", "expired", "raro"]) {
    const repo = createInMemoryAffiliateConsentRepository([affiliate()]);
    const { provider } = fakeProvider({ inviteStatus: "pending", consentStatus: status });
    await inviteAffiliate("af_1", { provider, repo });
    await refreshAffiliateConsent("af_1", { provider, repo });
    assert.equal(await getActiveSplitReceiver("af_1", { repo }), null, status);
  }

  const repo = createInMemoryAffiliateConsentRepository([affiliate()]);
  const { provider } = fakeProvider({ consentStatus: "ACTIVE" });
  await inviteAffiliate("af_1", { provider, repo });
  await refreshAffiliateConsent("af_1", { provider, repo });
  const receiver = await getActiveSplitReceiver("af_1", { repo });
  assert.deepEqual(receiver, {
    receiverId: RECEIVER_UUID,
    recipientId: repo.affiliates.get("af_1")?.paymentRecipientId,
  });
});

test("sin receptor si el afiliado está desactivado o el permiso guardado no coincide", async () => {
  const repo = createInMemoryAffiliateConsentRepository([
    affiliate({
      consentStatus: "ACTIVE",
      consentReceiverId: RECEIVER_UUID,
      paymentRecipientId: "rcp_x",
    }),
  ]);
  // Ficha dice ACTIVE pero no hay DnxSplitConsent.
  assert.equal(await getActiveSplitReceiver("af_1", { repo }), null);

  repo.splitConsents.set(RECEIVER_UUID, {
    providerReceiverId: RECEIVER_UUID,
    recipientId: "rcp_x",
    status: "ACTIVE",
    invitationReference: null,
    primaryProviderAccountReference: DNX_COLLECTOR_PROVIDER_USER_ID,
    checkedAt: NOW,
  });
  assert.deepEqual(await getActiveSplitReceiver("af_1", { repo }), {
    receiverId: RECEIVER_UUID,
    recipientId: "rcp_x",
  });

  const current = repo.affiliates.get("af_1");
  assert.ok(current);
  repo.affiliates.set("af_1", { ...current, isActive: false });
  assert.equal(await getActiveSplitReceiver("af_1", { repo }), null);
});

test("si la base falla, no hay receptor (se paga a mano)", async () => {
  const repo = createInMemoryAffiliateConsentRepository();
  repo.findAffiliate = async () => {
    throw new Error('relation "ClickatonAffiliate" does not exist');
  };
  assert.equal(await getActiveSplitReceiver("af_1", { repo }), null);
});
