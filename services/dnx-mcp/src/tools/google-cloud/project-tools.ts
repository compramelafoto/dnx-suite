import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleCloudProvider } from "../../providers/google-cloud/index.js";
import { googleCloudProvider } from "../../providers/google-cloud/index.js";
import { jsonResult, withAudit } from "../shared/index.js";
import { getGoogleCloudProvider } from "./context.js";
import {
  gcpBillingAccountIdSchema,
  gcpConfirmationSchema,
  gcpDisplayNameSchema,
  gcpDryRunSchema,
  gcpEnvironmentSchema,
  gcpLabelsSchema,
  gcpParentIdSchema,
  gcpParentTypeSchema,
  gcpProjectIdSchema,
} from "./schemas.js";

const dryOnly = { dryRun: gcpDryRunSchema };

export function registerGcpListProjectsTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  server.registerTool(
    "gcp_list_projects",
    {
      title: "GCP List Projects",
      description: "Lista proyectos visibles filtrados por prefijos permitidos.",
      inputSchema: dryOnly,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(dryOnly).parse(input);
      return withAudit(
        { tool: "gcp_list_projects", action: "list_projects", dryRun: parsed.dryRun, confirmed: false },
        async () => {
          const active = getGoogleCloudProvider(provider);
          if (parsed.dryRun) {
            return jsonResult({ success: true, dryRun: true, riskLevel: "READ_ONLY", preview: { wouldFetch: ["projects.list"] } });
          }
          return jsonResult(await active.listProjects(), "Proyectos GCP");
        },
      );
    },
  );
}

export function registerGcpGetProjectTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    dryRun: gcpDryRunSchema,
  };
  server.registerTool(
    "gcp_get_project",
    {
      title: "GCP Get Project",
      description: "Describe un proyecto GCP (metadatos seguros).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_get_project",
          action: "get_project",
          project: parsed.projectId,
          dryRun: parsed.dryRun,
          confirmed: false,
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          if (parsed.dryRun) {
            return jsonResult({
              success: true,
              dryRun: true,
              riskLevel: "READ_ONLY",
              projectId: parsed.projectId,
              preview: { wouldFetch: ["projects.describe"] },
            });
          }
          return jsonResult(await active.getProject(parsed.projectId), "Proyecto GCP");
        },
      );
    },
  );
}

export function registerGcpGetActiveProjectTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  server.registerTool(
    "gcp_get_active_project",
    {
      title: "GCP Active Project",
      description: "Proyecto activo en la configuración local de gcloud.",
      inputSchema: dryOnly,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(dryOnly).parse(input);
      return withAudit(
        { tool: "gcp_get_active_project", action: "get_active_project", dryRun: parsed.dryRun, confirmed: false },
        async () => {
          const active = getGoogleCloudProvider(provider);
          if (parsed.dryRun) {
            return jsonResult({ success: true, dryRun: true, riskLevel: "READ_ONLY", preview: { wouldFetch: ["config.get core/project"] } });
          }
          return jsonResult(await active.getActiveProject(), "Proyecto activo");
        },
      );
    },
  );
}

export function registerGcpSetProjectTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    environment: gcpEnvironmentSchema,
    dryRun: gcpDryRunSchema,
    confirmation: gcpConfirmationSchema,
  };
  server.registerTool(
    "gcp_set_project",
    {
      title: "GCP Set Project",
      description:
        "Cambia solo la config local de gcloud (core/project). LOW_RISK_WRITE. Preferí dryRun:true.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_set_project",
          action: "set_project",
          project: parsed.projectId,
          dryRun: parsed.dryRun,
          confirmed: Boolean(parsed.confirmation),
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          return jsonResult(
            await active.setProject({
              projectId: parsed.projectId,
              environment: parsed.environment,
              dryRun: parsed.dryRun,
              ...(parsed.confirmation ? { confirmation: parsed.confirmation } : {}),
            }),
            "Set project (local gcloud)",
          );
        },
      );
    },
  );
}

export function registerGcpCheckBillingTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    dryRun: gcpDryRunSchema,
  };
  server.registerTool(
    "gcp_check_billing",
    {
      title: "GCP Check Billing",
      description: "Consulta si el proyecto tiene billing vinculado (read-only).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_check_billing",
          action: "check_billing",
          project: parsed.projectId,
          dryRun: parsed.dryRun,
          confirmed: false,
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          if (parsed.dryRun) {
            return jsonResult({
              success: true,
              dryRun: true,
              riskLevel: "READ_ONLY",
              projectId: parsed.projectId,
              preview: { wouldFetch: ["billing.projects.describe"] },
            });
          }
          return jsonResult(await active.checkBilling(parsed.projectId), "Billing GCP");
        },
      );
    },
  );
}

