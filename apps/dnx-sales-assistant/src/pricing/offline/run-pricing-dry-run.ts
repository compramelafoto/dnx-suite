/**
 * Orquestador offline: loaders → prepare → adaptador → engine.
 * I/O solo vía loaders. Sin HTTP, sin escritura, sin persistencia.
 */
import type { QuoteRequestDraft } from "../../quote-request/models.js";
import type { PricingCalculationResult } from "../calculation-contract.js";
import { loadPricingJobFromPath } from "../config/load-pricing-job.js";
import { loadPricingProfileFromPath } from "../config/load-pricing-profile.js";
import { loadServiceTemplatesFromPath } from "../config/load-service-templates.js";
import {
  defaultJobLocalPath,
  defaultProfileLocalPath,
  defaultTemplatesLocalPath,
} from "../config/paths.js";
import { createCuantoCobroCompatibleInput } from "../cuanto-cobro-adapter/create-calculation-input.js";
import {
  createCuantoCobroPricingEngine,
  type CuantoCobroPricingEngineOptions,
} from "../cuanto-cobro-engine/cuanto-cobro-pricing-engine.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";
import type {
  PricingConfigurationIssue,
  PricingProfile,
  PricingServiceTemplate,
  PricingServiceTemplateCatalog,
} from "../models.js";
import { preparePricingJob } from "../prepare-pricing-job.js";

export type PricingDryRunOptions = {
  profilePath?: string;
  templatesPath?: string;
  jobPath?: string;
  /** Solo tests: evita I/O y usa valores en memoria. */
  inline?: {
    profile: PricingProfile;
    catalog: PricingServiceTemplateCatalog;
    draft: QuoteRequestDraft;
  };
  engineOptions?: CuantoCobroPricingEngineOptions;
};

export type PricingDryRunResult = {
  exitCode: number;
  lines: string[];
  stage:
    | "profile"
    | "catalog"
    | "job"
    | "prepare"
    | "adapter"
    | "engine"
    | "complete";
  calculation?: PricingCalculationResult;
  issues: PricingConfigurationIssue[];
};

function findTemplate(
  catalog: PricingServiceTemplateCatalog,
  serviceType: string,
): PricingServiceTemplate | undefined {
  return catalog.templates.find((t) => t.serviceType === serviceType);
}

function formatReadyLines(result: Extract<PricingCalculationResult, { status: "READY" }>): string[] {
  return [
    "Estado: READY",
    `Moneda: ${result.currency}`,
    `Mínimo sostenible: ${result.minimumSustainablePrice}`,
    `Recomendado negocio: ${result.recommendedBusinessPrice}`,
    `Perfil: ${result.profileVersion}`,
    `Plantilla: ${result.templateVersion}`,
    `Fórmula: ${result.formulaVersion}`,
    `Warnings: ${result.warnings.length}`,
    "Aprobación comercial: NOT_REVIEWED (cálculo técnico ≠ autorización de envío)",
  ];
}

function formatBlockedLines(
  stage: PricingDryRunResult["stage"],
  issues: PricingConfigurationIssue[],
): string[] {
  const lines = [
    "DNX pricing dry-run — no listo",
    `Etapa: ${stage}`,
    `Errores: ${issues.length}`,
  ];
  for (const err of issues.slice(0, 15)) {
    lines.push(`  ERROR [${err.code}] ${err.path}: ${err.message}`);
  }
  if (issues.length > 15) {
    lines.push(`  … ${issues.length - 15} errores más`);
  }
  lines.push(
    "Sin montos. Completá profile/templates/job .local.json (no se crean automáticamente).",
  );
  lines.push(
    "El dry-run no autoriza enviar el precio al cliente (approval: NOT_REVIEWED).",
  );
  return lines;
}

/**
 * Dry-run completo. No escribe archivos. No inicia servidor.
 */
export async function runPricingDryRun(
  options: PricingDryRunOptions = {},
): Promise<PricingDryRunResult> {
  if (options.inline) {
    return runInlineDryRun(options.inline, options.engineOptions);
  }

  const profilePath = options.profilePath ?? defaultProfileLocalPath();
  const templatesPath = options.templatesPath ?? defaultTemplatesLocalPath();
  const jobPath = options.jobPath ?? defaultJobLocalPath();

  const profileLoad = loadPricingProfileFromPath(profilePath);
  if (profileLoad.status !== "READY") {
    const issues = profileLoad.issues;
    return {
      exitCode: 1,
      stage: "profile",
      issues,
      lines: [
        `perfil: ${profilePath}`,
        `plantillas: ${templatesPath}`,
        `job: ${jobPath}`,
        ...formatBlockedLines("profile", issues),
      ],
    };
  }

  const catalogLoad = loadServiceTemplatesFromPath(templatesPath);
  if (catalogLoad.status !== "READY") {
    const issues = catalogLoad.issues;
    return {
      exitCode: 1,
      stage: "catalog",
      issues,
      lines: [
        `perfil: ${profilePath}`,
        `plantillas: ${templatesPath}`,
        `job: ${jobPath}`,
        ...formatBlockedLines("catalog", issues),
      ],
    };
  }

  const jobLoad = loadPricingJobFromPath(jobPath);
  if (jobLoad.status !== "READY") {
    const issues = jobLoad.issues;
    return {
      exitCode: 1,
      stage: "job",
      issues,
      lines: [
        `perfil: ${profilePath}`,
        `plantillas: ${templatesPath}`,
        `job: ${jobPath}`,
        ...formatBlockedLines("job", issues),
      ],
    };
  }

  const draft: QuoteRequestDraft = {
    serviceType: jobLoad.value.serviceType,
    eventDate: jobLoad.value.eventDate,
    city: jobLoad.value.city,
    durationHours: jobLoad.value.durationHours,
  };

  return runPreparedPipeline({
    profile: profileLoad.value,
    catalog: catalogLoad.value,
    draft,
    pathLines: [
      `perfil: ${profilePath}`,
      `plantillas: ${templatesPath}`,
      `job: ${jobPath}`,
    ],
    engineOptions: options.engineOptions,
  });
}

