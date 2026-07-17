/**
 * Self-check copy/CTA inscripción (sin framework).
 * pnpm --filter clickaton exec tsx lib/registration-cta.selfcheck.ts
 */
import assert from "node:assert/strict";
import { presentRegistrationCta } from "./registration-cta";
import {
  registrationFixtureCancelled,
  registrationFixtureClosed,
  registrationFixtureComingSoon,
  registrationFixtureFreeOpen,
  registrationFixtureFull,
  registrationFixtureInvalidPaid,
  registrationFixtureMissingUrl,
  registrationFixturePaidOpen,
  registrationFixturePaidWithMerch,
} from "@/content/fixtures/registration-variants";

{
  const cta = presentRegistrationCta(registrationFixtureFreeOpen);
  assert.equal(cta.headline, "Inscripción gratuita");
  assert.equal(cta.ctaLabel, "Inscribirme");
  assert.equal(cta.ctaEnabled, true);
}

{
  const cta = presentRegistrationCta(registrationFixturePaidOpen);
  assert.ok(cta.headline.includes("Inscripción:"));
  assert.equal(cta.ctaLabel, "Inscribirme");
}

{
  const cta = presentRegistrationCta(registrationFixturePaidWithMerch);
  assert.equal(cta.secondaryLine, "Merchandising opcional disponible");
  assert.equal(cta.ctaLabel, "Inscribirme");
}

{
  const cta = presentRegistrationCta(registrationFixtureComingSoon);
  assert.equal(cta.headline, "Inscripciones próximamente");
  assert.equal(cta.ctaEnabled, false);
}

{
  const cta = presentRegistrationCta(registrationFixtureClosed);
  assert.equal(cta.headline, "Inscripción cerrada");
}

{
  const cta = presentRegistrationCta(registrationFixtureFull);
  assert.equal(cta.headline, "Cupos completos");
}

{
  const cta = presentRegistrationCta(registrationFixtureCancelled);
  assert.equal(cta.headline, "Evento cancelado");
  assert.equal(cta.ctaEnabled, false);
}

{
  const cta = presentRegistrationCta(registrationFixtureMissingUrl);
  assert.equal(cta.ctaEnabled, false);
  assert.equal(cta.ctaHref, null);
}

{
  const cta = presentRegistrationCta(registrationFixtureInvalidPaid);
  assert.equal(cta.ctaEnabled, false);
}

assert.equal(presentRegistrationCta(null).ctaEnabled, false);

console.log("registration-cta.selfcheck: OK");
