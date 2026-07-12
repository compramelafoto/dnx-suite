import { describe, expect, it, vi } from "vitest";
import { createGoogleCloudProvider } from "./provider.js";
import { buildGcloudArgs } from "./executor.js";
import { GoogleCloudError } from "./errors.js";
import { redactSecrets, scrubExactValue } from "./redact.js";
import {
  assertProjectAllowed,
  normalizeServiceList,
  validateProjectId,
  validateApiService,
  validateServiceAccountId,
  validateSecretId,
} from "./validators.js";
import { assertWritePolicy, assertModuleEnabled } from "./policy.js";
import type { GcpAllowedCommand, GcpRunResult } from "./types.js";
import type { GoogleCloudConfig } from "./config.js";

function mockConfig(overrides: Partial<GoogleCloudConfig> = {}): Partial<GoogleCloudConfig> {
  return {
    enabled: true,
    allowedProjectPrefixes: ["dnx-"],
    allowWrites: false,
    allowProductionWrites: false,
    allowHighRiskWrites: false,
    allowDestructiveActions: false,
    allowServiceAccountKeys: false,
    auditLogEnabled: false,
    binary: "gcloud",
    commandTimeoutMs: 5_000,
    maxOutputBytes: 1_048_576,
    defaultRegion: "southamerica-east1",
    defaultProject: "",
    ...overrides,
  };
}

function mockExecutor(handler: (cmd: GcpAllowedCommand) => GcpRunResult | Promise<GcpRunResult>) {
  return vi.fn(async (cmd: GcpAllowedCommand) => handler(cmd));
}

describe("google-cloud validators", () => {
  it("valida project ID oficial", () => {
    expect(validateProjectId("dnx-example")).toBe("dnx-example");
    expect(() => validateProjectId("DNX")).toThrow(GoogleCloudError);
    expect(() => validateProjectId("ab")).toThrow(GoogleCloudError);
  });

  it("bloquea prefijos no permitidos", () => {
    expect(() => {
      assertProjectAllowed("other-proj", ["dnx-"]);
    }).toThrow(/GCP_PROJECT_NOT_ALLOWED|fuera/);
    expect(() => {
      assertProjectAllowed("dnx-suite", ["dnx-"]);
    }).not.toThrow();
  });

  it("normaliza APIs y detecta duplicados/inválidas", () => {
    const result = normalizeServiceList([
      "secretmanager.googleapis.com",
      "secretmanager.googleapis.com",
      "not-an-api",
      "iam.googleapis.com",
    ]);
    expect(result.unique).toEqual(["secretmanager.googleapis.com", "iam.googleapis.com"]);
    expect(result.duplicates).toContain("secretmanager.googleapis.com");
    expect(result.invalid).toContain("not-an-api");
  });

  it("valida service account id y secret id", () => {
    expect(validateServiceAccountId("dnx-app-runtime")).toBe("dnx-app-runtime");
    expect(() => validateServiceAccountId("AB")).toThrow();
    expect(validateSecretId("database-url")).toBe("database-url");
    expect(() => validateApiService("compute")).toThrow();
  });
});

describe("google-cloud policy", () => {
  it("módulo deshabilitado bloquea", () => {
    const config = { ...mockConfig({ enabled: false }) } as GoogleCloudConfig;
    expect(() => {
      assertModuleEnabled(config);
    }).toThrow(/GCP_DISABLED|deshabilitado/);
  });

  it("escrituras bloqueadas sin allowWrites", () => {
    const config = mockConfig({ enabled: true, allowWrites: false }) as GoogleCloudConfig;
    expect(() => {
      assertWritePolicy(config, {
        riskLevel: "LOW_RISK_WRITE",
        projectId: "dnx-example",
        environment: "development",
        dryRun: false,
      });
    }).toThrow(/GCP_WRITE_BLOCKED|bloqueadas/);
  });

  it("production bloqueada", () => {
    const config = mockConfig({
      enabled: true,
      allowWrites: true,
      allowProductionWrites: false,
    }) as GoogleCloudConfig;
    expect(() => {
      assertWritePolicy(config, {
        riskLevel: "LOW_RISK_WRITE",
        projectId: "dnx-example",
        environment: "production",
        dryRun: false,
      });
    }).toThrow(/GCP_PRODUCTION_WRITE_BLOCKED|production/);
  });

  it("destructivas siempre bloqueadas en fase 1", () => {
    const config = mockConfig({
      enabled: true,
      allowWrites: true,
      allowDestructiveActions: true,
    }) as GoogleCloudConfig;
    expect(() => {
      assertWritePolicy(config, {
        riskLevel: "DESTRUCTIVE",
        projectId: "dnx-example",
        environment: "development",
        dryRun: false,
      });
    }).toThrow(/destructivas|DESTRUCTIVE/i);
  });

  it("dryRun permite planificar escrituras sin allowWrites", () => {
    const config = mockConfig({ enabled: true, allowWrites: false }) as GoogleCloudConfig;
    expect(() => {
      assertWritePolicy(config, {
        riskLevel: "LOW_RISK_WRITE",
        projectId: "dnx-example",
        environment: "development",
        dryRun: true,
      });
    }).not.toThrow();
  });
});