export function registerGcpPlanProjectTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    displayName: gcpDisplayNameSchema,
    environment: gcpEnvironmentSchema,
    parentType: gcpParentTypeSchema,
    parentId: gcpParentIdSchema,
    labels: gcpLabelsSchema,
    dryRun: gcpDryRunSchema,
  };
  server.registerTool(
    "gcp_plan_project",
    {
      title: "GCP Plan Project",
      description:
        "Plan idempotente para crear un proyecto GCP (no crea nada). Valida prefijo, labels y disponibilidad del ID.",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_plan_project",
          action: "plan_project",
          project: parsed.projectId,
          dryRun: true,
          confirmed: false,
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          return jsonResult(
            await active.planProject({
              projectId: parsed.projectId,
              displayName: parsed.displayName,
              environment: parsed.environment,
              parentType: parsed.parentType ?? null,
              parentId: parsed.parentId ?? null,
              ...(parsed.labels ? { labels: parsed.labels } : {}),
              dryRun: true,
            }),
            "Plan proyecto GCP",
          );
        },
      );
    },
  );
}

export function registerGcpCreateProjectTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    displayName: gcpDisplayNameSchema,
    environment: gcpEnvironmentSchema,
    parentType: gcpParentTypeSchema,
    parentId: gcpParentIdSchema,
    labels: gcpLabelsSchema,
    dryRun: gcpDryRunSchema,
    confirmation: gcpConfirmationSchema,
  };
  server.registerTool(
    "gcp_create_project",
    {
      title: "GCP Create Project",
      description:
        "Crea un proyecto GCP (HIGH_RISK_WRITE). Requiere flags de escritura + high-risk y confirmation exacta. Preferí dryRun.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_create_project",
          action: "create_project",
          project: parsed.projectId,
          dryRun: parsed.dryRun,
          confirmed: Boolean(parsed.confirmation),
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          return jsonResult(
            await active.createProject({
              projectId: parsed.projectId,
              displayName: parsed.displayName,
              environment: parsed.environment,
              parentType: parsed.parentType ?? null,
              parentId: parsed.parentId ?? null,
              ...(parsed.labels ? { labels: parsed.labels } : {}),
              dryRun: parsed.dryRun,
              ...(parsed.confirmation ? { confirmation: parsed.confirmation } : {}),
            }),
            "Crear proyecto GCP",
          );
        },
      );
    },
  );
}

export function registerGcpListBillingAccountsTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  server.registerTool(
    "gcp_list_billing_accounts",
    {
      title: "GCP List Billing Accounts",
      description:
        "Lista billing accounts visibles (READ_ONLY). Sin datos de pago ni tarjetas.",
      inputSchema: dryOnly,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(dryOnly).parse(input);
      return withAudit(
        {
          tool: "gcp_list_billing_accounts",
          action: "list_billing_accounts",
          dryRun: parsed.dryRun,
          confirmed: false,
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          if (parsed.dryRun) {
            return jsonResult({
              success: true,
              dryRun: true,
              riskLevel: "READ_ONLY",
              preview: { wouldFetch: ["billing.accounts.list"] },
            });
          }
          return jsonResult(await active.listBillingAccounts(), "Billing accounts");
        },
      );
    },
  );
}

export function registerGcpPlanLinkBillingTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    billingAccountId: gcpBillingAccountIdSchema,
    environment: gcpEnvironmentSchema,
    dryRun: gcpDryRunSchema,
  };
  server.registerTool(
    "gcp_plan_link_billing",
    {
      title: "GCP Plan Link Billing",
      description: "Plan idempotente para vincular billing a un proyecto (no modifica nada).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_plan_link_billing",
          action: "plan_link_billing",
          project: parsed.projectId,
          dryRun: true,
          confirmed: false,
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          return jsonResult(
            await active.planLinkBilling({
              projectId: parsed.projectId,
              billingAccountId: parsed.billingAccountId,
              environment: parsed.environment,
              dryRun: true,
            }),
            "Plan link billing",
          );
        },
      );
    },
  );
}

export function registerGcpLinkBillingTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    billingAccountId: gcpBillingAccountIdSchema,
    environment: gcpEnvironmentSchema,
    dryRun: gcpDryRunSchema,
    confirmation: gcpConfirmationSchema,
  };
  server.registerTool(
    "gcp_link_billing",
    {
      title: "GCP Link Billing",
      description:
        "Vincula billing account a un proyecto (HIGH_RISK_WRITE). Requiere flags + confirmation exacta. Preferí dryRun.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_link_billing",
          action: "link_billing",
          project: parsed.projectId,
          dryRun: parsed.dryRun,
          confirmed: Boolean(parsed.confirmation),
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          return jsonResult(
            await active.linkBilling({
              projectId: parsed.projectId,
              billingAccountId: parsed.billingAccountId,
              environment: parsed.environment,
              dryRun: parsed.dryRun,
              ...(parsed.confirmation ? { confirmation: parsed.confirmation } : {}),
            }),
            "Link billing",
          );
        },
      );
    },
  );
}

export function registerProjectTools(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  registerGcpListProjectsTool(server, provider);
  registerGcpGetProjectTool(server, provider);
  registerGcpGetActiveProjectTool(server, provider);
  registerGcpSetProjectTool(server, provider);
  registerGcpCheckBillingTool(server, provider);
  registerGcpPlanProjectTool(server, provider);
  registerGcpCreateProjectTool(server, provider);
  registerGcpListBillingAccountsTool(server, provider);
  registerGcpPlanLinkBillingTool(server, provider);
  registerGcpLinkBillingTool(server, provider);
}
