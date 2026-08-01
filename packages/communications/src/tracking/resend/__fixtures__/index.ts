import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResendEmailWebhookType } from "../types";

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));

export const FIXTURE_EVENT_FILES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.opened",
  "email.clicked",
  "email.failed",
  "email.suppressed",
  "email.unknown",
] as const;

export type FixtureEventName = (typeof FIXTURE_EVENT_FILES)[number];

export function loadResendWebhookFixture(name: FixtureEventName): string {
  return readFileSync(join(FIXTURE_DIR, `${name}.json`), "utf8");
}

export function fixtureHeaders(eventId = "msg_svix_fixture_001"): Record<
  string,
  string
> {
  return {
    "svix-id": eventId,
    "svix-timestamp": "1705312800",
    "svix-signature": "v1,fake_signature_for_tests_only",
  };
}

/** Alias para nombres cortos del smoke CLI. */
export function resolveFixtureName(
  short: string,
): FixtureEventName | undefined {
  const map: Record<string, FixtureEventName> = {
    sent: "email.sent",
    delivered: "email.delivered",
    delayed: "email.delivery_delayed",
    delivery_delayed: "email.delivery_delayed",
    bounced: "email.bounced",
    complained: "email.complained",
    opened: "email.opened",
    clicked: "email.clicked",
    failed: "email.failed",
    suppressed: "email.suppressed",
    unknown: "email.unknown",
  };
  if ((FIXTURE_EVENT_FILES as readonly string[]).includes(short)) {
    return short as FixtureEventName;
  }
  return map[short];
}

export type SupportedFixtureEvent = ResendEmailWebhookType;
