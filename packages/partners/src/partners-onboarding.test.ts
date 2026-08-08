import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PartnersDomainError,
  assertPartnerLogoUploadAllowed,
  assertPartnerUploadAllowed,
  createMemoryPartnersRepositoryWithAudit,
  createPartnersService,
  resolveOnboardingAdminStatus,
  type PartnerActor,
  type PartnerOnboardingDraft,
} from "./index";

const ops: PartnerActor = { userId: 1, isOpsAdmin: true };

function png1x1(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

function jpegTiny(): Uint8Array {
  // Minimal JPEG SOI + EOI (detectable as JPEG by magic bytes)
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
}

function webpTiny(): Uint8Array {
  const buf = new Uint8Array(12);
  buf.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  buf.set([0x00, 0x00, 0x00, 0x00], 4);
  buf.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return buf;
}

describe("partner logo MIME (PNG/WEBP only for new logos)", () => {
  it("accepts PNG and WEBP logos", () => {
    assert.equal(assertPartnerLogoUploadAllowed({ buffer: png1x1() }).mime, "image/png");
    assert.equal(assertPartnerLogoUploadAllowed({ buffer: webpTiny() }).mime, "image/webp");
  });

  it("rejects JPEG/JPG for logos but still allows as general image asset", () => {
    assert.throws(
      () => assertPartnerLogoUploadAllowed({ buffer: jpegTiny() }),
      (err: unknown) => err instanceof PartnersDomainError,
    );
    assert.equal(assertPartnerUploadAllowed({ buffer: jpegTiny() }).mime, "image/jpeg");
  });

  it("rejects SVG and MIME spoof (JPEG bytes named png)", () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    assert.throws(() => assertPartnerLogoUploadAllowed({ buffer: svg }));
    assert.throws(() =>
      assertPartnerLogoUploadAllowed({
        buffer: jpegTiny(),
        declaredMime: "image/png",
        declaredExtension: "png",
      }),
    );
  });

  it("rejects oversized logos", () => {
    const big = new Uint8Array(11 * 1024 * 1024);
    big.set(png1x1(), 0);
    assert.throws(() =>
      assertPartnerLogoUploadAllowed({
        buffer: big,
        limits: {
          imageMaxBytes: 20 * 1024 * 1024,
          logoMaxBytes: 10 * 1024 * 1024,
          svgMaxBytes: 5 * 1024 * 1024,
          pdfMaxBytes: 30 * 1024 * 1024,
          videoMaxBytes: 250 * 1024 * 1024,
        },
      }),
    );
  });
});

