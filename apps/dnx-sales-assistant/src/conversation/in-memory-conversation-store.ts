import {
  CONVERSATION_TTL_MS,
  MAX_CONVERSATIONS,
} from "./memory-config.js";
import type { ConversationStore } from "./conversation-store.js";
import type { StoredConversation } from "./memory-models.js";

export type InMemoryConversationStoreOptions = {
  ttlMs?: number;
  maxConversations?: number;
  now?: () => Date;
};

type InternalEntry = StoredConversation;

/**
 * Store efímero en RAM. El Map es privado; el resto del sistema usa ConversationStore.
 */
export class InMemoryConversationStore implements ConversationStore {
  readonly #entries = new Map<string, InternalEntry>();
  readonly #locks = new Map<string, Promise<void>>();
  readonly #ttlMs: number;
  readonly #maxConversations: number;
  readonly #now: () => Date;

  constructor(options: InMemoryConversationStoreOptions = {}) {
    this.#ttlMs = options.ttlMs ?? CONVERSATION_TTL_MS;
    this.#maxConversations = options.maxConversations ?? MAX_CONVERSATIONS;
    this.#now = options.now ?? (() => new Date());
  }

  /** Solo para tests: cantidad de entradas (sin exponer el Map). */
  size(): number {
    return this.#entries.size;
  }

  async get(conversationId: string): Promise<StoredConversation | undefined> {
    this.#purgeExpired();
    const entry = this.#entries.get(conversationId);
    if (!entry) return undefined;
    if (this.#isExpired(entry)) {
      this.#entries.delete(conversationId);
      return undefined;
    }
    return cloneConversation(entry);
  }

  async set(conversation: StoredConversation): Promise<void> {
    this.#purgeExpired();
    this.#entries.set(conversation.id, cloneConversation(conversation));
    this.#enforceMaxSize();
  }

  async delete(conversationId: string): Promise<void> {
    this.#entries.delete(conversationId);
    this.#locks.delete(conversationId);
  }

  async update(
    conversationId: string,
    mutator: (
      current: StoredConversation | undefined,
    ) => Promise<StoredConversation | undefined> | StoredConversation | undefined,
  ): Promise<StoredConversation | undefined> {
    return this.#withLock(conversationId, async () => {
      const current = await this.get(conversationId);
      const next = await mutator(current);
      if (next === undefined) {
        await this.delete(conversationId);
        return undefined;
      }
      await this.set(next);
      return next;
    });
  }

  async #withLock<T>(conversationId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.#locks.get(conversationId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chain = previous.then(() => gate);
    this.#locks.set(conversationId, chain);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.#locks.get(conversationId) === chain) {
        this.#locks.delete(conversationId);
      }
    }
  }

  #isExpired(entry: StoredConversation, at = this.#now()): boolean {
    return Date.parse(entry.expiresAt) <= at.getTime();
  }

  #purgeExpired(): void {
    const at = this.#now();
    for (const [id, entry] of this.#entries) {
      if (this.#isExpired(entry, at)) {
        this.#entries.delete(id);
      }
    }
  }

  #enforceMaxSize(): void {
    this.#purgeExpired();
    while (this.#entries.size > this.#maxConversations) {
      let oldestId: string | undefined;
      let oldestUpdated = Number.POSITIVE_INFINITY;
      for (const [id, entry] of this.#entries) {
        const updated = Date.parse(entry.updatedAt);
        if (updated < oldestUpdated) {
          oldestUpdated = updated;
          oldestId = id;
        }
      }
      if (!oldestId) break;
      this.#entries.delete(oldestId);
    }
  }

  /** Extiende expiresAt desde ahora + TTL. */
  nextExpiresAt(from = this.#now()): string {
    return new Date(from.getTime() + this.#ttlMs).toISOString();
  }

  now(): Date {
    return this.#now();
  }
}

function cloneDraft(
  draft: StoredConversation["quoteRequestDraft"],
): StoredConversation["quoteRequestDraft"] {
  if (!draft) return undefined;
  return { ...draft };
}

function clonePricingResult(
  result: StoredConversation["pricingResult"],
): StoredConversation["pricingResult"] {
  if (!result) return undefined;
  return {
    ...result,
    warnings: result.warnings.map((w) => ({ ...w })),
  };
}

function cloneConversation(entry: StoredConversation): StoredConversation {
  return {
    ...entry,
    quoteRequestDraft: cloneDraft(entry.quoteRequestDraft),
    pricingResult: clonePricingResult(entry.pricingResult),
    pricingCacheKey: entry.pricingCacheKey,
  };
}
