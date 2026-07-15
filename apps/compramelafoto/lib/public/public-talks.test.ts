/**
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/public/public-talks.test.ts
 */

import assert from "node:assert/strict";
import { TalkStatus } from "@prisma/client";
import {
  TALK_FORBIDDEN_FIELDS,
  TALK_PUBLIC_FIELDS,
  isTalkPubliclyVisible,
  toPublicTalk,
} from "./public-talks";

{
  assert.equal(isTalkPubliclyVisible(TalkStatus.PUBLISHED), true);
  assert.equal(isTalkPubliclyVisible(TalkStatus.DRAFT), false);
  assert.equal(isTalkPubliclyVisible(TalkStatus.CLOSED), false);
  assert.equal(isTalkPubliclyVisible(TalkStatus.ARCHIVED), false);
}

{
  const draft = toPublicTalk({
    id: 1,
    title: "Draft",
    subtitle: null,
    badgeText: null,
    eventDate: null,
    eventTime: null,
    timezone: "America/Argentina/Buenos_Aires",
    modality: "ONLINE",
    calendarUrl: null,
    whatsappGroupUrl: null,
    heroImageUrl: null,
    primaryCtaText: null,
    secondaryCtaText: null,
    shortDescription: null,
    longDescription: null,
    problemPointsJson: null,
    solutionPointsJson: null,
    agendaPointsJson: null,
    stepsJson: null,
    faqJson: null,
    enableCalendarStep: true,
    enableWhatsappStep: true,
    status: TalkStatus.DRAFT,
  });
  assert.equal(draft, null);
}

{
  const published = toPublicTalk({
    id: 2,
    title: "Charla escolar",
    subtitle: "Sub",
    badgeText: null,
    eventDate: new Date("2026-08-01T00:00:00Z"),
    eventTime: "19:00",
    timezone: "America/Argentina/Buenos_Aires",
    modality: "ONLINE",
    calendarUrl: "https://example.com/cal",
    whatsappGroupUrl: "https://wa.me/123",
    heroImageUrl: null,
    primaryCtaText: "Sumate",
    secondaryCtaText: null,
    shortDescription: "Desc",
    longDescription: null,
    problemPointsJson: null,
    solutionPointsJson: null,
    agendaPointsJson: null,
    stepsJson: null,
    faqJson: null,
    enableCalendarStep: true,
    enableWhatsappStep: true,
    status: TalkStatus.PUBLISHED,
  });
  assert.ok(published);
  assert.equal(published!.title, "Charla escolar");
  assert.equal("status" in published!, false);
  assert.ok(!TALK_PUBLIC_FIELDS.includes("status" as never));
  assert.ok(TALK_FORBIDDEN_FIELDS.includes("internalNotes"));
  assert.ok(TALK_FORBIDDEN_FIELDS.includes("meetUrl"));
}

console.log("public-talks.test.ts: ok");
