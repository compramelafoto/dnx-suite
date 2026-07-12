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
  validateDisplayName,
  validateBillingAccountId,
  validateParent,
  validateAndNormalizeLabels,
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

describe("google-cloud project + billing validators", () => {
  it("valida displayName y billing account id", () => {
    expect(validateDisplayName("DNX Platform Development")).toBe("DNX Platform Development");
    expect(() => validateDisplayName("")).toThrow(GoogleCloudError);
    expect(validateBillingAccountId("000000-000000-000000")).toBe("000000-000000-000000");
    expect(validateBillingAccountId("billingAccounts/aabbcc-ddeeff-112233")).toBe(
      "AABBCC-DDEEFF-112233",
    );
    expect(() => validateBillingAccountId("not-valid")).toThrow(GoogleCloudError);
  });

  it("valida parent organization/folder/null", () => {
    expect(validateParent(null, null)).toBeNull();
    expect(validateParent("organization", "123456789012")).toEqual({
      parentType: "organization",
      parentId: "123456789012",
    });
    expect(validateParent("folder", "folders/987654321098")).toEqual({
      parentType: "folder",
      parentId: "987654321098",
    });
    expect(() => validateParent("organization", null)).toThrow(/parentId es obligatorio|GCP_PROJECT_PARENT_INVALID/);
    expect(() => validateParent("folder", "abc")).toThrow(/parentId inválido|GCP_PROJECT_PARENT_INVALID/);
  });

  it("valida labels y rechaza sensibles/inválidos", () => {
    expect(
      validateAndNormalizeLabels({
        Ecosystem: "DNX",
        environment: "development",
        "managed-by": "dnx-mcp",
      }),
    ).toEqual({
      ecosystem: "dnx",
      environment: "development",
      "managed-by": "dnx-mcp",
    });
    expect(() => validateAndNormalizeLabels({ "api-token": "x" })).toThrow(/sensible|GCP_INVALID/);
    expect(() => validateAndNormalizeLabels({ email: "a@b.com" })).toThrow();
    expect(() => validateAndNormalizeLabels({ "Bad Key": "x" })).toThrow();
  });
});

