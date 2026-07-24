import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NotificationEngine,
  createNotificationEvent,
  shouldEmitPhotographerCallOpened,
  selectPhotographerAudience,
  parseAudienceScope,
  buildDeliveryDedupeKey,
  buildCampaignDedupeKey,
  isRetrySameDelivery,
  renderNearbyPhotographerCallTemplate,
  appendAttributionParams,
  renderNearbyCallEmail,
  evaluateCampaignPolicy,
  confirmationSummary,
  explainAudienceSelection,
  resolveNextDeliveryStatus,
  classifyDeliveryError,
  nextBackoffMs,
  UnwiredEmailAdapter,
  resolveAvailableChannels,
  defaultPreferenceForLegacyUser,
  mergeNearbyCallsPreference,
  FUTURE_EVENT_HOOKS,
  resolveWorkerConfig,
  NOTIFICATION_WORKER_DEFAULTS,
  type PhotographerAudienceInput,
  type CallAudienceContext,
} from "./index";

const ROSARIO = { latitude: -32.9442, longitude: -60.6505 };
const SANTA_FE = { latitude: -31.6333, longitude: -60.7 };
const CABA = { latitude: -34.6037, longitude: -58.3816 };

function photographer(
  partial: Partial<PhotographerAudienceInput> & { userId: number },
): PhotographerAudienceInput {
  return {
    active: true,
    blocked: false,
    latitude: ROSARIO.latitude,
    longitude: ROSARIO.longitude,
    city: "Rosario",
    province: "Santa Fe",
    nearbyCallsEnabled: true,
    availableChannels: ["IN_APP"],
    alreadyApplied: false,
    existingDedupeKeys: [],
    recentSimilarCount: 0,
    ...partial,
  };
}

function baseCtx(
  overrides: Partial<CallAudienceContext> = {},
): CallAudienceContext {
  return {
    eventType: "CLF_PHOTOGRAPHER_CALL_OPENED",
    sourceEntityId: "call_1",
    campaignCycle: "cycle-1",
    origin: {
      latitude: ROSARIO.latitude,
      longitude: ROSARIO.longitude,
      city: "Rosario",
      province: "Santa Fe",
    },
    scope: { kind: "RADIUS_KM", km: 50 },
    channels: ["IN_APP"],
    callOpen: true,
    callExpired: false,
    ...overrides,
  };
}

