import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@repo/dnx-bot";
import { readBotConfig } from "@/lib/bot/config";

import { getMessage, listMessageIds } from "./gmail";
import { refreshAccessToken } from "./google-oauth";
import type { SyncPorts } from "./sync";
import { openRefreshToken, vaultKeyFromEnv } from "./token-vault";

export function googleClient(env: Record<string, string | undefined> = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET.");
  return { clientId, clientSecret };
}

export function mailRedirectUri(origin: string): string {
  return `${origin}/api/admin/finance-dnx/mail/callback`;
}

export function prismaSyncPorts(): SyncPorts {
  const { clientId, clientSecret } = googleClient();
  const key = vaultKeyFromEnv();
  return {
    async getAccessToken(account) {
      const row = await prisma.expenseMailAccount.findUniqueOrThrow({ where: { id: account.id } });
      return refreshAccessToken({ refreshToken: openRefreshToken(row.refreshTokenEnc, key), clientId, clientSecret });
    },
    listIds: (accessToken, query, pageToken) => listMessageIds({ accessToken, query, pageToken }),
    getMessage: (accessToken, id) => getMessage({ accessToken, id }),
    async knownIds(ids) {
      if (ids.length === 0) return new Set();
      const rows = await prisma.expenseMailMessage.findMany({
        where: { gmailMessageId: { in: ids } },
        select: { gmailMessageId: true },
      });
      return new Set(rows.map((r) => r.gmailMessageId));
    },
    async saveMessage(msg) {
      // upsert vacío: si dos ejecuciones se cruzan, el índice único evita el duplicado sin tirar.
      await prisma.expenseMailMessage.upsert({
        where: { gmailMessageId: msg.gmailMessageId },
        create: { ...msg, status: "PARA_REVISAR" },
        update: {},
      });
    },
    async markSynced(accountId, at, backfillDone) {
      await prisma.expenseMailAccount.update({
        where: { id: accountId },
        data: { lastSyncAt: at, backfillDone, lastError: null, lastErrorAlertedAt: null },
      });
    },
    async markError(accountId, message, alertedAt) {
      await prisma.expenseMailAccount.update({
        where: { id: accountId },
        data: { lastError: message.slice(0, 500), lastErrorAlertedAt: alertedAt },
      });
    },
    async notify(text) {
      await sendTelegramMessage(readBotConfig().telegram, text);
    },
  };
}
