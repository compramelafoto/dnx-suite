import type { Provider } from "../../types/provider.js";
import { writeGcpAudit } from "./audit.js";
import {
  defaultGoogleCloudConfig,
  resolveGoogleCloudConfig,
  type GoogleCloudConfig,
} from "./config.js";
import { GoogleCloudError } from "./errors.js";
import {
  createGoogleCloudExecutor,
  parseJsonOutput,
  type GcpExecutorFn,
} from "./executor.js";
import { assertModuleEnabled, assertWritePolicy } from "./policy.js";
import type {
  GcpAccount,
  GcpAllowedCommand,
  GcpEnvironment,
  GcpProjectSummary,
  GcpSecretMetadata,
  GcpServiceAccountSummary,
  GcpToolResultBase,
} from "./types.js";
import {
  normalizeServiceList,
  validateProjectId,
  validateSecretId,
  validateServiceAccountId,
} from "./validators.js";

export interface GoogleCloudProviderOptions {
  config?: Partial<GoogleCloudConfig>;
  executor?: GcpExecutorFn;
  /** which — resolver de binario para tests */
  which?: (binary: string) => Promise<string | null>;
}

function baseResult(
  partial: Partial<GcpToolResultBase> & Pick<GcpToolResultBase, "riskLevel" | "dryRun">,
): GcpToolResultBase {
  return {
    success: partial.success ?? true,
    changed: partial.changed ?? false,
    dryRun: partial.dryRun,
    riskLevel: partial.riskLevel,
    projectId: partial.projectId ?? null,
    environment: partial.environment ?? null,
    actions: partial.actions ?? [],
    warnings: partial.warnings ?? [],
    errors: partial.errors ?? [],
    metadata: partial.metadata ?? {},
  };
}

async function defaultWhich(binary: string): Promise<string | null> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve) => {
    const child = spawn("which", [binary], { shell: false });
    let out = "";
    child.stdout.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.on("close", (code) => {
      resolve(code === 0 ? out.trim() || null : null);
    });
    child.on("error", () => {
      resolve(null);
    });
  });
}

export class GoogleCloudProvider implements Provider {
  readonly name = "google-cloud";
  readonly config: GoogleCloudConfig;
  private readonly executor: GcpExecutorFn;
  private readonly which: (binary: string) => Promise<string | null>;

  constructor(options: GoogleCloudProviderOptions = {}) {
    this.config = resolveGoogleCloudConfig(options.config ?? {});
    this.executor = options.executor ?? createGoogleCloudExecutor(this.config);
    this.which = options.which ?? defaultWhich;
  }

  isConfigured(): boolean {
    return this.config.enabled;
  }

  private async run(command: GcpAllowedCommand) {
    return this.executor(command);
  }

  // --- Diagnóstico ---

  async checkInstallation(): Promise<GcpToolResultBase & {
    installed: boolean;
    binaryPath: string | null;
    version: unknown;
  }> {
    assertModuleEnabled(this.config);
    const binaryPath = await this.which(this.config.binary);
    if (!binaryPath) {
      return {
        ...baseResult({
          success: false,
          dryRun: false,
          riskLevel: "READ_ONLY",
          warnings: ["gcloud no está en PATH"],
          errors: [
            new GoogleCloudError("GCP_CLI_NOT_INSTALLED", "gcloud no instalado").toStructured(),
          ],
        }),
        installed: false,
        binaryPath: null,
        version: null,
      };
    }

    try {
      const result = await this.run({ op: "version" });
      const version = parseJsonOutput(result.stdout, { raw: result.stdout.trim() });
      return {
        ...baseResult({
          dryRun: false,
          riskLevel: "READ_ONLY",
          actions: ["gcloud version consultado"],
          metadata: { durationMs: result.durationMs },
        }),
        installed: true,
        binaryPath,
        version,
      };
    } catch (error) {
      if (error instanceof GoogleCloudError && error.code === "GCP_CLI_NOT_INSTALLED") {
        return {
          ...baseResult({
            success: false,
            dryRun: false,
            riskLevel: "READ_ONLY",
            errors: [error.toStructured()],
          }),
          installed: false,
          binaryPath: null,
          version: null,
        };
      }
      throw error;
    }
  }

