import { validatePlatform } from "../../platforms/index.js";
import { toPlatformContext, type PlatformDefinition } from "../../platforms/types.js";
import { DnxBrain } from "../../brain/index.js";
import type { VercelProvider } from "../../providers/vercel/index.js";
import { vercelProvider } from "../../providers/vercel/index.js";
import { getVercelProvider } from "../../tools/vercel/context.js";
import {
  handleVercelDeployRelease,
  handleVercelPrepareStaging,
  handleVercelRollbackRelease,
  handleVercelStatus,
  handleVercelValidateStaging,
} from "../../tools/vercel/index.js";
import { audit } from "../../tools/shared/audit.js";
import { resolveExecutionGate } from "../../tools/shared/guards.js";
import { logger } from "../../utils/index.js";
import { buildChecklist, buildRisks, isReadyForValidation } from "./release-checklist.js";
import {
  evaluateReleaseBrain,
  mergeBrainWithProviderGates,
  applyStagingDryRunBrainPolicy,
} from "./release-brain.js";
import {
  applyPlatformGitPolicy,
  assertGitAllowsReleaseExecution,
  GitReleaseBlockedError,
  inferReleaseGitTarget,
  resolveGitProvider,
  type ReleaseGitPolicyContext,
  type ReleaseGitTarget,
} from "./release-git.js";
import {
  assertPostgresAllowsReleaseExecution,
  PostgresReleaseBlockedError,
  resolvePostgresProvider,
} from "./release-postgres.js";
import { resolveCloudflareProvider } from "./release-cloudflare.js";
import {
  assertPrismaAllowsReleaseExecution,
  PrismaReleaseBlockedError,
  resolvePrismaProvider,
} from "./release-prisma.js";
import {
  buildExecuteReport,
  buildPrepareReport,
  buildRollbackReport,
  buildReleasePlan,
  buildValidateReport,
  createMetrics,
} from "./release-report.js";
import { normalizeVercelStatusSnapshot } from "./release-vercel-status.js";
import { ReleaseState } from "./release-state.js";
import type {
  ExecuteReleaseInput,
  ExecuteReleaseResult,
  PrepareReleaseInput,
  PrepareReleaseResult,
  ReleaseOrchestratorOptions,
  ReleaseToolName,
  RollbackReleaseInput,
  RollbackReleaseResult,
  ToolInvoker,
  ValidateReleaseInput,
  ValidateReleaseResult,
} from "./release-types.js";
import type { GitProvider } from "../../providers/git/provider.js";
import type { ReleaseReadiness as GitReleaseReadiness } from "../../providers/git/types/index.js";
import type { PrismaProvider } from "../../providers/prisma/provider.js";
import type { ReleaseReadiness as PrismaReleaseReadiness } from "../../providers/prisma/types/index.js";
import type { PostgresProvider } from "../../providers/postgres/provider.js";
import type { ReleaseReadiness as PostgresReleaseReadiness } from "../../providers/postgres/types/index.js";
import type { CloudflareProvider } from "../../providers/cloudflare/provider.js";
import type { CloudflareReleaseReadiness } from "../../providers/cloudflare/types/index.js";
import type { GitProviderResolver } from "./release-git.js";
import type { PrismaProviderResolver } from "./release-prisma.js";
import type { PostgresProviderResolver } from "./release-postgres.js";
import type { CloudflareProviderResolver } from "./release-cloudflare.js";
import type { ProviderRegistry } from "../../providers/registry/index.js";

/**
 * Invoca handlers de MCP tools en proceso.
 * El orquestador no conoce providers — solo esta abstracción.
 */
export class LocalToolInvoker implements ToolInvoker {
  constructor(private readonly resolveVercel: () => VercelProvider) {}