describe("partner onboarding invitation", () => {
  it("creates invitation with raw token once; invalid/expired/revoked blocked", async () => {
    const repo = createMemoryPartnersRepositoryWithAudit();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, { name: "Acme Prospect", status: "PROSPECT" });

    const { invitation, rawToken } = await svc.createOnboardingInvitation(ops, {
      partnerId: partner.id,
      expiresInDays: 14,
    });
    assert.equal(invitation.status, "PENDING");
    assert.ok(rawToken.length >= 32);
    assert.equal(
      (invitation as { tokenHash?: string }).tokenHash,
      undefined,
      "tokenHash no debe exponerse al cliente",
    );

    const opened = await svc.openOnboardingInvitation(rawToken);
    assert.equal(opened.partner.id, partner.id);
    assert.equal(opened.invitation.status, "OPENED");

    await assert.rejects(() => svc.openOnboardingInvitation("deadbeef"), PartnersDomainError);

    const created2 = await svc.createOnboardingInvitation(ops, {
      partnerId: partner.id,
    });
    await svc.revokeOnboardingInvitation(ops, created2.invitation.id);
    await assert.rejects(
      () => svc.openOnboardingInvitation(created2.rawToken),
      PartnersDomainError,
    );

    const created3 = await svc.createOnboardingInvitation(ops, {
      partnerId: partner.id,
      expiresInDays: 14,
    });
    await repo.updateOnboardingInvitation(created3.invitation.id, {
      expiresAt: new Date(Date.now() - 1000),
    });
    await assert.rejects(
      () => svc.openOnboardingInvitation(created3.rawToken),
      PartnersDomainError,
    );
  });

  it("submit saves data, does not publish, keeps prospect, blocks second submit", async () => {
    const repo = createMemoryPartnersRepositoryWithAudit();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, { name: "Prospect Co", status: "PROSPECT" });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "edition-1",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
    });

    const logo = await svc.createPartnerAsset(ops, {
      partnerId: partner.id,
      type: "LOGO_PRIMARY",
      name: "Logo principal",
      storageKey: "partners/x/logo.png",
      fileUrl: "https://cdn.example/logo.png",
      mimeType: "image/png",
    });

    const { rawToken } = await svc.createOnboardingInvitation(ops, {
      partnerId: partner.id,
      participationId: participation.id,
    });

    const draft: PartnerOnboardingDraft = {
      company: {
        name: "Prospect Co SA",
        websiteUrl: "https://prospect.example",
        destinationUrl: "https://prospect.example",
        country: "AR",
      },
      contact: {
        firstName: "Ana",
        email: "ana@prospect.example",
        emailIsPublic: false,
        phoneIsPublic: false,
      },
      logos: [{ assetId: logo.id, type: "LOGO_PRIMARY" }],
      consents: { authority: true, brandUsage: true, marketing: false },
    };

    const result = await svc.submitOnboardingInvitation(rawToken, draft);
    assert.equal(result.reviewStatus, "PENDING_REVIEW");

    // Submit NO aplica ni publica: partner queda igual hasta approve.
    const afterSubmit = await svc.getPartner(ops, partner.id);
    assert.equal(afterSubmit.status, "PROSPECT");
    assert.equal(afterSubmit.name, "Prospect Co");
    assert.equal((await svc.listContacts(ops, partner.id)).length, 0);

    const parts = await svc.listParticipations(ops, partner.id);
    const partAfter = parts.find((p) => p.id === participation.id);
    assert.ok(partAfter);
    assert.equal(partAfter.publicVisibility, "HIDDEN");
    assert.equal(partAfter.status, "CONFIRMED");
    assert.equal(partAfter.destinationUrl, null);

    await assert.rejects(
      () => svc.submitOnboardingInvitation(rawToken, draft),
      PartnersDomainError,
    );

    await svc.reviewOnboardingSubmission(ops, {
      invitationId: result.invitationId,
      action: "APPROVE_DATA",
    });
    await svc.reviewOnboardingSubmission(ops, {
      invitationId: result.invitationId,
      action: "APPROVE_LOGOS",
      logoAssetIds: [logo.id],
    });

    const logoAfter = (await svc.listPartnerAssets(ops, partner.id)).find((a) => a.id === logo.id);
    assert.equal(logoAfter?.approvalStatus, "APPROVED");

    const still = await svc.getPartner(ops, partner.id);
    assert.equal(still.status, "PROSPECT");
    assert.equal(still.name, "Prospect Co SA");
    const contacts = await svc.listContacts(ops, partner.id);
    assert.equal(contacts[0]?.emailIsPublic, false);
    const partApproved = (await svc.listParticipations(ops, partner.id)).find(
      (p) => p.id === participation.id,
    );
    assert.equal(partApproved?.destinationUrl, "https://prospect.example/");
    assert.equal(partApproved?.publicVisibility, "HIDDEN");

    const adminStatus = resolveOnboardingAdminStatus(
      await svc.listOnboardingInvitations(ops, partner.id),
    );
    assert.equal(adminStatus, "COMPLETE");
  });

  it("blocks cross-partner upload via token resolve", async () => {
    const repo = createMemoryPartnersRepositoryWithAudit();
    const svc = createPartnersService(repo);
    const a = await svc.createPartner(ops, { name: "Partner Alpha" });
    const b = await svc.createPartner(ops, { name: "Partner Beta" });
    const { rawToken } = await svc.createOnboardingInvitation(ops, { partnerId: a.id });
    const resolved = await svc.resolvePartnerIdForOnboardingToken(rawToken);
    assert.equal(resolved.partnerId, a.id);
    assert.notEqual(resolved.partnerId, b.id);
  });
});
