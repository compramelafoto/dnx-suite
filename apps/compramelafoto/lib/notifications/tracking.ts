/**
 * Tracking lectura / clic / atribución DNX Notifications (CLF).
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const ATTR_COOKIE = "dnx_notif_attr";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 días

function isSafeRedirect(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const allowed = [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXTAUTH_URL,
      "https://compramelafoto.com",
      "https://www.compramelafoto.com",
      "http://localhost:3002",
      "http://127.0.0.1:3002",
    ]
      .filter(Boolean)
      .map((x) => {
        try {
          return new URL(String(x)).hostname;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as string[];
    if (allowed.length === 0) return true;
    return allowed.includes(u.hostname);
  } catch {
    return false;
  }
}

export async function markDeliveryRead(input: {
  deliveryId?: string;
  dashboardNotificationId?: number;
  userId: number;
}): Promise<{ ok: boolean; firstRead: boolean }> {
  let delivery =
    input.deliveryId != null
      ? await prisma.dnxNotificationDelivery.findFirst({
          where: { id: input.deliveryId, userId: input.userId },
        })
      : null;

  if (!delivery && input.dashboardNotificationId != null) {
    delivery = await prisma.dnxNotificationDelivery.findFirst({
      where: {
        dashboardNotificationId: input.dashboardNotificationId,
        userId: input.userId,
      },
    });
  }
  if (!delivery) return { ok: false, firstRead: false };

  if (delivery.dashboardNotificationId) {
    await prisma.dashboardNotification.updateMany({
      where: {
        id: delivery.dashboardNotificationId,
        userId: input.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  if (delivery.readAt) {
    return { ok: true, firstRead: false };
  }

  await prisma.dnxNotificationDelivery.update({
    where: { id: delivery.id },
    data: { readAt: new Date() },
  });
  await prisma.dnxNotificationCampaign.update({
    where: { id: delivery.campaignId },
    data: { readCount: { increment: 1 } },
  });
  console.log(
    JSON.stringify({
      scope: "dnx_notifications_tracking",
      event: "read",
      campaignId: delivery.campaignId,
      deliveryId: delivery.id,
    }),
  );
  return { ok: true, firstRead: true };
}

export async function registerClickByPublicToken(input: {
  publicToken: string;
  userId?: number | null;
}): Promise<
  | { ok: true; redirectUrl: string; deliveryId: string; campaignId: string }
  | { ok: false; error: string; status: number }
> {
  const delivery = await prisma.dnxNotificationDelivery.findUnique({
    where: { publicToken: input.publicToken },
    include: { campaign: { select: { id: true, ctaUrl: true, status: true } } },
  });
  if (!delivery) return { ok: false, error: "Notificación no encontrada", status: 404 };
  if (input.userId != null && delivery.userId !== input.userId) {
    return { ok: false, error: "No autorizado", status: 403 };
  }

  const target = delivery.campaign.ctaUrl || delivery.ctaUrl;
  if (!isSafeRedirect(target)) {
    return { ok: false, error: "URL de destino no permitida", status: 400 };
  }

  const firstClick = !delivery.clickedAt;
  await prisma.dnxNotificationDelivery.update({
    where: { id: delivery.id },
    data: {
      clickedAt: delivery.clickedAt ?? new Date(),
      clickCount: { increment: 1 },
      readAt: delivery.readAt ?? new Date(),
    },
  });
  if (firstClick) {
    await prisma.dnxNotificationCampaign.update({
      where: { id: delivery.campaignId },
      data: {
        clickCount: { increment: 1 },
        ...(delivery.readAt ? {} : { readCount: { increment: 1 } }),
      },
    });
  }

  if (delivery.dashboardNotificationId) {
    await prisma.dashboardNotification.updateMany({
      where: {
        id: delivery.dashboardNotificationId,
        userId: delivery.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  console.log(
    JSON.stringify({
      scope: "dnx_notifications_tracking",
      event: "click",
      campaignId: delivery.campaignId,
      deliveryId: delivery.id,
      firstClick,
    }),
  );

  return {
    ok: true,
    redirectUrl: target,
    deliveryId: delivery.id,
    campaignId: delivery.campaignId,
  };
}

export async function setAttributionCookie(deliveryId: string, campaignId: string) {
  const jar = await cookies();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + COOKIE_MAX_AGE * 1000;
  jar.set(
    ATTR_COOKIE,
    JSON.stringify({ deliveryId, campaignId, issuedAt, expiresAt }),
    {
      httpOnly: true,
      sameSite: "lax",
      // Preview Vercel también es HTTPS con NODE_ENV=production.
      secure:
        process.env.NODE_ENV === "production" ||
        process.env.VERCEL_ENV === "preview" ||
        process.env.VERCEL_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    },
  );
}

export async function readAttributionCookie(): Promise<{
  deliveryId: string;
  campaignId: string;
} | null> {
  const jar = await cookies();
  const raw = jar.get(ATTR_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      deliveryId?: string;
      campaignId?: string;
      expiresAt?: number;
    };
    if (!parsed.deliveryId || !parsed.campaignId) return null;
    if (
      typeof parsed.expiresAt === "number" &&
      Number.isFinite(parsed.expiresAt) &&
      Date.now() > parsed.expiresAt
    ) {
      jar.delete(ATTR_COOKIE);
      return null;
    }
    return { deliveryId: parsed.deliveryId, campaignId: parsed.campaignId };
  } catch {
    return null;
  }
}

export async function attributeApplicationFromCookie(input: {
  userId: number;
  clfEventId: number;
  eventMemberId?: number | null;
}): Promise<{ attributed: boolean }> {
  const cookie = await readAttributionCookie();
  if (!cookie) return { attributed: false };

  const delivery = await prisma.dnxNotificationDelivery.findFirst({
    where: {
      id: cookie.deliveryId,
      campaignId: cookie.campaignId,
      userId: input.userId,
      status: "SENT",
    },
    include: { campaign: { select: { clfEventId: true } } },
  });
  if (!delivery) return { attributed: false };
  if (
    delivery.campaign.clfEventId != null &&
    delivery.campaign.clfEventId !== input.clfEventId
  ) {
    return { attributed: false };
  }

  try {
    await prisma.dnxNotificationAttribution.create({
      data: {
        campaignId: delivery.campaignId,
        deliveryId: delivery.id,
        userId: input.userId,
        clfEventId: input.clfEventId,
        eventMemberId: input.eventMemberId ?? null,
      },
    });
    await prisma.dnxNotificationCampaign.update({
      where: { id: delivery.campaignId },
      data: { applicationCount: { increment: 1 } },
    });
    console.log(
      JSON.stringify({
        scope: "dnx_notifications_tracking",
        event: "application_attributed",
        campaignId: delivery.campaignId,
        deliveryId: delivery.id,
        clfEventId: input.clfEventId,
      }),
    );
    return { attributed: true };
  } catch {
    // unique → ya atribuida
    return { attributed: false };
  }
}
