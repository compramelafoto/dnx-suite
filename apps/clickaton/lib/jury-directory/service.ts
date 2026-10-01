/**
 * Alta y consulta de jurados desde Clickatón.
 *
 * El padrón es uno solo y vive en la base de FotoRank. Acá nunca se crea una
 * cuenta local: la ficha espejo de `lib/jury-mirror` es otra cosa y no
 * autentica a nadie. Si esto escribiera en la base propia, Clickatón terminaría
 * con un padrón paralelo y el jurado no podría entrar al portal.
 *
 * Invitar NO crea la cuenta: crea una invitación con un token. La cuenta nace
 * cuando la persona la acepta y elige su contraseña, igual que en FotoRank. Por
 * eso desde acá nunca se escribe un `passwordHash`.
 */
import { createHash, randomBytes } from "node:crypto";

/** Cuenta suficiente para lo que valida esta capa; el formato real lo revisa el proveedor de correo. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Una invitación que no vence es una puerta abierta para siempre. */
const VIGENCIA_DIAS = 14;

export function validateJudgeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return EMAIL.test(email) ? email : null;
}

export type DirectoryPrisma = {
  fotorankJudgeAccount: {
    findUnique(args: { where: { email: string } }): Promise<{ id: string } | null>;
  };
  fotorankJudgeInvitation: {
    findFirst(args: {
      where: Record<string, unknown>;
    }): Promise<{ id: string } | null>;
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
};

export type InviteJudgeResult =
  | { ok: true; invitationId: string; token: string; judgeAccountId: string | null }
  | {
      ok: false;
      reason: "NOT_CONFIGURED" | "ALREADY_INVITED" | "INVALID_EMAIL";
    };

export async function inviteJudge(input: {
  email: string;
  organizationId: string;
  contestId: string;
  sentByUserId: number;
  prisma: DirectoryPrisma | null;
  now?: Date;
}): Promise<InviteJudgeResult> {
  const email = validateJudgeEmail(input.email);
  if (!email) return { ok: false, reason: "INVALID_EMAIL" };
  if (!input.prisma) return { ok: false, reason: "NOT_CONFIGURED" };

  const now = input.now ?? new Date();

  // Si ya tiene cuenta en el padrón, la invitación la referencia en vez de
  // duplicar a la persona: un jurado, una identidad.
  const account = await input.prisma.fotorankJudgeAccount.findUnique({
    where: { email },
  });

  const pendiente = await input.prisma.fotorankJudgeInvitation.findFirst({
    where: {
      email,
      contestId: input.contestId,
      invitationStatus: "SENT",
      expiresAt: { gt: now },
    },
  });
  if (pendiente) return { ok: false, reason: "ALREADY_INVITED" };

  // Sólo se guarda el hash: el token en claro viaja una vez, en el correo.
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(now.getTime() + VIGENCIA_DIAS * 24 * 60 * 60 * 1000);

  const invitation = await input.prisma.fotorankJudgeInvitation.create({
    data: {
      organizationId: input.organizationId,
      contestId: input.contestId,
      judgeAccountId: account?.id ?? null,
      email,
      tokenHash,
      expiresAt,
      invitationStatus: "SENT",
      sentByUserId: input.sentByUserId,
    },
  });

  return {
    ok: true,
    invitationId: invitation.id,
    token,
    judgeAccountId: account?.id ?? null,
  };
}