describe("google-cloud plan/create project", () => {
  it("plan idempotente cuando el proyecto existe", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "projects.describe") {
          return {
            stdout: JSON.stringify({ projectId: "dnx-platform-dev", name: "DNX Platform Development" }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "projects.create") throw new Error("must not create");
        throw new Error(cmd.op);
      }),
    });
    const plan = await provider.planProject({
      projectId: "dnx-platform-dev",
      displayName: "DNX Platform Development",
      environment: "development",
      labels: { ecosystem: "dnx", environment: "development", "managed-by": "dnx-mcp" },
    });
    expect(plan.exists).toBe(true);
    expect(plan.changed).toBe(false);
    expect(plan.plannedActions).toEqual([]);
    expect(plan.warnings.some((w) => /Billing/i.test(w))).toBe(true);
  });

  it("plan cuando ID disponible", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "projects.describe") {
          throw new GoogleCloudError("GCP_PROJECT_NOT_FOUND", "missing");
        }
        throw new Error(cmd.op);
      }),
    });
    const plan = await provider.planProject({
      projectId: "dnx-platform-dev",
      displayName: "DNX Platform Development",
      environment: "development",
    });
    expect(plan.exists).toBe(false);
    expect(plan.changed).toBe(true);
    expect(plan.plannedActions).toEqual([{ type: "CREATE_PROJECT", resource: "dnx-platform-dev" }]);
  });

  it("ID ocupado no visible → GCP_PROJECT_ID_UNAVAILABLE", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "projects.describe") {
          throw new GoogleCloudError("GCP_PERMISSION_DENIED", "denied");
        }
        throw new Error(cmd.op);
      }),
    });
    await expect(
      provider.planProject({
        projectId: "dnx-taken-id01",
        displayName: "Taken",
        environment: "development",
      }),
    ).rejects.toThrow(/GCP_PROJECT_ID_UNAVAILABLE|no está disponible/);
  });

  it("bloquea prefijo no permitido", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor(() => {
        throw new Error("no call");
      }),
    });
    await expect(
      provider.planProject({
        projectId: "other-project",
        displayName: "Other",
        environment: "development",
      }),
    ).rejects.toThrow(/GCP_PROJECT_NOT_ALLOWED|fuera/);
  });

  it("create dryRun no ejecuta projects.create", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig({ allowWrites: true, allowHighRiskWrites: true }),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "projects.describe") {
          throw new GoogleCloudError("GCP_PROJECT_NOT_FOUND", "missing");
        }
        if (cmd.op === "projects.create") throw new Error("must not create");
        throw new Error(cmd.op);
      }),
    });
    const result = await provider.createProject({
      projectId: "dnx-platform-dev",
      displayName: "DNX Platform Development",
      environment: "development",
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.changed).toBe(false);
  });

  it("create real bloqueado sin allowWrites", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig({ allowWrites: false }),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "projects.describe") {
          throw new GoogleCloudError("GCP_PROJECT_NOT_FOUND", "missing");
        }
        throw new Error(cmd.op);
      }),
    });
    await expect(
      provider.createProject({
        projectId: "dnx-platform-dev",
        displayName: "DNX Platform Development",
        environment: "development",
        dryRun: false,
        confirmation: "CREATE PROJECT dnx-platform-dev",
      }),
    ).rejects.toThrow(/GCP_WRITE_BLOCKED|bloqueadas/);
  });

  it("create real bloqueado sin high-risk", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig({ allowWrites: true, allowHighRiskWrites: false }),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "projects.describe") {
          throw new GoogleCloudError("GCP_PROJECT_NOT_FOUND", "missing");
        }
        throw new Error(cmd.op);
      }),
    });
    await expect(
      provider.createProject({
        projectId: "dnx-platform-dev",
        displayName: "DNX Platform Development",
        environment: "development",
        dryRun: false,
        confirmation: "CREATE PROJECT dnx-platform-dev",
      }),
    ).rejects.toThrow(/GCP_WRITE_BLOCKED|HIGH_RISK/);
  });

  it("create real exige confirmation exacta", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig({ allowWrites: true, allowHighRiskWrites: true }),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "projects.describe") {
          throw new GoogleCloudError("GCP_PROJECT_NOT_FOUND", "missing");
        }
        if (cmd.op === "projects.create") throw new Error("must not create");
        throw new Error(cmd.op);
      }),
    });
    await expect(
      provider.createProject({
        projectId: "dnx-platform-dev",
        displayName: "DNX Platform Development",
        environment: "development",
        dryRun: false,
        confirmation: "wrong",
      }),
    ).rejects.toThrow(/GCP_CONFIRMATION_REQUIRED|Confirmación/);
  });

  it("executor projects.create tipado con parent y labels", () => {
    const { args } = buildGcloudArgs({
      op: "projects.create",
      projectId: "dnx-platform-dev",
      displayName: "DNX Platform Development",
      labels: { ecosystem: "dnx" },
      parentType: "organization",
      parentId: "123456789012",
    });
    expect(args[0]).toBe("projects");
    expect(args).toContain("dnx-platform-dev");
    expect(args).toContain("--name=DNX Platform Development");
    expect(args.some((a) => a.startsWith("--labels="))).toBe(true);
    expect(args).toContain("--organization=123456789012");
    expect(args.join(" ")).not.toMatch(/;\s*|&&|\|/);
  });
});

