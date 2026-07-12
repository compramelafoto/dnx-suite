import { describe, expect, it, vi } from "vitest";
import { VercelHttpClient } from "./http-client.js";
import { VercelAuthError, VercelNotFoundError } from "../errors.js";
import type { VercelConfig } from "../config.js";

const baseConfig: VercelConfig = {
  token: "test-token",
  baseUrl: "https://api.vercel.com",
  maxRetries: 0,
  retryBaseDelayMs: 10,
  requestsPerMinute: 100,
};

function createMockFetch(
  handler: (input: string | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return vi.fn(handler) as unknown as typeof fetch;
}

describe("VercelHttpClient", () => {
  it("adjunta Authorization y teamId en requests", async () => {
    const fetchImpl = createMockFetch((input, init) => {
      const url = String(input);
      expect(url).toContain("teamId=team_123");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer test-token");

      return Promise.resolve(
        new Response(JSON.stringify({ user: { id: "usr_1" } }), { status: 200 }),
      );
    });

    const client = new VercelHttpClient({
      config: { ...baseConfig, teamId: "team_123" },
      fetchImpl,
    });

    await client.get("/v2/user");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("mapea 401 a VercelAuthError", async () => {
    const fetchImpl = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
          status: 401,
        }),
      ),
    );

    const client = new VercelHttpClient({ config: baseConfig, fetchImpl });

    await expect(client.get("/v2/user")).rejects.toBeInstanceOf(VercelAuthError);
  });

  it("mapea 404 a VercelNotFoundError", async () => {
    const fetchImpl = createMockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "Not found" } }), {
          status: 404,
        }),
      ),
    );

    const client = new VercelHttpClient({ config: baseConfig, fetchImpl });

    await expect(client.get("/v9/projects/missing")).rejects.toBeInstanceOf(VercelNotFoundError);
  });
});
