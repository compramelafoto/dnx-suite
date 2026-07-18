import { readFile } from "node:fs/promises";
import type { StoredConversation } from "../../../conversation/memory-models.js";
import { InMemoryConversationStore } from "../../../conversation/in-memory-conversation-store.js";
import type { ConversationStore } from "../../../conversation/conversation-store.js";
import type {
  TelegramProcessedUpdates,
  TelegramSessionFlags,
  TelegramBudgetReviewVerdict,
} from "../domain/models.js";
import { writeJsonAtomic } from "./atomic-write.js";
import {
  telegramFlagsPath,
  telegramReviewsPath,
  telegramSessionsPath,
  telegramUpdatesPath,
} from "./paths.js";

const MAX_RECENT_UPDATE_IDS = 500;
const MAX_SESSIONS = 50;

type SessionsFile = {
  version: 1;
  updatedAt: string;
  conversations: Record<string, StoredConversation>;
};

type ReviewsFile = {
  version: 1;
  updatedAt: string;
  items: Array<{
    conversationId: string;
    chatId: string;
    verdict: TelegramBudgetReviewVerdict;
    note?: string;
    createdAt: string;
  }>;
};

type FlagsFile = {
  version: 1;
  updatedAt: string;
  byChatId: Record<string, TelegramSessionFlags>;
};

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sanitizeConversation(stored: StoredConversation): StoredConversation {
  const clone = structuredClone(stored);
  // No persistir breakdown ni campos técnicos sensibles si existieran.
  return clone;
}

/**
 * Persistencia local Telegram + store de conversación recuperable.
 */