  async invoke<T>(tool: ReleaseToolName, input: Record<string, unknown>): Promise<T> {
    const provider = this.resolveVercel();

    switch (tool) {
      case "vercel_status":
        return (await handleVercelStatus(provider, {
          project: input.project as string | undefined,
          dryRun: (input.dryRun as boolean | undefined) ?? false,
        })) as T;

      case "vercel_prepare_staging":
        return (await handleVercelPrepareStaging(provider, {
          project: input.project as string,
          dryRun: (input.dryRun as boolean | undefined) ?? false,
        })) as T;

      case "vercel_validate_staging":
        return (await handleVercelValidateStaging(provider, {
          project: input.project as string,
          deploymentId: input.deploymentId as string | undefined,
          dryRun: (input.dryRun as boolean | undefined) ?? false,
        })) as T;

      case "vercel_deploy_release":
        return (await handleVercelDeployRelease(provider, {
          project: input.project as string,
          target:
            (input.target as "production" | "preview" | "development" | undefined) ?? "production",
          redeployFrom: input.redeployFrom as string | undefined,
          dryRun: (input.dryRun as boolean | undefined) ?? false,
          confirm: (input.confirm as boolean | undefined) ?? false,
          timeoutMs: (input.timeoutMs as number | undefined) ?? 600_000,
        })) as T;

      case "vercel_rollback_release":
        return (await handleVercelRollbackRelease(provider, {
          project: input.project as string,
          target:
            (input.target as "production" | "preview" | "development" | undefined) ?? "production",
          dryRun: (input.dryRun as boolean | undefined) ?? false,
          confirm: (input.confirm as boolean | undefined) ?? false,
          timeoutMs: (input.timeoutMs as number | undefined) ?? 600_000,
        })) as T;
    }
  }
}

export class ReleaseOrchestratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseOrchestratorError";
  }
}

/**
 * Orquestador de releases.
 * Coordina MCP tools de alto nivel sin conocer APIs externas.
 */
export class ReleaseOrchestrator {
  readonly state: ReleaseState;
  private readonly invoker: ToolInvoker;
  private readonly brain: DnxBrain;
  private readonly providerRegistry: ProviderRegistry | undefined;
  private readonly vercel: VercelProvider | undefined;
  private readonly git: GitProvider | undefined;
  private readonly getGitProvider: GitProviderResolver | undefined;
  private readonly prisma: PrismaProvider | undefined;
  private readonly getPrismaProvider: PrismaProviderResolver | undefined;
  private readonly postgres: PostgresProvider | undefined;
  private readonly getPostgresProvider: PostgresProviderResolver | undefined;
  private readonly cloudflare: CloudflareProvider | undefined;
  private readonly getCloudflareProvider: CloudflareProviderResolver | undefined;

  constructor(options: ReleaseOrchestratorOptions = {}) {
    this.state = new ReleaseState();
    this.providerRegistry = options.providerRegistry;
    this.vercel = options.vercel;
    this.brain = options.brain ?? new DnxBrain();
    this.git = options.git;
    this.getGitProvider = options.getGitProvider;
    this.prisma = options.prisma;
    this.getPrismaProvider = options.getPrismaProvider;
    this.postgres = options.postgres;
    this.getPostgresProvider = options.getPostgresProvider;
    this.cloudflare = options.cloudflare;
    this.getCloudflareProvider = options.getCloudflareProvider;
    this.invoker = options.invoker ?? new LocalToolInvoker(() => this.resolveVercel());
  }