  async listAccounts(): Promise<GcpToolResultBase & { accounts: GcpAccount[] }> {
    assertModuleEnabled(this.config);
    const result = await this.run({ op: "auth.list" });
    const raw = parseJsonOutput<Array<{ account?: string; status?: string }>>(result.stdout, []);
    const accounts: GcpAccount[] = raw
      .filter((a): a is { account: string; status?: string } => typeof a.account === "string")
      .map((a) => ({
        account: a.account,
        status: a.status?.toUpperCase() === "ACTIVE" ? ("ACTIVE" as const) : ("INACTIVE" as const),
      }));
    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        actions: [`Cuentas listadas: ${String(accounts.length)}`],
      }),
      accounts,
    };
  }

  async getAuthStatus(): Promise<
    GcpToolResultBase & {
      authenticated: boolean;
      accountCount: number;
      hasActiveAccount: boolean;
      activeAccount: string | null;
    }
  > {
    assertModuleEnabled(this.config);
    const listed = await this.listAccounts();
    const active = listed.accounts.find((a) => a.status === "ACTIVE");
    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        actions: ["Estado de autenticación consultado"],
      }),
      authenticated: listed.accounts.length > 0,
      accountCount: listed.accounts.length,
      hasActiveAccount: Boolean(active),
      activeAccount: active?.account ?? null,
    };
  }

  async getActiveAccount(): Promise<GcpToolResultBase & { account: string | null }> {
    assertModuleEnabled(this.config);
    const result = await this.run({ op: "config.get", key: "core/account" });
    const account = result.stdout.trim() || null;
    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        actions: ["Cuenta activa consultada"],
      }),
      account: account === "(unset)" ? null : account,
    };
  }

  async getActiveProject(): Promise<GcpToolResultBase & { projectId: string | null }> {
    assertModuleEnabled(this.config);
    const result = await this.run({ op: "config.get", key: "core/project" });
    const projectId = result.stdout.trim() || null;
    const normalized = !projectId || projectId === "(unset)" ? null : projectId;
    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        projectId: normalized,
        actions: ["Proyecto activo consultado"],
      }),
      projectId: normalized,
    };
  }

  async runDoctor(): Promise<GcpToolResultBase & { checks: Record<string, unknown> }> {
    assertModuleEnabled(this.config);
    const warnings: string[] = [];
    const installation = await this.checkInstallation().catch((error: unknown) => {
      warnings.push(error instanceof Error ? error.message : "Error en instalación");
      return null;
    });
    const auth = await this.getAuthStatus().catch(() => null);
    const activeAccount = await this.getActiveAccount().catch(() => null);
    const activeProject = await this.getActiveProject().catch(() => null);

    if (!this.config.allowWrites) warnings.push("Escrituras deshabilitadas (seguro)");
    if (!this.config.allowProductionWrites) warnings.push("Production writes bloqueadas (seguro)");
    if (!this.config.allowDestructiveActions) {
      warnings.push("Operaciones destructivas bloqueadas (Fase 1)");
    }

    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        projectId: activeProject?.projectId ?? null,
        warnings,
        actions: ["Doctor GCP ejecutado (read-only)"],
        metadata: {
          nextSteps: [
            "Usá gcp_list_projects para ver proyectos visibles",
            "Planificá APIs con gcp_plan_enable_services (dryRun)",
            "Mantener DNX_GCP_ALLOW_WRITES=false salvo necesidad explícita",
          ],
        },
      }),
      checks: {
        installation,
        auth,
        activeAccount: activeAccount?.account ?? null,
        activeProject: activeProject?.projectId ?? null,
        module: {
          enabled: this.config.enabled,
          allowWrites: this.config.allowWrites,
          allowProductionWrites: this.config.allowProductionWrites,
          allowHighRiskWrites: this.config.allowHighRiskWrites,
          allowDestructiveActions: this.config.allowDestructiveActions,
          allowServiceAccountKeys: this.config.allowServiceAccountKeys,
          allowedProjectPrefixes: this.config.allowedProjectPrefixes,
          defaultRegion: this.config.defaultRegion,
        },
      },
    };
  }

  // --- Proyectos ---

  async listProjects(): Promise<GcpToolResultBase & { projects: GcpProjectSummary[] }> {
    assertModuleEnabled(this.config);
    const result = await this.run({ op: "projects.list" });
    const raw = parseJsonOutput<
      Array<{
        projectId?: string;
        name?: string;
        projectNumber?: string;
        lifecycleState?: string;
        labels?: Record<string, string>;
      }>
    >(result.stdout, []);

    const projects: GcpProjectSummary[] = [];
    for (const p of raw) {
      const projectId = p.projectId;
      if (!projectId) continue;
      try {
        validateProjectId(projectId);
        if (
          this.config.allowedProjectPrefixes.length > 0 &&
          !this.config.allowedProjectPrefixes.some((prefix) => projectId.startsWith(prefix))
        ) {
          continue;
        }
        projects.push({
          projectId,
          name: p.name ?? projectId,
          ...(p.projectNumber ? { projectNumber: p.projectNumber } : {}),
          ...(p.lifecycleState ? { lifecycleState: p.lifecycleState } : {}),
          ...(p.labels ? { labels: p.labels } : {}),
        });
      } catch {
        // skip invalid
      }
    }

    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        actions: [`Proyectos listados: ${String(projects.length)}`],
      }),
      projects,
    };
  }

  async getProject(projectId: string): Promise<GcpToolResultBase & { project: GcpProjectSummary }> {
    assertModuleEnabled(this.config);
    const id = validateProjectId(projectId);
    assertWritePolicy(this.config, {
      riskLevel: "READ_ONLY",
      projectId: id,
      dryRun: true,
    });
    const result = await this.run({ op: "projects.describe", projectId: id });
    const raw = parseJsonOutput<{
      projectId?: string;
      name?: string;
      projectNumber?: string;
      lifecycleState?: string;
      labels?: Record<string, string>;
    }>(result.stdout, {});
    if (!raw.projectId) {
      throw new GoogleCloudError("GCP_PROJECT_NOT_FOUND", `Proyecto no encontrado: ${id}`, {
        projectId: id,
      });
    }
    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        projectId: id,
        actions: ["Proyecto descrito"],
      }),
      project: {
        projectId: raw.projectId,
        name: raw.name ?? raw.projectId,
        ...(raw.projectNumber ? { projectNumber: raw.projectNumber } : {}),
        ...(raw.lifecycleState ? { lifecycleState: raw.lifecycleState } : {}),
        ...(raw.labels ? { labels: raw.labels } : {}),
      },
    };
  }

  async setProject(input: {
    projectId: string;
    environment: GcpEnvironment;
    dryRun: boolean;
    confirmation?: string;
  }): Promise<GcpToolResultBase & { currentProjectId: string | null; requestedProjectId: string }> {
    const id = validateProjectId(input.projectId);
    assertWritePolicy(this.config, {
      riskLevel: "LOW_RISK_WRITE",
      projectId: id,
      environment: input.environment,
      dryRun: input.dryRun,
      ...(input.environment === "production"
        ? { requiredConfirmation: `SET PROJECT ${id}` }
        : {}),
      ...(input.confirmation !== undefined ? { confirmation: input.confirmation } : {}),
    });

    const current = await this.getActiveProject();
    const plannedArgs = ["config", "set", "core/project", id];

    if (input.dryRun) {
      writeGcpAudit(this.config, {
        tool: "gcp_set_project",
        action: "config.set.core/project",
        projectId: id,
        environment: input.environment,
        riskLevel: "LOW_RISK_WRITE",
        dryRun: true,
        changed: false,
        result: "dry_run",
      });
      return {
        ...baseResult({
          dryRun: true,
          riskLevel: "LOW_RISK_WRITE",
          projectId: id,
          environment: input.environment,
          actions: ["Plan: gcloud config set core/project"],
          metadata: { plannedArgs },
        }),
        currentProjectId: current.projectId,
        requestedProjectId: id,
      };
    }

    await this.run({ op: "config.set", key: "core/project", value: id });
    writeGcpAudit(this.config, {
      tool: "gcp_set_project",
      action: "config.set.core/project",
      projectId: id,
      environment: input.environment,
      riskLevel: "LOW_RISK_WRITE",
      dryRun: false,
      changed: true,
      result: "success",
    });
    return {
      ...baseResult({
        dryRun: false,
        changed: true,
        riskLevel: "LOW_RISK_WRITE",
        projectId: id,
        environment: input.environment,
        actions: [`Proyecto local gcloud seteado a ${id}`],
      }),
      currentProjectId: current.projectId,
      requestedProjectId: id,
    };
  }

  async checkBilling(
    projectId: string,
  ): Promise<GcpToolResultBase & { billingEnabled: boolean | null; billingAccountName?: string }> {
    assertModuleEnabled(this.config);
    const id = validateProjectId(projectId);
    assertWritePolicy(this.config, { riskLevel: "READ_ONLY", projectId: id, dryRun: true });
    try {
      const result = await this.run({ op: "billing.describe", projectId: id });
      const raw = parseJsonOutput<{
        billingEnabled?: boolean;
        billingAccountName?: string;
      }>(result.stdout, {});
      return {
        ...baseResult({
          dryRun: false,
          riskLevel: "READ_ONLY",
          projectId: id,
          actions: ["Billing consultado (read-only)"],
        }),
        billingEnabled: raw.billingEnabled ?? null,
        ...(raw.billingAccountName ? { billingAccountName: raw.billingAccountName } : {}),
      };
    } catch (error) {
      if (error instanceof GoogleCloudError && error.code === "GCP_PERMISSION_DENIED") {
        return {
          ...baseResult({
            success: false,
            dryRun: false,
            riskLevel: "READ_ONLY",
            projectId: id,
            warnings: ["Sin permiso para consultar billing"],
            errors: [error.toStructured()],
          }),
          billingEnabled: null,
        };
      }
      throw error;
    }
  }

  // --- APIs ---

  async listEnabledServices(projectId: string): Promise<GcpToolResultBase & { services: string[] }> {
    assertModuleEnabled(this.config);
    const id = validateProjectId(projectId);
    assertWritePolicy(this.config, { riskLevel: "READ_ONLY", projectId: id, dryRun: true });
    const result = await this.run({ op: "services.list.enabled", projectId: id });
    const raw = parseJsonOutput<Array<{ config?: { name?: string }; name?: string }>>(
      result.stdout,
      [],
    );
    const services = raw
      .map((s) => s.config?.name ?? s.name ?? "")
      .filter((n) => n.endsWith(".googleapis.com"));
    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        projectId: id,
        actions: [`APIs habilitadas: ${String(services.length)}`],
      }),
      services,
    };
  }

  async listAvailableServices(
    projectId: string,
  ): Promise<GcpToolResultBase & { services: string[] }> {
    assertModuleEnabled(this.config);
    const id = validateProjectId(projectId);
    assertWritePolicy(this.config, { riskLevel: "READ_ONLY", projectId: id, dryRun: true });
    const result = await this.run({ op: "services.list.available", projectId: id });
    const raw = parseJsonOutput<Array<{ config?: { name?: string }; name?: string }>>(
      result.stdout,
      [],
    );
    const services = raw
      .map((s) => s.config?.name ?? s.name ?? "")
      .filter((n) => n.endsWith(".googleapis.com"));
    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        projectId: id,
        actions: [`APIs disponibles (muestra): ${String(services.length)}`],
      }),
      services,
    };
  }

  async planEnableServices(input: {
    projectId: string;
    environment: GcpEnvironment;
    services: readonly string[];
    dryRun?: boolean;
  }): Promise<
    GcpToolResultBase & {
      requested: string[];
      alreadyEnabled: string[];
      pending: string[];
      invalid: string[];
      duplicates: string[];
    }
  > {
    assertModuleEnabled(this.config);
    const id = validateProjectId(input.projectId);
    assertWritePolicy(this.config, {
      riskLevel: "READ_ONLY",
      projectId: id,
      environment: input.environment,
      dryRun: true,
    });
    const { unique, duplicates, invalid } = normalizeServiceList(input.services);
    const enabled = await this.listEnabledServices(id);
    const enabledSet = new Set(enabled.services);
    const alreadyEnabled = unique.filter((s) => enabledSet.has(s));
    const pending = unique.filter((s) => !enabledSet.has(s));

    writeGcpAudit(this.config, {
      tool: "gcp_plan_enable_services",
      action: "plan_enable_services",
      projectId: id,
      environment: input.environment,
      riskLevel: "READ_ONLY",
      dryRun: true,
      changed: false,
      result: "dry_run",
      resource: pending.join(","),
    });

    return {
      ...baseResult({
        dryRun: true,
        riskLevel: "READ_ONLY",
        projectId: id,
        environment: input.environment,
        actions: ["Plan de enable services generado (idempotente)"],
        warnings: invalid.length > 0 ? [`APIs inválidas: ${invalid.join(", ")}`] : [],
        metadata: { plannedArgs: ["services", "enable", ...pending, `--project=${id}`] },
      }),
      requested: unique,
      alreadyEnabled,
      pending,
      invalid,
      duplicates,
    };
  }

  async enableServices(input: {
    projectId: string;
    environment: GcpEnvironment;
    services: readonly string[];
    dryRun: boolean;
    confirmation?: string;
  }): Promise<
    GcpToolResultBase & {
      requested: string[];
      alreadyEnabled: string[];
      pending: string[];
      enabledNow: string[];
    }
  > {
    const plan = await this.planEnableServices(input);
    const requiredConfirmation =
      input.environment === "production"
        ? `ENABLE SERVICES IN ${validateProjectId(input.projectId)}`
        : undefined;

    assertWritePolicy(this.config, {
      riskLevel: "LOW_RISK_WRITE",
      projectId: plan.projectId ?? input.projectId,
      environment: input.environment,
      dryRun: input.dryRun,
      ...(input.confirmation !== undefined ? { confirmation: input.confirmation } : {}),
      ...(requiredConfirmation !== undefined
        ? { requiredConfirmation }
        : {}),
    });

    if (input.dryRun || plan.pending.length === 0) {
      return {
        ...baseResult({
          dryRun: true,
          riskLevel: "LOW_RISK_WRITE",
          projectId: plan.projectId ?? input.projectId,
          environment: input.environment,
          actions:
            plan.pending.length === 0
              ? ["Nada que habilitar — idempotente"]
              : ["dryRun — no se habilitan APIs"],
          warnings: plan.warnings,
          metadata: plan.metadata,
        }),
        requested: plan.requested,
        alreadyEnabled: plan.alreadyEnabled,
        pending: plan.pending,
        enabledNow: [],
      };
    }

    await this.run({
      op: "services.enable",
      projectId: validateProjectId(input.projectId),
      services: plan.pending,
    });
    writeGcpAudit(this.config, {
      tool: "gcp_enable_services",
      action: "services.enable",
      projectId: input.projectId,
      environment: input.environment,
      resource: plan.pending.join(","),
      riskLevel: "LOW_RISK_WRITE",
      dryRun: false,
      changed: true,
      result: "success",
    });
    return {
      ...baseResult({
        dryRun: false,
        changed: true,
        riskLevel: "LOW_RISK_WRITE",
        projectId: input.projectId,
        environment: input.environment,
        actions: [`APIs habilitadas: ${plan.pending.join(", ")}`],
      }),
      requested: plan.requested,
      alreadyEnabled: plan.alreadyEnabled,
      pending: [],
      enabledNow: plan.pending,
    };
  }

  // --- Service accounts ---

  async listServiceAccounts(
    projectId: string,
  ): Promise<GcpToolResultBase & { serviceAccounts: GcpServiceAccountSummary[] }> {
    assertModuleEnabled(this.config);
    const id = validateProjectId(projectId);
    assertWritePolicy(this.config, { riskLevel: "READ_ONLY", projectId: id, dryRun: true });
    const result = await this.run({ op: "iam.sa.list", projectId: id });
    const raw = parseJsonOutput<
      Array<{ email?: string; uniqueId?: string; displayName?: string; disabled?: boolean }>
    >(result.stdout, []);
    const serviceAccounts: GcpServiceAccountSummary[] = raw
      .filter((sa) => typeof sa.email === "string")
      .map((sa) => ({
        email: sa.email as string,
        ...(sa.uniqueId ? { uniqueId: sa.uniqueId } : {}),
        ...(sa.displayName ? { displayName: sa.displayName } : {}),
        ...(typeof sa.disabled === "boolean" ? { disabled: sa.disabled } : {}),
      }));
    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        projectId: id,
        actions: [`Service accounts: ${String(serviceAccounts.length)}`],
      }),
      serviceAccounts,
    };
  }

  async planServiceAccount(input: {
    projectId: string;
    environment: GcpEnvironment;
    accountId: string;
    displayName?: string;
    description?: string;
  }): Promise<
    GcpToolResultBase & {
      accountId: string;
      email: string;
      exists: boolean;
      wouldCreate: boolean;
    }
  > {
    assertModuleEnabled(this.config);
    const id = validateProjectId(input.projectId);
    const accountId = validateServiceAccountId(input.accountId);
    const email = `${accountId}@${id}.iam.gserviceaccount.com`;
    assertWritePolicy(this.config, {
      riskLevel: "READ_ONLY",
      projectId: id,
      environment: input.environment,
      dryRun: true,
    });
    const listed = await this.listServiceAccounts(id);
    const exists = listed.serviceAccounts.some((sa) => sa.email === email);

    writeGcpAudit(this.config, {
      tool: "gcp_plan_service_account",
      action: "plan_service_account",
      projectId: id,
      environment: input.environment,
      resource: email,
      riskLevel: "READ_ONLY",
      dryRun: true,
      changed: false,
      result: "dry_run",
    });

    return {
      ...baseResult({
        dryRun: true,
        riskLevel: "READ_ONLY",
        projectId: id,
        environment: input.environment,
        actions: exists
          ? ["Service account ya existe — plan idempotente"]
          : ["Plan: crear service account (sin keys ni roles)"],
        metadata: {
          displayName: input.displayName ?? null,
          description: input.description ?? null,
          keysBlocked: true,
        },
      }),
      accountId,
      email,
      exists,
      wouldCreate: !exists,
    };
  }

  async createServiceAccount(input: {
    projectId: string;
    environment: GcpEnvironment;
    accountId: string;
    displayName?: string;
    description?: string;
    dryRun: boolean;
    confirmation?: string;
  }): Promise<
    GcpToolResultBase & {
      accountId: string;
      email: string;
      exists: boolean;
      created: boolean;
    }
  > {
    const plan = await this.planServiceAccount(input);
    const requiredConfirmation =
      input.environment === "production"
        ? `CREATE SERVICE ACCOUNT ${plan.accountId} IN ${validateProjectId(input.projectId)}`
        : undefined;

    assertWritePolicy(this.config, {
      riskLevel: "LOW_RISK_WRITE",
      projectId: input.projectId,
      environment: input.environment,
      dryRun: input.dryRun,
      ...(input.confirmation !== undefined ? { confirmation: input.confirmation } : {}),
      ...(requiredConfirmation !== undefined
        ? { requiredConfirmation }
        : {}),
    });

    if (input.dryRun || plan.exists) {
      return {
        ...baseResult({
          dryRun: true,
          riskLevel: "LOW_RISK_WRITE",
          projectId: input.projectId,
          environment: input.environment,
          actions: plan.exists
            ? ["Ya existe — no se crea"]
            : ["dryRun — no se crea service account"],
          metadata: { keysBlocked: true },
        }),
        accountId: plan.accountId,
        email: plan.email,
        exists: plan.exists,
        created: false,
      };
    }

    await this.run({
      op: "iam.sa.create",
      projectId: validateProjectId(input.projectId),
      accountId: plan.accountId,
      ...(input.displayName ? { displayName: input.displayName } : {}),
      ...(input.description ? { description: input.description } : {}),
    });
    writeGcpAudit(this.config, {
      tool: "gcp_create_service_account",
      action: "iam.sa.create",
      projectId: input.projectId,
      environment: input.environment,
      resource: plan.email,
      riskLevel: "LOW_RISK_WRITE",
      dryRun: false,
      changed: true,
      result: "success",
    });
    return {
      ...baseResult({
        dryRun: false,
        changed: true,
        riskLevel: "LOW_RISK_WRITE",
        projectId: input.projectId,
        environment: input.environment,
        actions: [`Service account creada: ${plan.email}`],
        metadata: { keysBlocked: true },
      }),
      accountId: plan.accountId,
      email: plan.email,
      exists: true,
      created: true,
    };
  }

  // --- Secret Manager ---

  async listSecrets(
    projectId: string,
  ): Promise<GcpToolResultBase & { secrets: Array<{ secretId: string; name: string }> }> {
    assertModuleEnabled(this.config);
    const id = validateProjectId(projectId);
    assertWritePolicy(this.config, { riskLevel: "READ_ONLY", projectId: id, dryRun: true });
    const result = await this.run({ op: "secrets.list", projectId: id });
    const raw = parseJsonOutput<Array<{ name?: string }>>(result.stdout, []);
    const secrets = raw
      .map((s) => {
        const name = s.name ?? "";
        const parts = name.split("/");
        const secretId = parts[parts.length - 1] ?? "";
        return { name, secretId };
      })
      .filter((s) => s.secretId.length > 0);
    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        projectId: id,
        actions: [`Secretos listados: ${String(secrets.length)} (sin valores)`],
      }),
      secrets,
    };
  }

  async getSecretMetadata(
    projectId: string,
    secretId: string,
  ): Promise<GcpToolResultBase & { secret: GcpSecretMetadata }> {
    assertModuleEnabled(this.config);
    const id = validateProjectId(projectId);
    const sid = validateSecretId(secretId);
    assertWritePolicy(this.config, { riskLevel: "READ_ONLY", projectId: id, dryRun: true });
    const result = await this.run({ op: "secrets.describe", projectId: id, secretId: sid });
    const raw = parseJsonOutput<{
      name?: string;
      createTime?: string;
      labels?: Record<string, string>;
      replication?: unknown;
    }>(result.stdout, {});
    if (!raw.name) {
      throw new GoogleCloudError("GCP_SECRET_NOT_FOUND", `Secreto no encontrado: ${sid}`, {
        projectId: id,
        resource: sid,
      });
    }
    return {
      ...baseResult({
        dryRun: false,
        riskLevel: "READ_ONLY",
        projectId: id,
        actions: ["Metadatos de secreto (sin valor)"],
      }),
      secret: {
        name: raw.name,
        secretId: sid,
        ...(raw.createTime ? { createTime: raw.createTime } : {}),
        ...(raw.labels ? { labels: raw.labels } : {}),
        ...(raw.replication !== undefined ? { replication: raw.replication } : {}),
      },
    };
  }

  async planSecret(input: {
    projectId: string;
    environment: GcpEnvironment;
    secretId: string;
    replication?: "automatic";
  }): Promise<
    GcpToolResultBase & {
      secretId: string;
      exists: boolean;
      wouldCreate: boolean;
    }
  > {
    assertModuleEnabled(this.config);
    const id = validateProjectId(input.projectId);
    const sid = validateSecretId(input.secretId);
    assertWritePolicy(this.config, {
      riskLevel: "READ_ONLY",
      projectId: id,
      environment: input.environment,
      dryRun: true,
    });

    let exists = false;
    try {
      await this.getSecretMetadata(id, sid);
      exists = true;
    } catch (error) {
      if (!(error instanceof GoogleCloudError) || error.code !== "GCP_SECRET_NOT_FOUND") {
        // describe may map not-found differently; also check list
        const listed = await this.listSecrets(id);
        exists = listed.secrets.some((s) => s.secretId === sid);
        if (!exists && error instanceof GoogleCloudError && error.code !== "GCP_CLI_EXECUTION_FAILED") {
          // fallthrough exists=false
        }
      }
    }

    writeGcpAudit(this.config, {
      tool: "gcp_plan_secret",
      action: "plan_secret",
      projectId: id,
      environment: input.environment,
      resource: sid,
      riskLevel: "READ_ONLY",
      dryRun: true,
      changed: false,
      result: "dry_run",
    });

    return {
      ...baseResult({
        dryRun: true,
        riskLevel: "READ_ONLY",
        projectId: id,
        environment: input.environment,
        actions: exists
          ? ["Secreto ya existe — plan idempotente"]
          : ["Plan: crear secreto (sin valor)"],
        metadata: { replication: input.replication ?? "automatic" },
      }),
      secretId: sid,
      exists,
      wouldCreate: !exists,
    };
  }

  async createSecret(input: {
    projectId: string;
    environment: GcpEnvironment;
    secretId: string;
    replication?: "automatic";
    dryRun: boolean;
    confirmation?: string;
  }): Promise<
    GcpToolResultBase & {
      secretId: string;
      exists: boolean;
      created: boolean;
    }
  > {
    const plan = await this.planSecret(input);
    const requiredConfirmation =
      input.environment === "production"
        ? `CREATE SECRET ${plan.secretId} IN ${validateProjectId(input.projectId)}`
        : undefined;

    assertWritePolicy(this.config, {
      riskLevel: "LOW_RISK_WRITE",
      projectId: input.projectId,
      environment: input.environment,
      dryRun: input.dryRun,
      ...(input.confirmation !== undefined ? { confirmation: input.confirmation } : {}),
      ...(requiredConfirmation !== undefined
        ? { requiredConfirmation }
        : {}),
    });

    if (input.dryRun || plan.exists) {
      return {
        ...baseResult({
          dryRun: true,
          riskLevel: "LOW_RISK_WRITE",
          projectId: input.projectId,
          environment: input.environment,
          actions: plan.exists ? ["Ya existe — no se crea"] : ["dryRun — no se crea secreto"],
        }),
        secretId: plan.secretId,
        exists: plan.exists,
        created: false,
      };
    }

    await this.run({
      op: "secrets.create",
      projectId: validateProjectId(input.projectId),
      secretId: plan.secretId,
      replication: "automatic",
    });
    writeGcpAudit(this.config, {
      tool: "gcp_create_secret",
      action: "secrets.create",
      projectId: input.projectId,
      environment: input.environment,
      resource: plan.secretId,
      riskLevel: "LOW_RISK_WRITE",
      dryRun: false,
      changed: true,
      result: "success",
    });
    return {
      ...baseResult({
        dryRun: false,
        changed: true,
        riskLevel: "LOW_RISK_WRITE",
        projectId: input.projectId,
        environment: input.environment,
        actions: [`Secreto creado: ${plan.secretId}`],
      }),
      secretId: plan.secretId,
      exists: true,
      created: true,
    };
  }

  async addSecretVersion(input: {
    projectId: string;
    environment: GcpEnvironment;
    secretId: string;
    value: string;
    dryRun: boolean;
    confirmation?: string;
  }): Promise<GcpToolResultBase & { secretId: string; valueProvided: boolean }> {
    const id = validateProjectId(input.projectId);
    const sid = validateSecretId(input.secretId);
    const requiredConfirmation =
      input.environment === "production" ? `ADD SECRET VERSION ${sid} IN ${id}` : undefined;

    assertWritePolicy(this.config, {
      riskLevel: "HIGH_RISK_WRITE",
      projectId: id,
      environment: input.environment,
      dryRun: input.dryRun,
      ...(input.confirmation !== undefined ? { confirmation: input.confirmation } : {}),
      ...(!input.dryRun && requiredConfirmation
        ? { requiredConfirmation }
        : {}),
    });

    // Nunca incluir value en audit/metadata
    writeGcpAudit(this.config, {
      tool: "gcp_add_secret_version",
      action: "secrets.versions.add",
      projectId: id,
      environment: input.environment,
      resource: sid,
      riskLevel: "HIGH_RISK_WRITE",
      dryRun: input.dryRun,
      changed: false,
      result: input.dryRun ? "dry_run" : "success",
    });

    if (input.dryRun) {
      return {
        ...baseResult({
          dryRun: true,
          riskLevel: "HIGH_RISK_WRITE",
          projectId: id,
          environment: input.environment,
          actions: ["dryRun — versión de secreto no agregada"],
          metadata: { stdinPlanned: true },
        }),
        secretId: sid,
        valueProvided: Boolean(input.value),
      };
    }

    if (!input.value) {
      throw new GoogleCloudError("GCP_INVALID_INPUT", "value es obligatorio para add_secret_version", {
        projectId: id,
        resource: sid,
      });
    }

    await this.run({
      op: "secrets.versions.add",
      projectId: id,
      secretId: sid,
      secretValue: input.value,
    });

    writeGcpAudit(this.config, {
      tool: "gcp_add_secret_version",
      action: "secrets.versions.add",
      projectId: id,
      environment: input.environment,
      resource: sid,
      riskLevel: "HIGH_RISK_WRITE",
      dryRun: false,
      changed: true,
      result: "success",
    });

    return {
      ...baseResult({
        dryRun: false,
        changed: true,
        riskLevel: "HIGH_RISK_WRITE",
        projectId: id,
        environment: input.environment,
        actions: [`Versión agregada a secreto ${sid} (valor no expuesto)`],
      }),
      secretId: sid,
      valueProvided: true,
    };
  }
}

export function createGoogleCloudProvider(
  options: GoogleCloudProviderOptions = {},
): GoogleCloudProvider {
  return new GoogleCloudProvider(options);
}

export const googleCloudProvider = createGoogleCloudProvider();

export { defaultGoogleCloudConfig, resolveGoogleCloudConfig };
