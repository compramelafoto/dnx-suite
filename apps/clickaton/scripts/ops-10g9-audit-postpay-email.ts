/**
 * 10G.9 — Read-only audit: latest CONFIRMED registrations + EmailQueue + Resend lookup.
 * Usage: DATABASE_URL=... RESEND_API_KEY=... pnpm exec tsx scripts/ops-10g9-audit-postpay-email.ts
 */
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import { classifyResendStatus } from "../lib/registration/notifications/resend-delivery-status";

function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  return email.replace(/(.{2}).+(@.+)/, "$1***$2");
}

async function fetchResend(messageId: string, apiKey: string) {
  const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(messageId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    return { ok: false as const, statusHttp: res.status, body };
  }
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: true as const, json };
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const regs = await prisma.clickatonRegistration.findMany({
    where: { status: "CONFIRMED" },
    orderBy: { confirmedAt: "desc" },
    take: 5,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      paymentStatus: true,
      visibleCode: true,
      instagramHandle: true,
      confirmedAt: true,
      userId: true,
      totalAmount: true,
      currency: true,
      welcomeCardStatus: true,
      termsVersion: true,
      edition: { select: { slug: true, name: true } },
      credential: { select: { id: true, status: true, publicCode: true } },
      items: {
        select: {
          nameSnapshot: true,
          variantNameSnapshot: true,
          sourceType: true,
          isIncluded: true,
        },
      },
      user: { select: { id: true, email: true, password: true, googleId: true } },
    },
  });

  const out: unknown[] = [];
  for (const r of regs) {
    const audits = await prisma.clickatonRegistrationAudit.findMany({
      where: {
        registrationId: r.id,
        action: {
          in: ["EMAIL_SENT", "EMAIL_QUEUED", "EMAIL_FAILED", "CREDENTIAL_ISSUED"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const q = await prisma.emailQueue.findMany({
      where: {
        OR: [
          { idempotencyKey: { contains: r.id } },
          ...(r.email ? [{ to: r.email }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const emails = [];
    for (const e of q) {
      const td =
        e.templateData && typeof e.templateData === "object"
          ? (e.templateData as Record<string, unknown>)
          : {};
      const providerMessageId =
        typeof td.providerMessageId === "string" ? td.providerMessageId : null;
      let resend: unknown = null;
      let classification = "UNKNOWN";
      if (providerMessageId && apiKey) {
        const looked = await fetchResend(providerMessageId, apiKey);
        if (looked.ok) {
          classification = classifyResendStatus(looked.json);
          resend = {
            id: looked.json.id,
            to: looked.json.to,
            from: looked.json.from,
            subject: looked.json.subject,
            created_at: looked.json.created_at,
            last_event: looked.json.last_event,
            classification,
          };
        } else {
          resend = { error: looked.statusHttp, snippet: looked.body };
        }
      }
      emails.push({
        queueId: e.id,
        status: e.status,
        templateKey: td.templateKey ?? null,
        toMasked: maskEmail(e.to),
        subject: e.subject,
        sentAt: e.sentAt,
        attempts: e.attempts,
        lastError: e.errorMessage,
        providerMessageId,
        resend,
        classification,
      });
    }

    out.push({
      registrationId: r.id,
      emailMasked: maskEmail(r.email),
      name: `${r.firstName} ${r.lastName}`,
      status: r.status,
      paymentStatus: r.paymentStatus,
      visibleCode: r.visibleCode,
      instagram: r.instagramHandle,
      confirmedAt: r.confirmedAt,
      totalAmount: r.totalAmount,
      welcomeCardStatus: r.welcomeCardStatus,
      termsVersion: r.termsVersion,
      edition: r.edition,
      credential: r.credential,
      shirt: r.items.map((i) => ({
        name: i.nameSnapshot,
        size: i.variantNameSnapshot,
        included: i.isIncluded,
        source: i.sourceType,
      })),
      user: r.user
        ? {
            id: r.user.id,
            hasPassword: Boolean(r.user.password),
            hasGoogle: Boolean(r.user.googleId),
          }
        : null,
      audits: audits.map((a) => ({
        action: a.action,
        createdAt: a.createdAt,
        metadata: a.metadata,
      })),
      emails,
    });
  }

  writeFileSync("/tmp/clickaton-10g9-audit.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ count: out.length, path: "/tmp/clickaton-10g9-audit.json", latest: out[0] }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