  async prepareRelease(input: PrepareReleaseInput): Promise<PrepareReleaseResult> {
    const platform = ensurePlatform(input.platform);
    const ctx = toPlatformContext(platform);
    const dryRun = input.dryRun ?? false;
    const metricsTracker = createMetrics();

    return this.runOrchestration("prepareRelease", ctx.platformId, dryRun, async () => {
      this.state.bindPlatform(ctx.platformId);
      this.state.transition("preparing", "prepareRelease started");
      metricsTracker.start();

      logger.info(
        `[ReleaseOrchestrator] prepareRelease — platform=${ctx.platformId} vercel=${ctx.vercelProject} dryRun=${String(dryRun)}`,
      );

      const status = await this.invoker.invoke<Record<string, unknown>>("vercel_status", {
        project: ctx.vercelProject,
        dryRun,
      });
      metricsTracker.record("status", "vercel_status", dryRun);

      const staging = await this.invoker.invoke<Record<string, unknown>>("vercel_prepare_staging", {
        project: ctx.vercelProject,
        dryRun,
      });
      metricsTracker.record("staging", "vercel_prepare_staging", dryRun);

      const risks = buildRisks(status, staging);
      const checklist = buildChecklist(status, staging, risks);
      const checklistReady = isReadyForValidation(checklist, risks);
      const gitPolicyContext = this.buildGitPolicyContext(platform, dryRun);
      const gitReadiness = await this.evaluateGitReadiness(platform, gitPolicyContext);
      const prismaReadiness = await this.evaluatePrismaReadiness(platform);
      const postgresReadiness = await this.evaluatePostgresReadiness(platform);
      const cloudflareReadiness = await this.evaluateCloudflareReadiness(platform);

      const brain = mergeBrainWithProviderGates(
        evaluateReleaseBrain(this.brain, {
          operation: "release.prepare",
          platform,
          dryRun,
          phase: "prepared",
          status,
          staging,
          risks,
          checklist,
          issues: [],
          gitReadiness,
          prismaReadiness,
          postgresReadiness,
          cloudflareReadiness,
          gitPolicyContext,
        }),
        gitReadiness,
        prismaReadiness,
        postgresReadiness,
        cloudflareReadiness,
      );

      this.state.setSnapshots(status, staging);
      this.state.setBrainAssessment(brain);
      this.state.setGitReadiness(gitReadiness);
      this.state.setPrismaReadiness(prismaReadiness);
      this.state.setPostgresReadiness(postgresReadiness);
      this.state.setCloudflareReadiness(cloudflareReadiness);

      const readyForValidation = checklistReady && !brain.shouldBlock;
      const plan = buildReleasePlan({
        platformId: ctx.platformId,
        platformName: ctx.platformName,
        vercelProject: ctx.vercelProject,
        risks,
        checklist,
        readyForValidation,
      });

      this.state.transition("prepared", "prepareRelease completed");

      const result: PrepareReleaseResult = {
        phase: this.state.getPhase(),
        platformId: ctx.platformId,
        platformName: ctx.platformName,
        vercelProject: ctx.vercelProject,
        dryRun,
        status,
        staging,
        risks,
        checklist,
        plan,
        brain,
        git: gitReadiness,
        prisma: prismaReadiness,
        postgres: postgresReadiness,
        cloudflare: cloudflareReadiness,
        metrics: metricsTracker.finish(),
        report: {},
      };

      result.report = buildPrepareReport(result);
      return result;
    });
  }

