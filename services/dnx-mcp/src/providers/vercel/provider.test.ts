import { describe, expect, it, vi } from "vitest";
import { VercelProvider } from "./provider.js";
import { VercelHelpers } from "./helpers/index.js";
import type { VercelDeployment, VercelEnvVar } from "./types/index.js";

describe("VercelProvider", () => {
  it("reporta no configurado sin token", () => {
    const provider = new VercelProvider({ config: { token: "" } });
    expect(provider.isConfigured()).toBe(false);
  });

  it("reporta configurado con token", () => {
    const provider = new VercelProvider({ config: { token: "tok_test" } });
    expect(provider.isConfigured()).toBe(true);
  });

  it("expone servicios desacoplados", () => {
    const provider = new VercelProvider({ config: { token: "tok_test" } });

    expect(provider.auth).toBeDefined();
    expect(provider.projects).toBeDefined();
    expect(provider.deployments).toBeDefined();
    expect(provider.envVars).toBeDefined();
    expect(provider.domains).toBeDefined();
    expect(provider.logs).toBeDefined();
    expect(provider.helpers).toBeInstanceOf(VercelHelpers);
  });
});

describe("VercelHelpers", () => {
  it("compara variables de entorno entre targets", async () => {
    const sourceEnvs: VercelEnvVar[] = [
      { key: "API_URL", value: "https://staging.api", target: ["preview"] },
      { key: "ONLY_PREVIEW", value: "1", target: ["preview"] },
    ];

    const targetEnvs: VercelEnvVar[] = [
      { key: "API_URL", value: "https://api", target: ["production"] },
      { key: "ONLY_PROD", value: "1", target: ["production"] },
    ];

    const helpers = new VercelHelpers(
      {} as never,
      {} as never,
      {
        list: vi.fn().mockResolvedValueOnce(sourceEnvs).mockResolvedValueOnce(targetEnvs),
      } as never,
    );

    const result = await helpers.compareEnvironmentVariables(
      "project-a",
      "project-b",
      "preview",
      "production",
    );

    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]?.key).toBe("API_URL");
    expect(result.onlyInSource).toHaveLength(1);
    expect(result.onlyInTarget).toHaveLength(1);
  });

  it("determina salud del deployment", () => {
    const helpers = new VercelHelpers({} as never, {} as never, {} as never);

    expect(helpers.getDeploymentHealth({ id: "1", readyState: "READY" })).toBe("healthy");
    expect(helpers.getDeploymentHealth({ id: "1", readyState: "BUILDING" })).toBe("building");
    expect(helpers.getDeploymentHealth({ id: "1", readyState: "ERROR" })).toBe("failed");
  });

  it("espera hasta estado terminal del deployment", async () => {
    const deployments = [
      { id: "dpl_1", readyState: "BUILDING" as const },
      { id: "dpl_1", readyState: "READY" as const },
    ];

    const helpers = new VercelHelpers(
      {} as never,
      {
        get: vi.fn().mockImplementation(() => Promise.resolve(deployments.shift())),
      } as never,
      {} as never,
    );

    const result = await helpers.waitUntilDeploymentReady("dpl_1", {
      pollIntervalMs: 1,
      timeoutMs: 1_000,
    });

    expect(result.readyState).toBe("READY");
  });

  it("hace rollback al deployment anterior exitoso", async () => {
    const previous: VercelDeployment = { id: "dpl_prev", readyState: "READY" };
    const current: VercelDeployment = { id: "dpl_curr", readyState: "READY" };

    const redeploy = vi.fn().mockResolvedValue(previous);
    const helpers = new VercelHelpers(
      {} as never,
      {
        list: vi.fn().mockResolvedValue([current, previous]),
        redeploy,
      } as never,
      {} as never,
    );

    const result = await helpers.rollbackToPreviousDeployment("my-project");

    expect(redeploy).toHaveBeenCalledWith({
      deploymentId: "dpl_prev",
      target: "production",
    });
    expect(result.id).toBe("dpl_prev");
  });
});
