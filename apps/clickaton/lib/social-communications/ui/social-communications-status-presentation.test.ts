import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { looksLikeRawStatusEnum } from "@/lib/public-ux/status-presentation";
import {
  presentAccreditationEligibilityReason,
  presentEmailQueueOperationalStatus,
  presentSocialEntityType,
  presentSocialPublisherLiveMode,
  presentSocialPublishStatus,
  presentWelcomeCardAdminActionLabels,
} from "./social-communications-status-presentation";
import {
  presentAdminEmailQueueStatus,
  presentAdminPublicationStatus,
  presentAdminWelcomeCardStatus,
} from "@/lib/admin-registration/ui/admin-status-presentation";

const ROOT = join(process.cwd());

describe("social communications status presentation", () => {
  it("presents social statuses without raw enums", () => {
    for (const status of [
      "PENDING_APPROVAL",
      "APPROVED",
      "SCHEDULED",
      "PUBLISHED",
      "FAILED",
      "CANCELLED",
      "REJECTED",
      "NOT_SCHEDULED",
    ]) {
      const p = presentSocialPublishStatus(status);
      assert.equal(looksLikeRawStatusEnum(p.label), false, status);
      assert.ok(p.description.length > 8);
    }
  });

  it("explains LIVE mode off without promising auto publish", () => {
    const off = presentSocialPublisherLiveMode(false);
    assert.match(off.label, /desactivada/i);
    assert.equal(off.canPublishNow, false);
    assert.match(off.description, /no se publicarán automáticamente/i);

    const on = presentSocialPublisherLiveMode(true);
    assert.equal(on.canPublishNow, true);
  });

  it("differentiates welcome entity as story / welcome plate", () => {
    const entity = presentSocialEntityType("WELCOME_CARD");
    assert.match(entity.label, /placa/i);
    assert.match(entity.publicationType, /Historia/i);
  });

  it("differentiates generate vs regenerate labels", () => {
    const labels = presentWelcomeCardAdminActionLabels(true);
    assert.equal(labels.generate, "Generar placa");
    assert.equal(labels.regenerate, "Volver a generar");
    assert.notEqual(labels.generate, labels.regenerate);
  });

  it("distinguishes email sent vs delivered", () => {
    const sent = presentEmailQueueOperationalStatus("SENT");
    const delivered = presentEmailQueueOperationalStatus("DELIVERED");
    assert.match(sent.label, /enviado/i);
    assert.match(delivered.label, /entregado/i);
    assert.notEqual(sent.label, delivered.label);

    const adminSent = presentAdminEmailQueueStatus("SENT");
    const adminDelivered = presentAdminEmailQueueStatus("DELIVERED");
    assert.notEqual(adminSent.label, adminDelivered.label);
  });

  it("humanizes bounce and failed email", () => {
    const bounced = presentEmailQueueOperationalStatus("BOUNCED");
    assert.match(bounced.label, /entregarse|rebot/i);
    assert.ok(bounced.nextAction);
    assert.equal(bounced.duplicationRisk, true);
  });

  it("marks failed publish as retryable with duplication risk", () => {
    const failed = presentSocialPublishStatus("FAILED");
    assert.equal(failed.canRetry, true);
    assert.equal(failed.duplicationRisk, true);
    assert.match(failed.label, /confirmar/i);
  });

  it("humanizes accreditation reasons", () => {
    assert.match(presentAccreditationEligibilityReason("READY").label, /acreditar/i);
    assert.equal(
      looksLikeRawStatusEnum(presentAccreditationEligibilityReason("WINDOW_CLOSED").label),
      false,
    );
  });

  it("presents welcome and publication admin statuses in Spanish", () => {
    assert.match(presentAdminWelcomeCardStatus("GENERATED").label, /placa/i);
    assert.match(presentAdminPublicationStatus("PENDING_APPROVAL").label, /revisar/i);
    assert.equal(
      looksLikeRawStatusEnum(presentAdminPublicationStatus("PUBLISHED").label),
      false,
    );
  });
});

describe("social communications UI source contracts", () => {
  it("social page uses human labels and LIVE banner", () => {
    const page = readFileSync(join(ROOT, "app/admin/(panel)/social/page.tsx"), "utf8");
    assert.match(page, /Publicaciones en redes sociales/);
    assert.match(page, /presentSocialPublisherLiveMode/);
    assert.match(page, /presentSocialPublishStatus/);
    assert.match(page, /ConfirmSubmitButton/);
    assert.match(page, /AdminTechnicalInfo/);
    assert.match(page, /Volver a intentar la publicación/);
    assert.match(page, /Programar publicación/);
    assert.doesNotMatch(page, /DNX_SOCIAL_PUBLISHER_LIVE=true/);
    assert.doesNotMatch(page, /Vista previa del asset/);
    assert.doesNotMatch(page, />Reintentar</);
    assert.doesNotMatch(page, /PENDING_APPROVAL<\/option>/);
  });

  it("registration detail differentiates regenerate and warns on resend", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/inscripciones/[registrationId]/page.tsx"),
      "utf8",
    );
    assert.match(page, /Volver a generar/);
    assert.match(page, /Generar placa/);
    assert.match(page, /Reenviar correo/);
    assert.match(page, /SOCIAL_SENSITIVE_CONFIRM/);
    assert.match(page, /Usuario de Instagram del participante/);
    assert.match(page, /Instagram no informado/);
  });

  it("welcome card public preview uses authenticated proxy path", () => {
    const card = readFileSync(
      join(ROOT, "components/account/WelcomeCardShareCard.tsx"),
      "utf8",
    );
    assert.match(card, /\/api\/public\/registrations\/\$\{registrationId\}\/welcome-card/);
    assert.doesNotMatch(card, /r2\.|amazonaws|X-Amz-Signature/);
    assert.match(card, /aspect-\[9\/16\]/);
  });

  it("does not modify social publisher worker logic", () => {
    const worker = readFileSync(join(ROOT, "lib/social-publisher/worker.ts"), "utf8");
    assert.match(worker, /DNX_SOCIAL_PUBLISHER_LIVE/);
    assert.match(worker, /livePublish/);
  });
});