  async validateRelease(input: ValidateReleaseInput): Promise<ValidateReleaseResult> {
    const platform = ensurePlatform(input.platform);
    const ctx = toPlatformContext(platform);
    const dryRun = input.dryRun ?? false;
    const metricsTracker = createMetrics();

    return this.runOrchestration("validateRelease", ctx.platformId, dryRun, async () => {
      if (!dryRun) {
        this.state.assertPhase(["prepared", "validated"], "validateRelease");
      }

      this.state.transition("validating", "validateRelease started");
      metricsTracker.start();

      logger.info(
        `[ReleaseOrchestrator] validateRelease — platform=${ctx.platformId} vercel=${ctx.vercelProject} dryRun=${String(dryRun)}`,
      );

      const { status, staging } = await this.resolveStatusAndStaging(ctx.vercelProject, dryRun);

      const validation = await this.invoker.invoke<Record<string, unknown>>(
        "vercel_validate_staging",
        {
          project: ctx.vercelProject,
          deploymentId: input.deploymentId,
          dryRun,
        },
      );
      metricsTracker.record("validation", "vercel_validate_staging", dryRun);

      const risks = buildRisks(status, staging);
      const checklist = buildChecklist(status, staging, risks);
      const issues = extractIssues(validation);
      const validationPassed = validation.passed === true;

      if (platform.maintenanceMode.enabled) {
        issues.push("Plataforma en modo mantenimiento");
      }

      const preliminaryDecision: "GO" | "NO-GO" =
        validationPassed && issues.length === 0 ? "GO" : "NO-GO";

      const gitPolicyContext = this.buildGitPolicyContext(platform, dryRun);
      const gitReadiness = await this.evaluateGitReadiness(platform, gitPolicyContext);
      const prismaReadiness = await this.evaluatePrismaReadiness(platform);
      const postgresReadiness = await this.evaluatePostgresReadiness(platform);
      const cloudflareReadiness = await this.evaluateCloudflareReadiness(platform);

      const brain = applyStagingDryRunBrainPolicy(
        mergeBrainWithProviderGates(
          evaluateReleaseBrain(this.brain, {
            operation: "release.validate",
            platform,
            dryRun,
            phase: "validating",
            status,
            staging,
            validation,
            risks,
            checklist,
            issues,
            validationDecision: preliminaryDecision,
            gitReadiness,
            prismaReadiness,
            postgresReadiness,
            cloudflareReadiness,
            gitPolicyContext,
          }),
          gitReadiness,
          prismaReadiness,
          postgresReadiness,
          cloudflareReadiness,
        ),
        {
          operation: "release.validate",
          platform,
          dryRun,
          validationPassed,
          gitPolicyContext,
          gitReadiness,
          prismaReadiness,
          postgresReadiness,
          cloudflareReadiness,
        },
      );

      this.state.setSnapshots(status, staging);
      this.state.setBrainAssessment(brain);
      this.state.setGitReadiness(gitReadiness);
      this.state.setPrismaReadiness(prismaReadiness);
      this.state.setPostgresReadiness(postgresReadiness);
      this.state.setCloudflareReadiness(cloudflareReadiness);

      const decision: "GO" | "NO-GO" =
        preliminaryDecision === "GO" && !brain.shouldBlock ? "GO" : "NO-GO";

      this.state.setValidationDecision(decision);
      this.state.transition(decision === "GO" ? "validated" : "failed", `decision: ${decision}`);

      const metrics = metricsTracker.finish();

      const result: ValidateReleaseResult = {
        phase: this.state.getPhase(),
        platformId: ctx.platformId,
        platformName: ctx.platformName,
        vercelProject: ctx.vercelProject,
        dryRun,
        decision,
        validation,
        issues,
        brain,
        git: gitReadiness,
        prisma: prismaReadiness,
        postgres: postgresReadiness,
        cloudflare: cloudflareReadiness,
        metrics,
        report: {},
      };

      result.report = buildValidateReport(result, decision);
      return result;
    });
  }