describe("google-cloud executor args", () => {
  it("no acepta shell strings — solo comandos tipados", () => {
    const { args, stdin } = buildGcloudArgs({
      op: "services.enable",
      projectId: "dnx-example",
      services: ["iam.googleapis.com"],
    });
    expect(args[0]).toBe("services");
    expect(args).toContain("iam.googleapis.com");
    expect(stdin).toBeUndefined();
  });

  it("secret version usa stdin y data-file=-", () => {
    const { args, stdin } = buildGcloudArgs({
      op: "secrets.versions.add",
      projectId: "dnx-example",
      secretId: "database-url",
      secretValue: "SUPER_SECRET",
    });
    expect(args).toContain("--data-file=-");
    expect(args.join(" ")).not.toContain("SUPER_SECRET");
    expect(stdin).toBe("SUPER_SECRET");
  });
});

describe("google-cloud redact", () => {
  it("redacta tokens y scrub exact value", () => {
    expect(redactSecrets("Bearer ya29.abcTOKEN")).toContain("[REDACTED]");
    expect(scrubExactValue("value=SECRET123 end", "SECRET123")).toBe("value=[REDACTED] end");
  });
});

describe("GoogleCloudProvider con mocks", () => {
  it("checkInstallation cuando which falla", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      which: () => Promise.resolve(null),
      executor: mockExecutor(() => {
        throw new Error("should not run");
      }),
    });
    const result = await provider.checkInstallation();
    expect(result.installed).toBe(false);
    expect(result.success).toBe(false);
  });

  it("checkInstallation parsea versión", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      which: () => Promise.resolve("/usr/bin/gcloud"),
      executor: mockExecutor((cmd) => {
        expect(cmd.op).toBe("version");
        return {
          stdout: JSON.stringify({ "Google Cloud SDK": "500.0.0" }),
          stderr: "",
          exitCode: 0,
          args: ["version"],
          durationMs: 1,
        };
      }),
    });
    const result = await provider.checkInstallation();
    expect(result.installed).toBe(true);
    expect(result.binaryPath).toBe("/usr/bin/gcloud");
  });

  it("auth status y cuentas", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor(() => ({
        stdout: JSON.stringify([
          { account: "user@dnx.com", status: "ACTIVE" },
          { account: "other@dnx.com", status: "INACTIVE" },
        ]),
        stderr: "",
        exitCode: 0,
        args: [],
        durationMs: 1,
      })),
    });
    const auth = await provider.getAuthStatus();
    expect(auth.authenticated).toBe(true);
    expect(auth.accountCount).toBe(2);
    expect(auth.activeAccount).toBe("user@dnx.com");
  });

  it("lista proyectos filtrando prefijo", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig({ allowedProjectPrefixes: ["dnx-"] }),
      executor: mockExecutor(() => ({
        stdout: JSON.stringify([
          { projectId: "dnx-suite", name: "DNX", projectNumber: "1", lifecycleState: "ACTIVE" },
          { projectId: "other-app", name: "Other", projectNumber: "2", lifecycleState: "ACTIVE" },
        ]),
        stderr: "",
        exitCode: 0,
        args: [],
        durationMs: 1,
      })),
    });
    const result = await provider.listProjects();
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]?.projectId).toBe("dnx-suite");
  });

  it("plan enable services idempotente", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "services.list.enabled") {
          return {
            stdout: JSON.stringify([{ config: { name: "iam.googleapis.com" } }]),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        throw new Error(`unexpected ${cmd.op}`);
      }),
    });
    const plan = await provider.planEnableServices({
      projectId: "dnx-example",
      environment: "development",
      services: ["iam.googleapis.com", "secretmanager.googleapis.com", "iam.googleapis.com", "bad"],
    });
    expect(plan.alreadyEnabled).toContain("iam.googleapis.com");
    expect(plan.pending).toContain("secretmanager.googleapis.com");
    expect(plan.duplicates.length).toBeGreaterThan(0);
    expect(plan.invalid).toContain("bad");
    expect(plan.dryRun).toBe(true);
  });

  it("enable services en dryRun no llama enable", async () => {
    const executor = mockExecutor((cmd) => {
      if (cmd.op === "services.list.enabled") {
        return {
          stdout: JSON.stringify([]),
          stderr: "",
          exitCode: 0,
          args: [],
          durationMs: 1,
        };
      }
      if (cmd.op === "services.enable") {
        throw new Error("must not enable");
      }
      throw new Error(cmd.op);
    });
    const provider = createGoogleCloudProvider({
      config: mockConfig({ allowWrites: true }),
      executor,
    });
    const result = await provider.enableServices({
      projectId: "dnx-example",
      environment: "development",
      services: ["secretmanager.googleapis.com"],
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.enabledNow).toEqual([]);
  });

  it("módulo disabled lanza en listAccounts", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig({ enabled: false }),
      executor: mockExecutor(() => {
        throw new Error("no");
      }),
    });
    await expect(provider.listAccounts()).rejects.toBeInstanceOf(GoogleCloudError);
  });

  it("plan service account detecta existente", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor(() => ({
        stdout: JSON.stringify([
          { email: "dnx-app-runtime@dnx-example.iam.gserviceaccount.com", displayName: "Runtime" },
        ]),
        stderr: "",
        exitCode: 0,
        args: [],
        durationMs: 1,
      })),
    });
    const plan = await provider.planServiceAccount({
      projectId: "dnx-example",
      environment: "development",
      accountId: "dnx-app-runtime",
    });
    expect(plan.exists).toBe(true);
    expect(plan.wouldCreate).toBe(false);
  });

  it("create service account dryRun no crea", async () => {
    const executor = mockExecutor((cmd) => {
      if (cmd.op === "iam.sa.list") {
        return { stdout: "[]", stderr: "", exitCode: 0, args: [], durationMs: 1 };
      }
      if (cmd.op === "iam.sa.create") throw new Error("must not create");
      throw new Error(cmd.op);
    });
    const provider = createGoogleCloudProvider({
      config: mockConfig({ allowWrites: true }),
      executor,
    });
    const result = await provider.createServiceAccount({
      projectId: "dnx-example",
      environment: "development",
      accountId: "dnx-app-runtime",
      dryRun: true,
    });
    expect(result.created).toBe(false);
    expect(result.dryRun).toBe(true);
  });

  it("plan secret y add version dryRun no expone valor", async () => {
    const secretValue = "SENSITIVE_VALUE_DO_NOT_LEAK";
    const executor = mockExecutor((cmd) => {
      if (cmd.op === "secrets.describe") {
        throw new GoogleCloudError("GCP_SECRET_NOT_FOUND", "not found", {
          projectId: "dnx-example",
          resource: "database-url",
        });
      }
      if (cmd.op === "secrets.list") {
        return { stdout: "[]", stderr: "", exitCode: 0, args: [], durationMs: 1 };
      }
      if (cmd.op === "secrets.versions.add") throw new Error("must not add");
      throw new Error(cmd.op);
    });
    const provider = createGoogleCloudProvider({
      config: mockConfig({ allowWrites: true, allowHighRiskWrites: true }),
      executor,
    });
    const plan = await provider.planSecret({
      projectId: "dnx-example",
      environment: "development",
      secretId: "database-url",
    });
    expect(plan.wouldCreate).toBe(true);

    const add = await provider.addSecretVersion({
      projectId: "dnx-example",
      environment: "development",
      secretId: "database-url",
      value: secretValue,
      dryRun: true,
    });
    expect(add.valueProvided).toBe(true);
    expect(JSON.stringify(add)).not.toContain(secretValue);
  });

  it("add secret version real requiere high risk flag", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig({ allowWrites: true, allowHighRiskWrites: false }),
      executor: mockExecutor(() => {
        throw new Error("no");
      }),
    });
    await expect(
      provider.addSecretVersion({
        projectId: "dnx-example",
        environment: "development",
        secretId: "database-url",
        value: "x",
        dryRun: false,
        confirmation: "ADD SECRET VERSION database-url IN dnx-example",
      }),
    ).rejects.toThrow(/HIGH_RISK|GCP_WRITE_BLOCKED/);
  });

  it("doctor combina checks read-only", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      which: () => Promise.resolve("/bin/gcloud"),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "version") {
          return {
            stdout: JSON.stringify({ sdk: "1" }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "auth.list") {
          return {
            stdout: JSON.stringify([{ account: "a@b.com", status: "ACTIVE" }]),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "config.get") {
          return {
            stdout: cmd.key === "core/project" ? "dnx-example" : "a@b.com",
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        throw new Error(cmd.op);
      }),
    });
    const doctor = await provider.runDoctor();
    expect(doctor.riskLevel).toBe("READ_ONLY");
    expect(doctor.checks.module).toMatchObject({ allowWrites: false });
  });

  it("setProject dryRun no muta", async () => {
    const executor = mockExecutor((cmd) => {
      if (cmd.op === "config.get") {
        return { stdout: "dnx-old", stderr: "", exitCode: 0, args: [], durationMs: 1 };
      }
      if (cmd.op === "config.set") throw new Error("must not set");
      throw new Error(cmd.op);
    });
    const provider = createGoogleCloudProvider({
      config: mockConfig({ allowWrites: true }),
      executor,
    });
    const result = await provider.setProject({
      projectId: "dnx-example",
      environment: "development",
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.currentProjectId).toBe("dnx-old");
  });
});