async function runInlineDryRun(
  inline: NonNullable<PricingDryRunOptions["inline"]>,
  engineOptions?: CuantoCobroPricingEngineOptions,
): Promise<PricingDryRunResult> {
  return runPreparedPipeline({
    profile: inline.profile,
    catalog: inline.catalog,
    draft: inline.draft,
    pathLines: ["modo: inline (test)"],
    engineOptions,
  });
}

async function runPreparedPipeline(args: {
  profile: PricingProfile;
  catalog: PricingServiceTemplateCatalog;
  draft: QuoteRequestDraft;
  pathLines: string[];
  engineOptions?: CuantoCobroPricingEngineOptions;
}): Promise<PricingDryRunResult> {
  const serviceType = args.draft.serviceType;
  if (!serviceType || serviceType === "UNKNOWN") {
    const issues = [
      issue(
        PricingIssueCode.JOB_UNKNOWN_SERVICE,
        "serviceType",
        "ERROR",
        "Servicio ausente o UNKNOWN.",
      ),
    ];
    return {
      exitCode: 1,
      stage: "job",
      issues,
      lines: [...args.pathLines, ...formatBlockedLines("job", issues)],
    };
  }

  const template = findTemplate(args.catalog, serviceType);
  if (!template) {
    const issues = [
      issue(
        PricingIssueCode.TEMPLATE_UNKNOWN_SERVICE,
        "catalog",
        "ERROR",
        `No hay plantilla para ${serviceType}.`,
      ),
    ];
    return {
      exitCode: 1,
      stage: "prepare",
      issues,
      lines: [...args.pathLines, ...formatBlockedLines("prepare", issues)],
    };
  }

  const prepared = preparePricingJob(args.draft, template);
  if (prepared.status !== "READY") {
    const issues = [
      issue(
        PricingIssueCode.DRY_RUN_STAGE_FAILED,
        "prepare",
        "ERROR",
        prepared.status === "UNSUPPORTED"
          ? prepared.reason
          : `prepare ${prepared.status}: ${(prepared.missingFields ?? []).join(", ")}`,
      ),
    ];
    return {
      exitCode: 1,
      stage: "prepare",
      issues,
      lines: [...args.pathLines, ...formatBlockedLines("prepare", issues)],
    };
  }

  const adapted = createCuantoCobroCompatibleInput({
    profile: args.profile,
    template,
    preparedJob: prepared,
  });

  if (adapted.status !== "READY") {
    const issues =
      adapted.status === "UNSUPPORTED"
        ? adapted.issues
        : adapted.status === "INCOMPLETE"
          ? adapted.issues
          : adapted.issues;
    return {
      exitCode: 1,
      stage: "adapter",
      issues,
      lines: [...args.pathLines, ...formatBlockedLines("adapter", issues)],
      calculation:
        adapted.status === "INCOMPLETE"
          ? {
              status: "INCOMPLETE",
              missingFields: adapted.missingFields,
              issues: adapted.issues,
              approvalStatus: "NOT_REVIEWED",
            }
          : undefined,
    };
  }

  const engine = createCuantoCobroPricingEngine(args.engineOptions);
  const calculation = await engine.calculate({
    input: adapted.input,
    profileVersion: adapted.profileVersion,
    templateVersion: adapted.templateVersion,
    formulaVersion: adapted.formulaVersion,
    warnings: adapted.warnings,
  });

  if (calculation.status === "READY") {
    return {
      exitCode: 0,
      stage: "complete",
      issues: [],
      calculation,
      lines: [...args.pathLines, ...formatReadyLines(calculation)],
    };
  }

  const issues =
    calculation.status === "INCOMPLETE" ? calculation.issues : calculation.issues;
  return {
    exitCode: 1,
    stage: "engine",
    issues,
    calculation,
    lines: [...args.pathLines, ...formatBlockedLines("engine", issues)],
  };
}