  async executeRelease(input: ExecuteReleaseInput): Promise<ExecuteReleaseResult> {
    const platform = ensurePlatform(input.platform);
    const ctx = toPlatformContext(platform);
    const dryRun = input.dryRun ?? false;
    const confirm = input.confirm ?? false;
    const target = input.target ?? "production";
    const metricsTracker = createMetrics();

    if (!platform.releasePolicy.allowedTargets.includes(target)) {
      throw new ReleaseOrchestratorError(
        `Target "${target}" no permitido para plataforma "${platform.id}"`,
      );
    }

    return this.runOrchestration("executeRelease", ctx.platformId, dryRun, async () => {
      if (!dryRun) {
        if (platform.releasePolicy.requireConfirmation) {
          resolveExecutionGate({ dryRun, confirm }, "executeRelease");
        }
        this.state.assertPhase("validated", "executeRelease");
      }

      const { status, staging } = await this.resolveStatusAndStaging(ctx.vercelProject, dryRun);

      const risks = buildRisks(status, staging);
      const checklist = buildChecklist(status, staging, risks);
      const lastDecision = this.state.getLastValidationDecision();
      const gitPolicyContext = this.buildGitPolicyContext(platform, dryRun, target);
      const gitReadiness = await this.evaluateGitReadiness(platform, gitPolicyContext);
      const prismaReadiness = await this.evaluatePrismaReadiness(platform);
      const postgresReadiness = await this.evaluatePostgresReadiness(platform);
      // Cloudflare/R2 se reporta pero no hard-bloquea execute (solo QA de fotos en prepare/validate).
      const cloudflareReadiness = await this.evaluateCloudflareReadiness(platform);

      const brain = mergeBrainWithProviderGates(
        evaluateReleaseBrain(this.brain, {
          operation: "release.execute",
          platform,
          dryRun,
          phase: "executing",
          status,
          staging,
          risks,
          checklist,
          issues: [],
          gitReadiness,
          prismaReadiness,
          postgresReadiness,
          cloudflareReadiness,
          gitPolicyContext,
          ...(lastDecision ? { validationDecision: lastDecision } : {}),
        }),
        gitReadiness,
        prismaReadiness,
        postgresReadiness,
        // No pasar cloudflare al hard-gate de execute: módulos sin assets no deben bloquearse.
        null,
      );

      this.state.setBrainAssessment(brain);
      this.state.setGitReadiness(gitReadiness);
      this.state.setPrismaReadiness(prismaReadiness);
      this.state.setPostgresReadiness(postgresReadiness);
      this.state.setCloudflareReadiness(cloudflareReadiness);

      if (!dryRun) {
        assertBrainAllowsExecution(brain);
        if (gitReadiness) {
          assertGitAllowsReleaseExecution(gitReadiness, platform, gitPolicyContext);
        }
        if (prismaReadiness) {
          assertPrismaAllowsReleaseExecution(prismaReadiness);
        }
        if (postgresReadiness) {
          assertPostgresAllowsReleaseExecution(postgresReadiness);
        }
      }

      this.state.transition("executing", "executeRelease started");
      metricsTracker.start();

      logger.info(
        `[ReleaseOrchestrator] executeRelease — platform=${ctx.platformId} vercel=${ctx.vercelProject} dryRun=${String(dryRun)} confirm=${String(confirm)} brainScore=${String(brain.score)}`,
      );

      const deployResult = await this.invoker.invoke<Record<string, unknown>>(
        "vercel_deploy_release",
        {
          project: ctx.vercelProject,
          target,
          redeployFrom: input.redeployFrom,
          dryRun,
          confirm,
          timeoutMs: input.timeoutMs ?? 600_000,
        },
      );
      metricsTracker.record("deploy", "vercel_deploy_release", dryRun);

      const executed = deployResult.executed === true;
      const success = deployResult.success === true;

      this.state.transition(
        dryRun ? "validated" : success ? "completed" : "failed",
        executed ? "deploy executed" : "deploy simulated",
      );

      const result: ExecuteReleaseResult = {
        phase: this.state.getPhase(),
        platformId: ctx.platformId,
        platformName: ctx.platformName,
        vercelProject: ctx.vercelProject,
        dryRun,
        executed,
        deployment:
          (deployResult.deployment as Record<string, unknown> | undefined) ?? deployResult,
        brain,
        git: gitReadiness,
        prisma: prismaReadiness,
        postgres: postgresReadiness,
        cloudflare: cloudflareReadiness,
        report: {},
        metrics: metricsTracker.finish(),
      };

      result.report = buildExecuteReport(result);

      return result;
    });
  }

