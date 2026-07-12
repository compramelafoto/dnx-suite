import { describe, expect, it, vi } from "vitest";
import {
  probeDeploymentUrl,
  resolveProbeUrl,
  runDeploymentHttpProbes,
} from "./deployment-probe.js";
import { VERCEL_PROTECTION_BYPASS_HEADER } from "./protection-bypass.js";

function mockFetch(
  handler: (input: string | URL, init?: RequestInit) => Promise<Response>,
): typeof fetch {
  return vi.fn(handler) as unknown as typeof fetch;
}

describe("deployment-probe", () => {
  it("resolveProbeUrl une base + path", () => {
    expect(resolveProbeUrl("https://app-preview.vercel.app", "/api/health")).toBe(
      "https://app-preview.vercel.app/api/health",
    );
  });

  it("envía bypass header cuando hay secret", async () => {
    const fetchImpl = mockFetch((input, init) => {
      expect(String(input)).toBe("https://preview.vercel.app/api/health");
      const headers = new Headers(init?.headers);
      expect(headers.get(VERCEL_PROTECTION_BYPASS_HEADER)).toBe("bypass-secret");
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    const result = await probeDeploymentUrl({
      url: "https://preview.vercel.app/api/health",
      expectedStatus: 200,
      fetchImpl,
      env: { VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-secret" },
    });

    expect(result.ok).toBe(true);
    expect(result.bypassApplied).toBe(true);
    expect(result.protectionBlocked).toBe(false);
    expect(JSON.stringify(result)).not.toContain("bypass-secret");
  });

  it("sin secret no envía header y mantiene comportamiento", async () => {
    const fetchImpl = mockFetch((_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get(VERCEL_PROTECTION_BYPASS_HEADER)).toBeNull();
      return Promise.resolve(
        new Response("<!DOCTYPE html><title>Login – Vercel</title>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
    });

    const result = await probeDeploymentUrl({
      url: "https://preview.vercel.app/",
      fetchImpl,
      env: {},
    });

    expect(result.bypassApplied).toBe(false);
    expect(result.protectionBlocked).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("detecta 401 Protected deployment", async () => {
    const fetchImpl = mockFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: { message: "Protected deployment" },
            protection: { vercel_auth_enabled: true },
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const result = await probeDeploymentUrl({
      url: "https://preview.vercel.app/api/auth/login",
      method: "POST",
      fetchImpl,
      env: {},
    });

    expect(result.protectionBlocked).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("runDeploymentHttpProbes reescribe smoke URLs al host del deployment", async () => {
    const fetchImpl = mockFetch((input) => {
      expect(String(input)).toBe("https://dpl-xyz.vercel.app/");
      return Promise.resolve(new Response("ok", { status: 200 }));
    });

    const suite = await runDeploymentHttpProbes({
      baseUrl: "https://dpl-xyz.vercel.app",
      smokeTests: [
        {
          id: "home",
          name: "Home",
          target: "https://preview.example.com/",
          type: "http",
        },
      ],
      // health a producción se ignora
      healthEndpoints: [
        {
          name: "prod",
          url: "https://example.com/api/health",
          method: "GET",
          expectedStatus: 200,
        },
      ],
      fetchImpl,
      env: { VERCEL_AUTOMATION_BYPASS_SECRET: "suite-bypass-secret" },
    });

    expect(suite.probes).toHaveLength(1);
    expect(suite.bypass.enabled).toBe(true);
    expect(suite.passed).toBe(true);
    expect(JSON.stringify(suite)).not.toContain("suite-bypass-secret");
  });
});
