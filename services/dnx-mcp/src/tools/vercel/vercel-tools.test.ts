import { afterEach, describe, expect, it, vi } from "vitest";
import type { VercelProvider } from "../../providers/vercel/index.js";
import { handleVercelDeployRelease } from "./vercel-deploy-release.js";
import { handleVercelPrepareStaging } from "./vercel-prepare-staging.js";
import { handleVercelStatus } from "./vercel-status.js";
import { handleVercelValidateStaging } from "./vercel-validate-staging.js";

function createMockProvider(): VercelProvider {
  return {
    name: "vercel",
    isConfigured: () => true,
    auth: {
      getUser: vi.fn().mockResolvedValue({ id: "u1", email: "a@b.com" }),
      listTeams: vi.fn().mockResolvedValue([{ id: "t1", slug: "team" }]),
      getActiveTeamScope: vi.fn().mockReturnValue({ teamId: "t1" }),
    },
    projects: {
      list: vi.fn().mockResolvedValue([{ id: "p1", name: "app", framework: "nextjs" }]),
      findOne: vi.fn().mockResolvedValue({ id: "p1", name: "app", framework: "nextjs" }),
      getAliases: vi.fn().mockResolvedValue(["app.vercel.app"]),
    },
    domains: {
      list: vi.fn().mockResolvedValue([{ name: "app.vercel.app", verified: true }]),
    },
    helpers: {
      getProductionDeployment: vi
        .fn()
        .mockResolvedValue({ id: "dpl_prod", readyState: "READY", url: "app.com" }),
      getPreviewDeployment: vi
        .fn()
        .mockResolvedValue({ id: "dpl_prev", readyState: "READY", url: "app-preview.vercel.app" }),
    },
    prepareStaging: vi.fn().mockResolvedValue({
      project: "app",
      previewDeployment: { id: "dpl_prev", readyState: "READY" },
      productionDeployment: { id: "dpl_prod", readyState: "READY" },
      envDiff: { onlyInSource: [], onlyInTarget: [], changed: [], equal: [] },
      domains: ["app.vercel.app"],
    }),
    getDeploymentHealth: vi.fn().mockReturnValue("healthy"),
    deployAndWait: vi.fn(),
    deployments: {
      get: vi.fn().mockResolvedValue({
        id: "dpl_prev",
        readyState: "READY",
        url: "app-preview.vercel.app",
      }),
      getAliases: vi.fn().mockResolvedValue(["app-preview.vercel.app"]),
    },
    logs: {
      getBuildLogs: vi.fn().mockResolvedValue([]),
      getRuntimeLogs: vi.fn().mockResolvedValue([]),
      formatLogs: vi.fn().mockReturnValue(""),
    },
    envVars: {
      list: vi.fn().mockResolvedValue([
        { key: "DATABASE_URL", target: ["preview"] },
        { key: "DATABASE_URL", target: ["production"] },
      ]),
    },
  } as unknown as VercelProvider;
}

describe("vercel MCP tools", () => {
  it("vercel_status en dryRun devuelve preview", async () => {
    const result = await handleVercelStatus(createMockProvider(), {
      dryRun: true,
    });

    expect(result).toMatchObject({ dryRun: true });
  });

  it("vercel_status devuelve panorama de cuenta", async () => {
    const result = await handleVercelStatus(createMockProvider(), {
      dryRun: false,
    });

    expect(result).toMatchObject({
      authenticatedUser: { id: "u1" },
      summary: { totalProjects: 1 },
    });
  });

  it("vercel_prepare_staging no despliega", async () => {
    const deployAndWait = vi.fn();
    const base = createMockProvider();
    Object.assign(base, { deployAndWait });

    const result = await handleVercelPrepareStaging(base, {
      project: "app",
      dryRun: false,
    });

    expect(result).toMatchObject({
      stagingReady: true,
      note: "Preparación completada. No se realizó ningún deploy.",
    });
    expect(deployAndWait).not.toHaveBeenCalled();
  });

  it("vercel_deploy_release en dryRun no ejecuta deploy", async () => {
    const deployAndWait = vi.fn();
    const base = createMockProvider();
    Object.assign(base, { deployAndWait });
    const result = await handleVercelDeployRelease(base, {
      project: "app",
      target: "production",
      dryRun: true,
      confirm: false,
      timeoutMs: 60_000,
    });

    expect(result).toMatchObject({ dryRun: true, executed: false });
    expect(deployAndWait).not.toHaveBeenCalled();
  });

  it("vercel_validate_staging dryRun reporta protectionBypass sin secret", async () => {
    const prev = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

    const result = await handleVercelValidateStaging(createMockProvider(), {
      project: "app",
      dryRun: true,
    });

    expect(result).toMatchObject({
      dryRun: true,
      protectionBypass: { enabled: false },
    });
    expect("wouldValidate" in result && result.wouldValidate).toEqual(
      expect.arrayContaining(["http_probes"]),
    );

    if (prev === undefined) {
      delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    } else {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = prev;
    }
  });

  it("vercel_validate_staging aplica bypass en HTTP probes", async () => {
    const prev = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "unit-test-bypass";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("x-vercel-protection-bypass")).toBe("unit-test-bypass");
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      expect(url).toContain("app-preview.vercel.app");
      return Promise.resolve(
        new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
      );
    });

    try {
      const result = await handleVercelValidateStaging(createMockProvider(), {
        project: "app",
        dryRun: false,
      });

      expect(result).toMatchObject({
        protectionBypass: { enabled: true, header: "x-vercel-protection-bypass" },
      });
      expect(JSON.stringify(result)).not.toContain("unit-test-bypass");
      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      if (prev === undefined) {
        delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      } else {
        process.env.VERCEL_AUTOMATION_BYPASS_SECRET = prev;
      }
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