  async rollbackRelease(input: RollbackReleaseInput): Promise<RollbackReleaseResult> {
    const platform = ensurePlatform(input.platform);
    const ctx = toPlatformContext(platform);
    const dryRun = input.dryRun ?? false;
    const confirm = input.confirm ?? false;
    const metricsTracker = createMetrics();

    if (!platform.rollbackPolicy.enabled) {
      throw new ReleaseOrchestratorError(`Rollback deshabilitado para plataforma "${platform.id}"`);
    }

    return this.runOrchestration("rollbackRelease", ctx.platformId, dryRun, async () => {
      if (!dryRun && platform.rollbackPolicy.requireConfirmation) {
        resolveExecutionGate({ dryRun, confirm }, "rollbackRelease");
      }

      this.state.transition("rolling_back", "rollbackRelease started");
      metricsTracker.start();

      logger.info(
        `[ReleaseOrchestrator] rollbackRelease — platform=${ctx.platformId} vercel=${ctx.vercelProject} dryRun=${String(dryRun)} confirm=${String(confirm)}`,
      );

      const rollbackResult = await this.invoker.invoke<Record<string, unknown>>(
        "vercel_rollback_release",
        {
          project: ctx.vercelProject,
          target: input.target ?? "production",
          dryRun,
          confirm,
          timeoutMs: input.timeoutMs ?? 600_000,
        },
      );
      metricsTracker.record("rollback", "vercel_rollback_release", dryRun);

      const executed = rollbackResult.executed === true;

      this.state.transition(
        dryRun ? this.state.getPhase() : "rolled_back",
        executed ? "rollback executed" : "rollback simulated",
      );

      const result: RollbackReleaseResult = {
        phase: this.state.getPhase(),
        platformId: ctx.platformId,
        platformName: ctx.platformName,
        vercelProject: ctx.vercelProject,
        dryRun,
        executed,
        report: rollbackResult,
        metrics: metricsTracker.finish(),
      };

      result.report = buildRollbackReport(result);

      return result;
    });
  }

  private async resolveStatusAndStaging(
    vercelProject: string,
    dryRun: boolean,
  ): Promise<{ status: Record<string, unknown>; staging: Record<string, unknown> }> {
    const cached = this.state.getSnapshots();
    if (cached.status && cached.staging) {
      return {
        status: normalizeVercelStatusSnapshot(cached.status, vercelProject) as Record<
          string,
          unknown
        >,
        staging: cached.staging,
      };
    }

    const status = await this.invoker.invoke<Record<string, unknown>>("vercel_status", {
      project: vercelProject,
      dryRun,
    });

    const staging = await this.invoker.invoke<Record<string, unknown>>("vercel_prepare_staging", {
      project: vercelProject,
      dryRun,
    });

    const normalizedStatus = normalizeVercelStatusSnapshot(status, vercelProject) as Record<
      string,
      unknown
    >;

    this.state.setSnapshots(normalizedStatus, staging);

    return { status: normalizedStatus, staging };
  }

  private resolveGit(platform: PlatformDefinition): GitProvider | undefined {
    const fromDirect = resolveGitProvider(platform, {
      ...(this.git ? { git: this.git } : {}),
      ...(this.getGitProvider ? { getGitProvider: this.getGitProvider } : {}),
    });

    if (fromDirect) {
      return fromDirect;
    }

    return this.providerRegistry?.getProvider("git") as GitProvider | undefined;
  }

  private buildGitPolicyContext(
    platform: PlatformDefinition,
    dryRun: boolean,
    target?: ReleaseGitTarget,
  ): ReleaseGitPolicyContext {
    return {
      dryRun,
      target: target ?? inferReleaseGitTarget(platform),
    };
  }

  private async evaluateGitReadiness(
    platform: PlatformDefinition,
    context: ReleaseGitPolicyContext,
  ): Promise<GitReleaseReadiness | null> {
    const git = this.resolveGit(platform);
    if (!git?.isConfigured()) {
      return null;
    }

    const readiness = await git.assessReleaseReadiness();
    return applyPlatformGitPolicy(readiness, platform, context);
  }

  private resolvePrisma(platform: PlatformDefinition): PrismaProvider | undefined {
    const fromDirect = resolvePrismaProvider(platform, {
      ...(this.prisma ? { prisma: this.prisma } : {}),
      ...(this.getPrismaProvider ? { getPrismaProvider: this.getPrismaProvider } : {}),
    });

    if (fromDirect) {
      return fromDirect;
    }

    return this.providerRegistry?.getProvider("prisma") as PrismaProvider | undefined;
  }

  private resolveVercel(): VercelProvider {
    const provider =
      this.vercel ??
      (this.providerRegistry?.getProvider("vercel") as VercelProvider | undefined) ??
      vercelProvider;

    return getVercelProvider(provider);
  }

  private async evaluatePrismaReadiness(
    platform: PlatformDefinition,
  ): Promise<PrismaReleaseReadiness | null> {
    const prisma = this.resolvePrisma(platform);
    if (!prisma?.isConfigured()) {
      return null;
    }

    return prisma.assessReleaseReadiness();
  }

