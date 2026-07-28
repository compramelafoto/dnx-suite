import type { PublishAsset, SocialAccount } from "@repo/social-publisher";
import { Prisma, prisma } from "@/lib/admin/db";

export const WELCOME_PUBLISH_TEMPLATE = "clickaton.welcome.instagram.v1";

export function welcomeCaption(input: {
  firstName: string;
  lastName: string;
  editionName: string;
  instagramHandle?: string | null;
}): string {
  const name = `${input.firstName} ${input.lastName}`.trim();
  const handle = input.instagramHandle ? ` @${input.instagramHandle.replace(/^@/, "")}` : "";
  return `¡Bienvenida/o a Clickatón, ${name}!${handle}\n\nNos vemos en ${input.editionName}.`;
}

export function toPublishAssets(asset: {
  id: string;
  publicUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
} | null): PublishAsset[] {
  if (!asset) return [];
  return [{
    assetId: asset.id,
    kind: "IMAGE",
    publicUrl: asset.publicUrl,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    sortOrder: 0,
  }];
}

export function toSocialAccount(account: {
  id: string; platform: string; ownerUserId: number; externalAccountId: string;
  businessId: string | null; username: string | null; displayName: string | null;
  scopes: string[]; status: string; expiresAt: Date | null; lastValidatedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}): SocialAccount {
  return {
    ...account,
    platform: account.platform as SocialAccount["platform"],
    status: account.status as SocialAccount["status"],
  };
}

export async function resolveClickatonInstagramAccount() {
  const configuredId = process.env.CLICKATON_SOCIAL_ACCOUNT_ID?.trim();
  if (configuredId) {
    return prisma.dnxSocialAccount.findFirst({
      where: { id: configuredId, platform: "INSTAGRAM", status: "ACTIVE" },
    });
  }
  return prisma.dnxSocialAccount.findFirst({
    where: {
      platform: "INSTAGRAM",
      status: "ACTIVE",
      grants: { some: { application: { in: ["CLICKATON", "*"] }, canPublish: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function logSocialRequest(
  publishRequestId: string,
  action: string,
  actorUserId?: number | null,
  metadata?: Record<string, unknown>,
) {
  await prisma.dnxSocialPublishLog.create({
    data: {
      publishRequestId,
      action,
      actorUserId: actorUserId ?? null,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
