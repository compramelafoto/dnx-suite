import type { PostgresClientAdapter } from "../client/postgres-client.js";
import { SQL_PING, SQL_VERSION } from "../queries/readonly-queries.js";
import type { PingResult } from "../types/index.js";
import { pingResultSchema } from "../types/index.js";

export class PostgresConnectionService {
  constructor(private readonly client: PostgresClientAdapter) {}

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  async ping(): Promise<PingResult> {
    const startedAt = Date.now();
    const result = await this.client.query<{ ok: number }>(SQL_PING, [], "ping");
    const ok = result.rows[0]?.ok === 1;

    return pingResultSchema.parse({
      ok,
      latencyMs: Date.now() - startedAt,
    });
  }

  async getVersion(): Promise<string> {
    const result = await this.client.query<{ version: string }>(SQL_VERSION, [], "version");
    return result.rows[0]?.version ?? "unknown";
  }
}