  private resolvePostgres(platform: PlatformDefinition): PostgresProvider | undefined {
    const fromDirect = resolvePostgresProvider(platform, {
      ...(this.postgres ? { postgres: this.postgres } : {}),
      ...(this.getPostgresProvider ? { getPostgresProvider: this.getPostgresProvider } : {}),
    });

    if (fromDirect) {
      return fromDirect;
    }

    return this.providerRegistry?.getProvider("postgres") as PostgresProvider | undefined;
  }

  private async evaluatePostgresReadiness(
    platform: PlatformDefinition,
  ): Promise<PostgresReleaseReadiness | null> {
    const postgres = this.resolvePostgres(platform);
    if (!postgres?.isConfigured()) {
      return null;
    }

    return postgres.assessReleaseReadiness();
  }

  private resolveCloudflare(platform: PlatformDefinition): CloudflareProvider | undefined {
    const fromDirect = resolveCloudflareProvider(platform, {
      ...(this.cloudflare ? { cloudflare: this.cloudflare } : {}),
      ...(this.getCloudflareProvider ? { getCloudflareProvider: this.getCloudflareProvider } : {}),
    });

    if (fromDirect) {
      return fromDirect;
    }

    if (platform.r2 === null) {
      return undefined;
    }

    return this.providerRegistry?.getProvider("cloudflare") as CloudflareProvider | undefined;
  }

  private async evaluateCloudflareReadiness(
    platform: PlatformDefinition,
  ): Promise<CloudflareReleaseReadiness | null> {
    if (platform.r2 === null) {
      return null;
    }

    const cloudflare = this.resolveCloudflare(platform);
    if (!cloudflare) {
      return null;
    }

    return cloudflare.assessReleaseReadiness(platform);
  }

  private async runOrchestration<T>(
    action: string,
    platformId: string,
    dryRun: boolean,
    operation: () => Promise<T>,
  ): Promise<T> {
    const startedAt = Date.now();

    try {
      const result = await operation();

      audit({
        tool: "release_orchestrator",
        action,
        project: platformId,
        dryRun,
        confirmed: false,
        outcome: dryRun ? "dry_run" : "success",
        durationMs: Date.now() - startedAt,
        metadata: { platformId },
      });

      return result;
    } catch (error) {
      this.state.transition("failed", error instanceof Error ? error.message : "unknown error");

      audit({
        tool: "release_orchestrator",
        action,
        project: platformId,
        dryRun,
        confirmed: false,
        outcome: "error",
        durationMs: Date.now() - startedAt,
        metadata: {
          platformId,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      logger.error(`[ReleaseOrchestrator] ${action} failed`, error);
      if (
        error instanceof GitReleaseBlockedError ||
        error instanceof PrismaReleaseBlockedError ||
        error instanceof PostgresReleaseBlockedError
      ) {
        throw new ReleaseOrchestratorError(error.message);
      }
      throw error;
    }
  }
}

function ensurePlatform(platform: PlatformDefinition): PlatformDefinition {
  const validation = validatePlatform(platform);
  if (!validation.valid) {
    throw new ReleaseOrchestratorError(
      `Plataforma inválida "${platform.id}": ${validation.errors.join("; ")}`,
    );
  }
  return platform;
}

function extractIssues(validation: Record<string, unknown>): string[] {
  if (Array.isArray(validation.issues)) {
    return validation.issues.filter((issue): issue is string => typeof issue === "string");
  }

  if (validation.report && typeof validation.report === "object") {
    const report = validation.report as Record<string, unknown>;
    if (Array.isArray(report.issues)) {
      return report.issues.filter((issue): issue is string => typeof issue === "string");
    }
  }

  return [];
}

function assertBrainAllowsExecution(brain: { shouldBlock: boolean; recommendation: string }): void {
  if (brain.shouldBlock) {
    throw new ReleaseOrchestratorError(`Release bloqueado por DNX Brain: ${brain.recommendation}`);
  }
}