describe("DNX Notifications Engine", () => {
  it("1. crea evento con idempotencyKey estable", () => {
    const a = createNotificationEvent({
      type: "CLF_PHOTOGRAPHER_CALL_OPENED",
      sourceApp: "infospot",
      sourceEntityType: "InfoSpotPhotographerCall",
      sourceEntityId: "abc",
      cycle: "open-1",
    });
    const b = createNotificationEvent({
      type: "CLF_PHOTOGRAPHER_CALL_OPENED",
      sourceApp: "infospot",
      sourceEntityType: "InfoSpotPhotographerCall",
      sourceEntityId: "abc",
      cycle: "open-1",
    });
    assert.equal(a.idempotencyKey, b.idempotencyKey);
    assert.match(a.idempotencyKey, /CLF_PHOTOGRAPHER_CALL_OPENED/);
  });

  it("2-5. selección por radio 10/25/50/100, ciudad y provincia", () => {
    // Offsets aproximados desde Rosario (~1° lat ≈ 111 km).
    const near = { latitude: -32.9442 + 0.05, longitude: -60.6505 }; // ~5 km
    const mid = { latitude: -32.9442 + 0.3, longitude: -60.6505 }; // ~33 km
    const far = { latitude: -32.9442 + 0.8, longitude: -60.6505 }; // ~89 km
    const people = [
      photographer({ userId: 1, ...near, city: "Rosario", province: "Santa Fe" }),
      photographer({ userId: 2, ...mid, city: "Pérez", province: "Santa Fe" }),
      photographer({ userId: 3, ...far, city: "San Lorenzo", province: "Santa Fe" }),
      photographer({
        userId: 4,
        ...CABA,
        city: "CABA",
        province: "CABA",
      }),
      photographer({
        userId: 5,
        ...SANTA_FE,
        city: "Santa Fe",
        province: "Santa Fe",
      }),
    ];

    const r10 = selectPhotographerAudience(people, baseCtx({ scope: { kind: "RADIUS_KM", km: 10 } }));
    assert.equal(r10.buckets.eligible, 1);

    const r25 = selectPhotographerAudience(people, baseCtx({ scope: { kind: "RADIUS_KM", km: 25 } }));
    assert.equal(r25.buckets.eligible, 1);

    const r50 = selectPhotographerAudience(people, baseCtx({ scope: { kind: "RADIUS_KM", km: 50 } }));
    assert.equal(r50.buckets.eligible, 2);

    const r100 = selectPhotographerAudience(people, baseCtx({ scope: { kind: "RADIUS_KM", km: 100 } }));
    assert.equal(r100.buckets.eligible, 3);

    const city = selectPhotographerAudience(
      people,
      baseCtx({ scope: { kind: "CITY" } }),
    );
    assert.equal(city.buckets.eligible, 1);
    assert.equal(city.eligible[0]?.recipient.userId, 1);

    const province = selectPhotographerAudience(
      people,
      baseCtx({ scope: { kind: "PROVINCE" } }),
    );
    assert.equal(province.buckets.eligible, 4);
  });

  it("6. coordenadas inválidas excluyen", () => {
    const people = [
      photographer({ userId: 1, latitude: 0, longitude: 0 }),
      photographer({ userId: 2, latitude: null, longitude: null }),
    ];
    const preview = selectPhotographerAudience(people, baseCtx());
    assert.equal(preview.buckets.eligible, 0);
    assert.ok(preview.buckets.invalidLocation >= 1 || preview.buckets.outOfRadius >= 1);
  });

  it("7. preferencias desactivadas excluyen", () => {
    const preview = selectPhotographerAudience(
      [photographer({ userId: 1, nearbyCallsEnabled: false })],
      baseCtx(),
    );
    assert.equal(preview.buckets.eligible, 0);
    assert.equal(preview.buckets.prefDisabled, 1);
  });

  it("8. canal no disponible excluye", () => {
    const preview = selectPhotographerAudience(
      [photographer({ userId: 1, availableChannels: [] })],
      baseCtx(),
    );
    assert.equal(preview.buckets.noChannel, 1);
  });

  it("9-10. deduplicación e idempotencia de entrega", () => {
    const key = buildDeliveryDedupeKey({
      eventType: "CLF_PHOTOGRAPHER_CALL_OPENED",
      sourceEntityId: "call_1",
      recipientUserId: 9,
      channel: "IN_APP",
      campaignCycle: "c1",
    });
    const preview = selectPhotographerAudience(
      [photographer({ userId: 9, existingDedupeKeys: [key] })],
      baseCtx({ campaignCycle: "c1" }),
    );
    assert.equal(preview.buckets.duplicates, 1);
    assert.equal(
      buildCampaignDedupeKey({
        eventType: "CLF_PHOTOGRAPHER_CALL_OPENED",
        sourceEntityId: "call_1",
        campaignCycle: "c1",
        channels: ["IN_APP"],
      }),
      buildCampaignDedupeKey({
        eventType: "CLF_PHOTOGRAPHER_CALL_OPENED",
        sourceEntityId: "call_1",
        campaignCycle: "c1",
        channels: ["IN_APP"],
      }),
    );
  });

  it("11. templates renderizan variables y validan URL", () => {
    const rendered = renderNearbyPhotographerCallTemplate({
      eventName: "Festival Internacional de Fotografía",
      city: "Rosario",
      dateLabel: "12/08",
      photographersNeeded: 5,
      url: "https://compramelafoto.com/e/abc",
    });
    assert.equal(rendered.title, "Buscan fotógrafos cerca tuyo");
    assert.match(rendered.body, /Festival Internacional/);
    assert.match(rendered.body, /5 fotógrafos/);
    assert.match(rendered.body, /Rosario/);
    assert.equal(rendered.ctaLabel, "Ver convocatoria");
    assert.throws(() =>
      renderNearbyPhotographerCallTemplate({
        eventName: "X",
        url: "javascript:alert(1)",
      }),
    );
  });

  it("12. explicación de selección agregada", () => {
    const preview = selectPhotographerAudience(
      [
        photographer({ userId: 1 }),
        photographer({ userId: 2, nearbyCallsEnabled: false }),
      ],
      baseCtx(),
    );
    const expl = explainAudienceSelection(preview);
    assert.match(expl.summary, /elegibles/i);
    assert.ok(expl.reasons.length > 0);
  });

  it("13-14. anti-spam y límites de campaña", () => {
    const policy = evaluateCampaignPolicy({
      campaignsForSourceEntity: 0,
      campaignsByActorToday: 0,
      eligibleCount: 1200,
      actorIsDirectorOrSuperAdmin: false,
      callOpen: true,
      callExpired: false,
    });
    assert.equal(policy.ok, false);
    if (!policy.ok) assert.equal(policy.code, "AUDIENCE_NEEDS_DIRECTOR");

    const okDirector = evaluateCampaignPolicy({
      campaignsForSourceEntity: 0,
      campaignsByActorToday: 0,
      eligibleCount: 1200,
      actorIsDirectorOrSuperAdmin: true,
      callOpen: true,
      callExpired: false,
    });
    assert.equal(okDirector.ok, true);

    const engine = new NotificationEngine();
    const draft = engine.buildCampaignDraft({
      event: createNotificationEvent({
        type: "CLF_PHOTOGRAPHER_CALL_OPENED",
        sourceApp: "infospot",
        sourceEntityType: "InfoSpotPhotographerCall",
        sourceEntityId: "call_1",
      }),
      photographers: [photographer({ userId: 1, recentSimilarCount: 99 })],
      audienceContext: baseCtx(),
      templateVars: {
        eventName: "Fest",
        city: "Rosario",
        url: "https://example.com/call",
      },
      policyContext: {
        campaignsForSourceEntity: 0,
        campaignsByActorToday: 0,
        actorIsDirectorOrSuperAdmin: true,
      },
      centerLabel: "Rosario",
      eventTitle: "Fest",
      recentSimilarByUserId: new Map([[1, 99]]),
    });
    assert.equal(draft.preview.buckets.antiSpam, 1);
    assert.equal(draft.preview.buckets.eligible, 0);
  });

  it("15-16. reintentos y errores definitivos", () => {
    assert.equal(classifyDeliveryError("BLOCKED"), "FINAL");
    assert.equal(classifyDeliveryError("PROVIDER_TIMEOUT"), "RETRYABLE");
    const retry = resolveNextDeliveryStatus({
      current: "PROCESSING",
      success: false,
      attempts: 2,
      errorCode: "PROVIDER_TIMEOUT",
    });
    assert.equal(retry.status, "FAILED");
    assert.ok(retry.retryAt);
    assert.equal(retry.final, false);

    const dead = resolveNextDeliveryStatus({
      current: "PROCESSING",
      success: false,
      attempts: 5,
      errorCode: "PROVIDER_TIMEOUT",
    });
    assert.equal(dead.status, "DEAD_LETTER");

    const final = resolveNextDeliveryStatus({
      current: "PROCESSING",
      success: false,
      attempts: 1,
      errorCode: "OPTED_OUT",
    });
    assert.equal(final.status, "DEAD_LETTER");
    assert.ok(nextBackoffMs(3) > nextBackoffMs(1));

    assert.equal(
      isRetrySameDelivery({
        existingDedupeKey: "a",
        nextDedupeKey: "a",
        status: "FAILED",
      }),
      true,
    );
  });

  it("24-26. borrador/cerrada no emite; apertura emite una vez", () => {
    assert.equal(
      shouldEmitPhotographerCallOpened({
        previousProvisioningStatus: "NOT_REQUESTED",
        nextProvisioningStatus: "DRAFT",
        enabled: true,
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
        desiredClfStatus: "ACTIVE",
        clfEventId: null,
      }),
      false,
    );
    assert.equal(
      shouldEmitPhotographerCallOpened({
        previousProvisioningStatus: "NOT_REQUESTED",
        nextProvisioningStatus: "PROVISIONED",
        enabled: true,
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
        desiredClfStatus: "ACTIVE",
        clfEventId: 10,
      }),
      true,
    );
    assert.equal(
      shouldEmitPhotographerCallOpened({
        previousProvisioningStatus: "PROVISIONED",
        nextProvisioningStatus: "PROVISIONED",
        enabled: true,
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
        desiredClfStatus: "ACTIVE",
        clfEventId: 10,
      }),
      false,
    );
  });

  it("25/32. convocatoria cerrada o vencida no permite campaña", () => {
    const closed = evaluateCampaignPolicy({
      campaignsForSourceEntity: 0,
      campaignsByActorToday: 0,
      eligibleCount: 10,
      actorIsDirectorOrSuperAdmin: true,
      callOpen: false,
      callExpired: false,
    });
    assert.equal(closed.ok, false);

    const expired = evaluateCampaignPolicy({
      campaignsForSourceEntity: 0,
      campaignsByActorToday: 0,
      eligibleCount: 10,
      actorIsDirectorOrSuperAdmin: true,
      callOpen: true,
      callExpired: true,
    });
    assert.equal(expired.ok, false);
  });

  it("27-29. abrir ≠ enviar; preview no envía; draft crea planes PENDING", () => {
    const engine = new NotificationEngine();
    const draft = engine.buildCampaignDraft({
      event: createNotificationEvent({
        type: "CLF_PHOTOGRAPHER_CALL_OPENED",
        sourceApp: "infospot",
        sourceEntityType: "InfoSpotPhotographerCall",
        sourceEntityId: "call_1",
      }),
      photographers: [photographer({ userId: 1 })],
      audienceContext: baseCtx(),
      templateVars: {
        eventName: "Fest",
        city: "Rosario",
        url: "https://example.com/e/1",
      },
      policyContext: {
        campaignsForSourceEntity: 0,
        campaignsByActorToday: 0,
        actorIsDirectorOrSuperAdmin: true,
      },
      centerLabel: "Rosario",
      eventTitle: "Fest",
      campaignIdForAttribution: "camp_1",
    });
    assert.equal(draft.policy.ok, true);
    assert.equal(draft.deliveries.length, 1);
    assert.equal(draft.deliveries[0]?.status, "PENDING");
    assert.match(draft.confirmationText, /1 fotógrafos/);
    assert.match(draft.deliveries[0]!.ctaUrl, /dnx_ncid=camp_1/);
  });

  it("31. usuario ya postulado se excluye", () => {
    const preview = selectPhotographerAudience(
      [photographer({ userId: 1, alreadyApplied: true })],
      baseCtx(),
    );
    assert.equal(preview.buckets.alreadyApplied, 1);
  });

  it("33-40. métricas, atribución, email no simulado, prefs legacy", () => {
    const url = appendAttributionParams("https://example.com/x", {
      campaignId: "c1",
      deliveryId: "d1",
    });
    assert.match(url, /dnx_ncid=c1/);
    assert.match(url, /dnx_ndid=d1/);

    const email = new UnwiredEmailAdapter();
    return email.deliver({
      toUserId: 1,
      subject: "x",
      textBody: "y",
      ctaUrl: "https://example.com",
    }).then((r) => {
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.errorCode, "CHANNEL_NOT_IMPLEMENTED");
    });
  });

  it("prefs: canales y merge legacy", () => {
    const channels = resolveAvailableChannels(defaultPreferenceForLegacyUser());
    assert.deepEqual(channels, ["IN_APP"]);
    assert.equal(mergeNearbyCallsPreference({ dnxNearbyCalls: false }), false);
    assert.equal(mergeNearbyCallsPreference({}), true);
  });

  it("parseAudienceScope valida radios", () => {
    assert.deepEqual(parseAudienceScope({ mode: "RADIUS_KM", km: 25 }), {
      kind: "RADIUS_KM",
      km: 25,
    });
    assert.throws(() => parseAudienceScope({ mode: "RADIUS_KM", km: 9999 }));
    assert.deepEqual(parseAudienceScope({ mode: "CITY" }), { kind: "CITY" });
  });

  it("confirmation summary formato esperado", () => {
    const text = confirmationSummary({
      eligibleCount: 129,
      scopeLabel: "50 km",
      centerLabel: "Rosario",
      channelLabel: "notificación interna",
      eventTitle: "Festival Internacional de Fotografía",
    });
    assert.match(text, /129 fotógrafos/);
    assert.match(text, /50 km/);
    assert.match(text, /Rosario/);
  });

  it("futuros eventos documentados en contratos", () => {
    assert.ok(FUTURE_EVENT_HOOKS.includes("INFOSPOT_LOCAL_ALERT_PUBLISHED"));
    assert.ok(FUTURE_EVENT_HOOKS.includes("CLICKATON_REGISTRATION_OPENED"));
  });

  it("worker config centralizada", () => {
    const cfg = resolveWorkerConfig({ batchSize: 10 });
    assert.equal(cfg.batchSize, 10);
    assert.equal(cfg.maxAttempts, NOTIFICATION_WORKER_DEFAULTS.maxAttempts);
    assert.ok(cfg.workerId.length > 3);
  });

  it("email template incluye CTA y preferencias sin coords", () => {
    const email = renderNearbyCallEmail({
      eventName: "Fest",
      city: "Rosario",
      ctaUrl: "https://example.com/n/abc",
      prefsUrl: "https://example.com/prefs",
      distanceLabel: "~12 km",
    });
    assert.match(email.subject, /Rosario/);
    assert.match(email.text, /preferencias/i);
    assert.match(email.html, /Ver convocatoria/);
    assert.doesNotMatch(email.text, /-32\.|latitude/i);
  });

  it("EMAIL disponible solo con opt-in de canal", () => {
    const legacy = resolveAvailableChannels(defaultPreferenceForLegacyUser());
    assert.deepEqual(legacy, ["IN_APP"]);
    const withEmail = resolveAvailableChannels({
      ...defaultPreferenceForLegacyUser(),
      channels: { inApp: true, email: true, webPush: false },
      externalMarketingConsentAt: new Date(),
    });
    assert.ok(withEmail.includes("EMAIL"));
  });

  it("origen sin coords cae a ciudad", () => {
    const preview = selectPhotographerAudience(
      [photographer({ userId: 1, city: "Rosario" })],
      baseCtx({
        origin: {
          latitude: null,
          longitude: null,
          city: "Rosario",
          province: "Santa Fe",
        },
        scope: { kind: "RADIUS_KM", km: 50 },
      }),
    );
    assert.equal(preview.buckets.eligible, 1);
  });
});