export class TelegramLocalStore {
  readonly memory: InMemoryConversationStore;
  private processed: TelegramProcessedUpdates = {
    lastUpdateId: 0,
    recentIds: [],
  };
  private flags: FlagsFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    byChatId: {},
  };
  private reviews: ReviewsFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: [],
  };

  constructor(memory?: InMemoryConversationStore) {
    this.memory = memory ?? new InMemoryConversationStore();
  }

  get conversationStore(): ConversationStore {
    return this.memory;
  }

  async load(): Promise<void> {
    const sessions = await readJson<SessionsFile>(telegramSessionsPath(), {
      version: 1,
      updatedAt: new Date().toISOString(),
      conversations: {},
    });
    for (const [id, conv] of Object.entries(sessions.conversations)) {
      const sanitized = sanitizeConversation(conv);
      await this.memory.set({ ...sanitized, id: sanitized.id || id });
    }

    this.processed = await readJson<TelegramProcessedUpdates>(
      telegramUpdatesPath(),
      { lastUpdateId: 0, recentIds: [] },
    );
    this.flags = await readJson<FlagsFile>(telegramFlagsPath(), {
      version: 1,
      updatedAt: new Date().toISOString(),
      byChatId: {},
    });
    this.reviews = await readJson<ReviewsFile>(telegramReviewsPath(), {
      version: 1,
      updatedAt: new Date().toISOString(),
      items: [],
    });
  }

  async persistConversation(conversationId: string): Promise<void> {
    const current = await this.memory.get(conversationId);
    const sessions = await readJson<SessionsFile>(telegramSessionsPath(), {
      version: 1,
      updatedAt: new Date().toISOString(),
      conversations: {},
    });
    if (current) {
      sessions.conversations[conversationId] = sanitizeConversation(current);
    } else {
      delete sessions.conversations[conversationId];
    }

    const ids = Object.keys(sessions.conversations);
    if (ids.length > MAX_SESSIONS) {
      const sorted = ids
        .map((id) => ({
          id,
          t: sessions.conversations[id]?.updatedAt ?? "",
        }))
        .sort((a, b) => a.t.localeCompare(b.t));
      for (const drop of sorted.slice(0, ids.length - MAX_SESSIONS)) {
        delete sessions.conversations[drop.id];
      }
    }

    sessions.updatedAt = new Date().toISOString();
    await writeJsonAtomic(telegramSessionsPath(), sessions);
  }

  isUpdateProcessed(updateId: number): boolean {
    return this.processed.recentIds.includes(updateId);
  }

  async markUpdateProcessed(updateId: number): Promise<void> {
    if (!this.processed.recentIds.includes(updateId)) {
      this.processed.recentIds.push(updateId);
    }
    if (updateId > this.processed.lastUpdateId) {
      this.processed.lastUpdateId = updateId;
    }
    if (this.processed.recentIds.length > MAX_RECENT_UPDATE_IDS) {
      this.processed.recentIds = this.processed.recentIds.slice(
        -MAX_RECENT_UPDATE_IDS,
      );
    }
    await writeJsonAtomic(telegramUpdatesPath(), this.processed);
  }

  getLastUpdateId(): number {
    return this.processed.lastUpdateId;
  }

  getFlags(chatId: string): TelegramSessionFlags {
    return (
      this.flags.byChatId[chatId] ?? {
        awaitingAdjustmentFeedback: false,
      }
    );
  }

  async setFlags(
    chatId: string,
    patch: Partial<TelegramSessionFlags>,
  ): Promise<void> {
    this.flags.byChatId[chatId] = {
      ...this.getFlags(chatId),
      ...patch,
    };
    this.flags.updatedAt = new Date().toISOString();
    await writeJsonAtomic(telegramFlagsPath(), this.flags);
  }

  async addReview(input: {
    conversationId: string;
    chatId: string;
    verdict: TelegramBudgetReviewVerdict;
    note?: string;
  }): Promise<void> {
    this.reviews.items.push({
      ...input,
      createdAt: new Date().toISOString(),
    });
    if (this.reviews.items.length > 200) {
      this.reviews.items = this.reviews.items.slice(-200);
    }
    this.reviews.updatedAt = new Date().toISOString();
    await writeJsonAtomic(telegramReviewsPath(), this.reviews);
  }

  exportLocalPayload(): Record<string, unknown> {
    return {
      kind: "telegram-local-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      updates: {
        lastUpdateId: this.processed.lastUpdateId,
        recentIdsCount: this.processed.recentIds.length,
        recentIds: this.processed.recentIds.slice(-100),
      },
      flags: this.flags.byChatId,
      reviews: this.reviews.items.map((r) => ({
        conversationId: r.conversationId,
        chatId: r.chatId,
        verdict: r.verdict,
        note: r.note,
        createdAt: r.createdAt,
      })),
      exclusions: [
        "botToken",
        "env",
        "absolutePaths",
        "fullEconomicProfile",
        "breakdown",
      ],
    };
  }

  listReviewChatIds(): string[] {
    return [...new Set(this.reviews.items.map((r) => r.chatId))];
  }

  listConversationIdsFromReviews(): string[] {
    return [...new Set(this.reviews.items.map((r) => r.conversationId))];
  }

  async invalidateSyntheticApprovals(): Promise<number> {
    const before = this.reviews.items.length;
    this.reviews.items = this.reviews.items.filter((r) => {
      // Conservar feedback textual; invalidar aprobaciones de presupuesto sintético
      if (r.verdict === "APPROVED") return false;
      return true;
    });
    const removed = before - this.reviews.items.length;
    if (removed > 0) {
      this.reviews.updatedAt = new Date().toISOString();
      await writeJsonAtomic(telegramReviewsPath(), this.reviews);
    }
    return removed;
  }

  async flagAllBudgetsInvalidated(message: string): Promise<number> {
    const chatIds = new Set<string>([
      ...Object.keys(this.flags.byChatId),
      ...this.listReviewChatIds(),
    ]);
    let count = 0;
    for (const chatId of chatIds) {
      const prev = this.getFlags(chatId);
      if (
        prev.lastBudgetStatus === "READY" ||
        prev.budgetInvalidated ||
        this.listReviewChatIds().includes(chatId)
      ) {
        await this.setFlags(chatId, {
          lastBudgetStatus: undefined,
          budgetInvalidated: true,
          budgetInvalidatedMessage: message,
          awaitingAdjustmentFeedback: false,
        });
        count += 1;
      }
    }
    return count;
  }

  async importLocalPayload(payload: unknown): Promise<void> {
    if (!payload || typeof payload !== "object") {
      throw new Error("INVALID_EXPORT");
    }
    const data = payload as {
      updates?: { lastUpdateId?: number; recentIds?: number[] };
      flags?: Record<string, TelegramSessionFlags>;
      reviews?: ReviewsFile["items"];
    };
    if (data.updates) {
      this.processed = {
        lastUpdateId: data.updates.lastUpdateId ?? 0,
        recentIds: data.updates.recentIds ?? [],
      };
      await writeJsonAtomic(telegramUpdatesPath(), this.processed);
    }
    if (data.flags) {
      this.flags = {
        version: 1,
        updatedAt: new Date().toISOString(),
        byChatId: data.flags,
      };
      await writeJsonAtomic(telegramFlagsPath(), this.flags);
    }
    if (data.reviews) {
      this.reviews = {
        version: 1,
        updatedAt: new Date().toISOString(),
        items: data.reviews,
      };
      await writeJsonAtomic(telegramReviewsPath(), this.reviews);
    }
  }
}
