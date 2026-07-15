/**
 * Charlas públicas por slug (landing escolar / charlas).
 */

import type { PrismaClient } from "@prisma/client";
import { TalkStatus } from "@prisma/client";

export const TALK_PUBLIC_FIELDS = [
  "id",
  "title",
  "subtitle",
  "badgeText",
  "eventDate",
  "eventTime",
  "timezone",
  "modality",
  "calendarUrl",
  "whatsappGroupUrl",
  "heroImageUrl",
  "primaryCtaText",
  "secondaryCtaText",
  "shortDescription",
  "longDescription",
  "problemPointsJson",
  "solutionPointsJson",
  "agendaPointsJson",
  "stepsJson",
  "faqJson",
  "enableCalendarStep",
  "enableWhatsappStep",
] as const;

export const TALK_FORBIDDEN_FIELDS = [
  "internalNotes",
  "meetUrl",
  "reminderTemplate",
  "groupInviteTemplate",
  "status",
  "seoTitle",
  "seoDescription",
  "ogImageUrl",
] as const;

const TALK_SELECT = {
  id: true,
  title: true,
  subtitle: true,
  badgeText: true,
  eventDate: true,
  eventTime: true,
  timezone: true,
  modality: true,
  calendarUrl: true,
  whatsappGroupUrl: true,
  heroImageUrl: true,
  primaryCtaText: true,
  secondaryCtaText: true,
  shortDescription: true,
  longDescription: true,
  problemPointsJson: true,
  solutionPointsJson: true,
  agendaPointsJson: true,
  stepsJson: true,
  faqJson: true,
  enableCalendarStep: true,
  enableWhatsappStep: true,
  status: true,
} as const;

type TalkRow = {
  id: number;
  title: string;
  subtitle: string | null;
  badgeText: string | null;
  eventDate: Date | null;
  eventTime: string | null;
  timezone: string;
  modality: string;
  calendarUrl: string | null;
  whatsappGroupUrl: string | null;
  heroImageUrl: string | null;
  primaryCtaText: string | null;
  secondaryCtaText: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  problemPointsJson: unknown;
  solutionPointsJson: unknown;
  agendaPointsJson: unknown;
  stepsJson: unknown;
  faqJson: unknown;
  enableCalendarStep: boolean;
  enableWhatsappStep: boolean;
  status: TalkStatus;
};

export type PublicTalk = Omit<TalkRow, "status">;

export function isTalkPubliclyVisible(status: TalkStatus | string): boolean {
  return status === TalkStatus.PUBLISHED;
}

export function toPublicTalk(talk: TalkRow): PublicTalk | null {
  if (!isTalkPubliclyVisible(talk.status)) return null;
  const { status: _status, ...publicFields } = talk;
  return publicFields;
}

export async function getPublishedTalkBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<PublicTalk | null> {
  const normalized = slug.trim();
  if (!normalized) return null;

  const talk = await prisma.talk.findUnique({
    where: { slug: normalized },
    select: TALK_SELECT,
  });

  if (!talk) return null;
  return toPublicTalk(talk as TalkRow);
}
