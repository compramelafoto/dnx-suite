import { describe, expect, it, vi } from "vitest";
import type { GoogleCloudProvider } from "../../providers/google-cloud/index.js";
import { GoogleCloudError } from "../../providers/google-cloud/errors.js";
import { getGoogleCloudProvider } from "./context.js";

function createMockProvider(overrides: Partial<GoogleCloudProvider> = {}): GoogleCloudProvider {
  return {
    name: "google-cloud",
    isConfigured: () => true,
    config: {
      enabled: true,
      defaultProject: "",
      defaultRegion: "southamerica-east1",
      allowedProjectPrefixes: ["dnx-"],
      allowWrites: false,
      allowProductionWrites: false,
      allowHighRiskWrites: false,
      allowDestructiveActions: false,
      allowServiceAccountKeys: false,
      commandTimeoutMs: 1000,
      maxOutputBytes: 1024,
      auditLogEnabled: false,
      binary: "gcloud",
    },
    checkInstallation: vi.fn().mockResolvedValue({
      success: true,
      installed: true,
      binaryPath: "/usr/bin/gcloud",
      version: { sdk: "1" },
      changed: false,
      dryRun: false,
      riskLevel: "READ_ONLY",
      actions: [],
      warnings: [],
      errors: [],
      metadata: {},
    }),
    listAccounts: vi.fn(),
    getAuthStatus: vi.fn(),
    getActiveAccount: vi.fn(),
    getActiveProject: vi.fn(),
    runDoctor: vi.fn(),
    listProjects: vi.fn(),
    getProject: vi.fn(),
    setProject: vi.fn().mockResolvedValue({
      success: true,
      dryRun: true,
      changed: false,
      riskLevel: "LOW_RISK_WRITE",
      currentProjectId: "dnx-old",
      requestedProjectId: "dnx-example",
      actions: [],
      warnings: [],
      errors: [],
      metadata: {},
    }),
    checkBilling: vi.fn(),
    listEnabledServices: vi.fn(),
    listAvailableServices: vi.fn(),
    planEnableServices: vi.fn(),
    enableServices: vi.fn().mockResolvedValue({
      success: true,
      dryRun: true,
      changed: false,
      riskLevel: "LOW_RISK_WRITE",
      requested: [],
      alreadyEnabled: [],
      pending: ["iam.googleapis.com"],
      enabledNow: [],
      actions: [],
      warnings: [],
      errors: [],
      metadata: {},
    }),
    listServiceAccounts: vi.fn(),
    planServiceAccount: vi.fn(),
    createServiceAccount: vi.fn(),
    listSecrets: vi.fn(),
    getSecretMetadata: vi.fn(),
    planSecret: vi.fn(),
    createSecret: vi.fn(),
    addSecretVersion: vi.fn().mockResolvedValue({
      success: true,
      dryRun: true,
      changed: false,
      riskLevel: "HIGH_RISK_WRITE",
      secretId: "database-url",
      valueProvided: true,
      actions: [],
      warnings: [],
      errors: [],
      metadata: {},
    }),
    ...overrides,
  } as unknown as GoogleCloudProvider;
}

describe("google-cloud tools context", () => {
  it("getGoogleCloudProvider exige enabled", () => {
    const provider = createMockProvider({
      isConfigured: () => false,
    });
    expect(() => getGoogleCloudProvider(provider)).toThrow(GoogleCloudError);
  });

  it("getGoogleCloudProvider ok cuando enabled", () => {
    const provider = createMockProvider();
    expect(getGoogleCloudProvider(provider).name).toBe("google-cloud");
  });
});

describe("google-cloud write tools dryRun contracts", () => {
  it("enableServices mock dryRun no cambia", async () => {
    const provider = createMockProvider();
    const result = await provider.enableServices({
      projectId: "dnx-example",
      environment: "development",
      services: ["iam.googleapis.com"],
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.enabledNow).toEqual([]);
  });

  it("addSecretVersion mock no incluye value en resultado", async () => {
    const provider = createMockProvider();
    const result = await provider.addSecretVersion({
      projectId: "dnx-example",
      environment: "development",
      secretId: "database-url",
      value: "SHOULD_NOT_APPEAR",
      dryRun: true,
    });
    expect(result.valueProvided).toBe(true);
    expect(JSON.stringify(result)).not.toContain("SHOULD_NOT_APPEAR");
  });

  it("setProject mock dryRun", async () => {
    const provider = createMockProvider();
    const result = await provider.setProject({
      projectId: "dnx-example",
      environment: "development",
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.requestedProjectId).toBe("dnx-example");
  });
});
