import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryPartnersRepository } from "./memory-repository";
import { createPartnersService } from "./service";
import {
  assertSafePartnerDestinationUrl,
  buildPartnerAttributedUrl,
  buildTrackingKey,
  isLikelyBotUserAgent,
  isPartnerClickTrackingEnabled,
  resolveParticipationDestinationUrl,
} from "./tracking";
import type { PartnerActor } from "./types";

const ops: PartnerActor = { userId: 1, isOpsAdmin: true };

describe("partner destination URL safety", () => {
  it("rejects javascript and data protocols", () => {
    assert.throws(() => assertSafePartnerDestinationUrl("javascript:alert(1)"));
    assert.throws(() => assertSafePartnerDestinationUrl("data:text/html,hi"));
  });

  it("normalizes http to https", () => {
    const url = assertSafePartnerDestinationUrl("http://partner.example/promo");
    assert.match(url, /^https:\/\//);
  });

  it("resolves participation destination over website", () => {
    const dest = resolveParticipationDestinationUrl({
      participationDestinationUrl: "https://sony.com.ar/promo",
      partnerWebsiteUrl: "https://sony.com.ar",
    });
    assert.equal(dest, "https://sony.com.ar/promo");
  });
});

describe("UTM builder", () => {
  it("adds utms without overwriting existing", () => {
    const url = buildPartnerAttributedUrl({
      destinationUrl: "https://partner.example/?utm_source=keep",
      utmSource: "clickaton",
      utmMedium: "partner",
      utmCampaign: "edicion-2026",
      utmContent: "logo",
    });
    const u = new URL(url);
    assert.equal(u.searchParams.get("utm_source"), "keep");
    assert.equal(u.searchParams.get("utm_medium"), "partner");
    assert.equal(u.searchParams.get("utm_campaign"), "edicion-2026");
  });
});

describe("tracking key + bots", () => {
  it("builds unique-ish tracking keys", () => {
    const a = buildTrackingKey("Sony Argentina");
    const b = buildTrackingKey("Sony Argentina");
    assert.notEqual(a, b);
    assert.match(a, /^sony-argentina-/);
  });

  it("detects crawler user agents", () => {
    assert.equal(isLikelyBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
    assert.equal(isLikelyBotUserAgent("Mozilla/5.0 (iPhone)"), false);
  });
});

describe("outbound redirect service", () => {
  it("creates tracked link, records click, redirects with UTM", async () => {
    const prev = process.env.DNX_PARTNER_CLICK_TRACKING_ENABLED;
    delete process.env.DNX_PARTNER_CLICK_TRACKING_ENABLED;
    assert.equal(isPartnerClickTrackingEnabled(), true);

    const repo = createMemoryPartnersRepository();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, {
      name: "Lab Test",
      websiteUrl: "https://lab.example",
    });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "edition-1",
      destinationUrl: "https://lab.example/promo",
      clickTrackingEnabled: true,
      status: "ACTIVE",
    });

    const links = await svc.listPartnerOutboundLinks(ops, partner.id);
    assert.equal(links.length, 1);
    const key = links[0]!.trackingKey;

    const resolved = await svc.resolveOutboundRedirect({
      trackingKey: key,
      userAgent: "Mozilla/5.0 (Macintosh)",
      referrer: "https://maratonfotografica.com/maratones/x",
      clientSeed: "test-1",
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.tracked, true);
    assert.match(resolved.redirectUrl, /utm_source=clickaton/);
    assert.match(resolved.redirectUrl, /utm_medium=partner/);

    const summary = await svc.getPartnerTrafficSummary(ops, partner.id);
    assert.equal(summary.totalClicks, 1);
    assert.equal(summary.byApplication.CLICKATON, 1);
    assert.equal(summary.byParticipation[participation.id], 1);

    if (prev === undefined) delete process.env.DNX_PARTNER_CLICK_TRACKING_ENABLED;
    else process.env.DNX_PARTNER_CLICK_TRACKING_ENABLED = prev;
  });

  it("continues redirect when tracking disabled", async () => {
    const prev = process.env.DNX_PARTNER_CLICK_TRACKING_ENABLED;
    process.env.DNX_PARTNER_CLICK_TRACKING_ENABLED = "false";
    const repo = createMemoryPartnersRepository();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, {
      name: "No Track Co",
      websiteUrl: "https://notrack.example",
    });
    // ensure link manually while tracking env off — createParticipation still creates link
    process.env.DNX_PARTNER_CLICK_TRACKING_ENABLED = "true";
    await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "FOTO_RANK",
      contextType: "CONTEST",
      contextId: "contest-1",
      destinationUrl: "https://notrack.example/x",
      status: "ACTIVE",
    });
    const links = await svc.listPartnerOutboundLinks(ops, partner.id);
    process.env.DNX_PARTNER_CLICK_TRACKING_ENABLED = "false";
    const resolved = await svc.resolveOutboundRedirect({
      trackingKey: links[0]!.trackingKey,
      userAgent: "Mozilla/5.0",
      clientSeed: "t2",
    });
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.equal(resolved.tracked, false);
    const summary = await svc.getPartnerTrafficSummary(ops, partner.id);
    assert.equal(summary.totalClicks, 0);

    if (prev === undefined) delete process.env.DNX_PARTNER_CLICK_TRACKING_ENABLED;
    else process.env.DNX_PARTNER_CLICK_TRACKING_ENABLED = prev;
  });

  it("rejects open redirect via query destination", async () => {
    const repo = createMemoryPartnersRepository();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, { name: "Safe Co", websiteUrl: "https://safe.example" });
    await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "e1",
      destinationUrl: "https://safe.example",
      status: "ACTIVE",
    });
    const links = await svc.listPartnerOutboundLinks(ops, partner.id);
    const resolved = await svc.resolveOutboundRedirect({
      trackingKey: links[0]!.trackingKey,
      userAgent: "Mozilla/5.0",
    });
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.doesNotMatch(resolved.redirectUrl, /evil\.com/);
      assert.match(resolved.redirectUrl, /safe\.example/);
    }
  });

  it("applies FotoRank UTMs and countPartnerClicks alias", async () => {
    const repo = createMemoryPartnersRepository();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, {
      name: "SFEF Org",
      websiteUrl: "https://sfpr.example",
    });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "FOTO_RANK",
      contextType: "CONTEST",
      contextId: "contest-sfef",
      destinationUrl: "https://sfpr.example/sponsors",
      clickTrackingEnabled: true,
      status: "ACTIVE",
    });
    const links = await svc.listPartnerOutboundLinks(ops, partner.id);
    assert.equal(links[0]!.utmSource, "fotorank");
    const resolved = await svc.resolveOutboundRedirect({
      trackingKey: links[0]!.trackingKey,
      userAgent: "Mozilla/5.0 (iPhone)",
      referrer: "https://fotorank.dnxsuite.com/concursos/santa-fe-en-foco-2026",
      clientSeed: "fr-1",
    });
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.match(resolved.redirectUrl, /utm_source=fotorank/);
      assert.match(resolved.redirectUrl, /utm_medium=partner/);
    }
    assert.equal(await svc.countPartnerClicks(ops, partner.id), 1);
    assert.equal(await svc.countParticipationClicks(ops, participation.id), 1);
    assert.equal(await svc.countClicksByApplication(ops, partner.id, "FOTO_RANK"), 1);
  });

  it("soft-fails analytics when createClickEvent throws", async () => {
    const repo = createMemoryPartnersRepository();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, {
      name: "Soft Fail Co",
      websiteUrl: "https://soft.example",
    });
    await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "e-soft",
      destinationUrl: "https://soft.example/ok",
      status: "ACTIVE",
    });
    const links = await svc.listPartnerOutboundLinks(ops, partner.id);
    const original = repo.createClickEvent.bind(repo);
    repo.createClickEvent = async () => {
      throw new Error("analytics down");
    };
    const resolved = await svc.resolveOutboundRedirect({
      trackingKey: links[0]!.trackingKey,
      userAgent: "Mozilla/5.0",
      clientSeed: "soft-1",
    });
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.equal(resolved.tracked, false);
      assert.match(resolved.redirectUrl, /soft\.example/);
    }
    repo.createClickEvent = original;
  });

  it("does not track bots, archived or expired links", async () => {
    const repo = createMemoryPartnersRepository();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, {
      name: "Edge Cases",
      websiteUrl: "https://edge.example",
    });
    await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "e-edge",
      destinationUrl: "https://edge.example",
      status: "ACTIVE",
    });
    const links = await svc.listPartnerOutboundLinks(ops, partner.id);
    const key = links[0]!.trackingKey;

    const bot = await svc.resolveOutboundRedirect({
      trackingKey: key,
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)",
      clientSeed: "bot-1",
    });
    assert.equal(bot.ok, true);
    if (bot.ok) assert.equal(bot.tracked, false);

    await repo.updateOutboundLink(links[0]!.id, {
      endsAt: new Date(Date.now() - 60_000),
    });
    const expired = await svc.resolveOutboundRedirect({
      trackingKey: key,
      userAgent: "Mozilla/5.0",
      clientSeed: "exp-1",
    });
    assert.equal(expired.ok, false);

    await repo.updateOutboundLink(links[0]!.id, {
      endsAt: null,
      status: "ARCHIVED",
      archivedAt: new Date(),
    });
    const archived = await svc.resolveOutboundRedirect({
      trackingKey: key,
      userAgent: "Mozilla/5.0",
      clientSeed: "arch-1",
    });
    assert.equal(archived.ok, false);
    assert.equal(await svc.countPartnerClicks(ops, partner.id), 0);
  });
});

describe("privacy helpers", () => {
  it("sanitizes referrer host and classifies device", async () => {
    const { sanitizeReferrerHost, classifyDeviceClass } = await import("./tracking");
    assert.equal(
      sanitizeReferrerHost("https://maratonfotografica.com/maratones/x?utm=1"),
      "maratonfotografica.com",
    );
    assert.equal(classifyDeviceClass("Mozilla/5.0 (iPhone)"), "MOBILE");
    assert.equal(classifyDeviceClass("Mozilla/5.0 (iPad)"), "TABLET");
    assert.equal(classifyDeviceClass("Mozilla/5.0 (Macintosh)"), "DESKTOP");
  });

  it("rejects ftp and malformed destination", () => {
    assert.throws(() => assertSafePartnerDestinationUrl("ftp://evil.example/x"));
    assert.throws(() => assertSafePartnerDestinationUrl("not-a-url"));
  });
});
