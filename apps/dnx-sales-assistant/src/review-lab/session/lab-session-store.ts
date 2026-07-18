import { randomUUID } from "node:crypto";
import type { ConversationStyleEngine } from "../../conversation/style/conversation-style-engine.js";
import {
  LAB_MAX_SESSIONS,
  LAB_SESSION_TTL_MS,
} from "./lab-limits.js";
import type { LabSession } from "./lab-models.js";

export class LabSessionStore {
  private readonly sessions = new Map<string, LabSession>();

  constructor(
    private readonly options: {
      maxSessions?: number;
      ttlMs?: number;
      now?: () => Date;
    } = {},
  ) {}

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private ttlMs(): number {
    return this.options.ttlMs ?? LAB_SESSION_TTL_MS;
  }

  private maxSessions(): number {
    return this.options.maxSessions ?? LAB_MAX_SESSIONS;
  }

  purgeExpired(): void {
    const now = this.now().getTime();
    for (const [id, session] of this.sessions) {
      if (new Date(session.expiresAt).getTime() <= now) {
        this.sessions.delete(id);
      }
    }
  }

  create(styleEngine: ConversationStyleEngine = "dani-conversation-v1"): LabSession {
    this.purgeExpired();
    while (this.sessions.size >= this.maxSessions()) {
      const oldest = [...this.sessions.values()].sort(
        (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      )[0];
      if (!oldest) break;
      this.sessions.delete(oldest.id);
    }

    const now = this.now();
    const id = randomUUID();
    const session: LabSession = {
      id,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs()).toISOString(),
      participantFrom: `lab${id.replace(/-/g, "").slice(0, 12)}`,
      styleEngine,
      turns: [],
      humanReviews: [],
      humanVisualReviews: [],
    };
    this.sessions.set(id, session);
    return session;
  }

  get(id: string): LabSession | undefined {
    this.purgeExpired();
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (new Date(session.expiresAt).getTime() <= this.now().getTime()) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  save(session: LabSession): void {
    session.updatedAt = this.now().toISOString();
    session.expiresAt = new Date(this.now().getTime() + this.ttlMs()).toISOString();
    this.sessions.set(session.id, session);
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  size(): number {
    this.purgeExpired();
    return this.sessions.size;
  }
}
