import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token-hash";
import { getAuthUser } from "@/lib/auth";
import InviteClient from "./InviteClient";

export default async function InvitePage({
  params,
}: {
  params: { token: string } | Promise<{ token: string }>;
}) {
  const { token } = await Promise.resolve(params);
  const rawToken = String(token || "").trim();

  if (!rawToken) {
    return <InviteClient token="" invitation={null} user={null} hasAccess={false} />;
  }

  const tokenHash = hashToken(rawToken);
  const invitation = await prisma.albumInvitation.findUnique({
    where: { tokenHash },
    include: {
      album: { select: { id: true, title: true, publicSlug: true } },
    },
  });

  if (invitation && invitation.status === "PENDING" && invitation.expiresAt < new Date()) {
    await prisma.albumInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    invitation.status = "EXPIRED";
  }

  const authUser = await getAuthUser();
  const user = authUser
    ? await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, email: true, emailVerifiedAt: true },
      })
    : null;

  const hasAccess =
    user && invitation
      ? await prisma.albumAccess.findUnique({
          where: { albumId_userId: { albumId: invitation.albumId, userId: user.id } },
        })
      : null;

  return <InviteClient token={rawToken} invitation={invitation} user={user} hasAccess={Boolean(hasAccess)} />;
}