describe("google-cloud billing accounts + link", () => {
  it("lista billing accounts sin datos sensibles", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "billing.accounts.list") {
          return {
            stdout: JSON.stringify([
              {
                name: "billingAccounts/000000-000000-000000",
                displayName: "DNX Billing",
                open: true,
              },
            ]),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        throw new Error(cmd.op);
      }),
    });
    const result = await provider.listBillingAccounts();
    expect(result.billingAccounts).toHaveLength(1);
    expect(result.billingAccounts[0]?.billingAccountId).toBe("000000-000000-000000");
    expect(result.billingAccounts[0]?.open).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/card|cvv|iban|payment/i);
  });

  it("permiso insuficiente al listar billing", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "billing.accounts.list") {
          throw new GoogleCloudError("GCP_BILLING_ACCOUNT_PERMISSION_DENIED", "denied");
        }
        throw new Error(cmd.op);
      }),
    });
    await expect(provider.listBillingAccounts()).rejects.toThrow(
      /Sin permiso|GCP_BILLING_ACCOUNT_PERMISSION_DENIED/,
    );
  });

  it("plan link billing idempotente si ya coincide", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "projects.describe") {
          return {
            stdout: JSON.stringify({ projectId: "dnx-platform-dev", name: "DNX" }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "billing.describe") {
          return {
            stdout: JSON.stringify({
              billingEnabled: true,
              billingAccountName: "billingAccounts/000000-000000-000000",
            }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "billing.accounts.describe") {
          return {
            stdout: JSON.stringify({
              name: "billingAccounts/000000-000000-000000",
              open: true,
            }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "billing.projects.link") throw new Error("must not link");
        throw new Error(cmd.op);
      }),
    });
    const plan = await provider.planLinkBilling({
      projectId: "dnx-platform-dev",
      billingAccountId: "000000-000000-000000",
      environment: "development",
    });
    expect(plan.changed).toBe(false);
    expect(plan.plannedActions).toEqual([]);
  });

  it("plan advierte si billing distinto", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "projects.describe") {
          return {
            stdout: JSON.stringify({ projectId: "dnx-platform-dev", name: "DNX" }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "billing.describe") {
          return {
            stdout: JSON.stringify({
              billingEnabled: true,
              billingAccountName: "billingAccounts/111111-111111-111111",
            }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "billing.accounts.describe") {
          return {
            stdout: JSON.stringify({
              name: "billingAccounts/000000-000000-000000",
              open: true,
            }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        throw new Error(cmd.op);
      }),
    });
    const plan = await provider.planLinkBilling({
      projectId: "dnx-platform-dev",
      billingAccountId: "000000-000000-000000",
      environment: "development",
    });
    expect(plan.changed).toBe(true);
    expect(plan.highRiskBecauseDifferentAccount).toBe(true);
    expect(plan.warnings.some((w) => /otra billing/i.test(w))).toBe(true);
  });

  it("billing account cerrada", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig(),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "projects.describe") {
          return {
            stdout: JSON.stringify({ projectId: "dnx-platform-dev", name: "DNX" }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "billing.describe") {
          return {
            stdout: JSON.stringify({ billingEnabled: false }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "billing.accounts.describe") {
          return {
            stdout: JSON.stringify({
              name: "billingAccounts/000000-000000-000000",
              open: false,
            }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        throw new Error(cmd.op);
      }),
    });
    await expect(
      provider.planLinkBilling({
        projectId: "dnx-platform-dev",
        billingAccountId: "000000-000000-000000",
        environment: "development",
      }),
    ).rejects.toThrow(/cerrada|GCP_BILLING_ACCOUNT_NOT_FOUND/);
  });

  it("linkBilling dryRun no muta; real exige confirmation", async () => {
    const provider = createGoogleCloudProvider({
      config: mockConfig({ allowWrites: true, allowHighRiskWrites: true }),
      executor: mockExecutor((cmd) => {
        if (cmd.op === "projects.describe") {
          return {
            stdout: JSON.stringify({ projectId: "dnx-platform-dev", name: "DNX" }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "billing.describe") {
          return {
            stdout: JSON.stringify({ billingEnabled: false }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "billing.accounts.describe") {
          return {
            stdout: JSON.stringify({
              name: "billingAccounts/000000-000000-000000",
              open: true,
            }),
            stderr: "",
            exitCode: 0,
            args: [],
            durationMs: 1,
          };
        }
        if (cmd.op === "billing.projects.link") throw new Error("must not link");
        throw new Error(cmd.op);
      }),
    });
    const dry = await provider.linkBilling({
      projectId: "dnx-platform-dev",
      billingAccountId: "000000-000000-000000",
      environment: "development",
      dryRun: true,
    });
    expect(dry.dryRun).toBe(true);
    expect(dry.changed).toBe(false);

    await expect(
      provider.linkBilling({
        projectId: "dnx-platform-dev",
        billingAccountId: "000000-000000-000000",
        environment: "development",
        dryRun: false,
        confirmation: "BAD",
      }),
    ).rejects.toThrow(/Confirmación exacta|GCP_CONFIRMATION_REQUIRED/);
  });

  it("buildGcloudArgs billing link tipado", () => {
    const { args } = buildGcloudArgs({
      op: "billing.projects.link",
      projectId: "dnx-platform-dev",
      billingAccountId: "000000-000000-000000",
    });
    expect(args).toEqual([
      "billing",
      "projects",
      "link",
      "dnx-platform-dev",
      "--billing-account=000000-000000-000000",
      "--format=json",
    ]);
  });
});
