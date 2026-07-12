import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleCloudProvider } from "../../providers/google-cloud/index.js";
import { googleCloudProvider } from "../../providers/google-cloud/index.js";
import { jsonResult, withAudit } from "../shared/index.js";
import { getGoogleCloudProvider } from "./context.js";
import {
  gcpConfirmationSchema,
  gcpDryRunSchema,
  gcpEnvironmentSchema,
  gcpProjectIdSchema,
} from "./schemas.js";

export function registerGcpListEnabledServicesTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = { projectId: gcpProjectIdSchema, dryRun: gcpDryRunSchema };
  server.registerTool(
    "gcp_list_enabled_services",
    {
      title: "GCP List Enabled Services",
      description: "Lista APIs habilitadas en el proyecto.",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_list_enabled_services",
          action: "list_enabled_services",
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
              preview: { wouldFetch: ["services.list --enabled"] },
            });
          }
          return jsonResult(await active.listEnabledServices(parsed.projectId), "APIs habilitadas");
        },
      );
    },
  );
}

export function registerGcpListAvailableServicesTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = { projectId: gcpProjectIdSchema, dryRun: gcpDryRunSchema };
  server.registerTool(
    "gcp_list_available_services",
    {
      title: "GCP List Available Services",
      description: "Muestra APIs disponibles (muestra limitada).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_list_available_services",
          action: "list_available_services",
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
              preview: { wouldFetch: ["services.list --available"] },
            });
          }
          return jsonResult(await active.listAvailableServices(parsed.projectId), "APIs disponibles");
        },
      );
    },
  );
}

export function registerGcpPlanEnableServicesTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    environment: gcpEnvironmentSchema,
    services: z.array(z.string()).min(1),
    dryRun: gcpDryRunSchema,
  };
  server.registerTool(
    "gcp_plan_enable_services",
    {
      title: "GCP Plan Enable Services",
      description: "Plan idempotente para habilitar APIs (no ejecuta).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_plan_enable_services",
          action: "plan_enable_services",
          project: parsed.projectId,
          dryRun: true,
          confirmed: false,
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          return jsonResult(
            await active.planEnableServices({
              projectId: parsed.projectId,
              environment: parsed.environment,
              services: parsed.services,
              dryRun: true,
            }),
            "Plan enable services",
          );
        },
      );
    },
  );
}

export function registerGcpEnableServicesTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    environment: gcpEnvironmentSchema,
    services: z.array(z.string()).min(1),
    dryRun: gcpDryRunSchema,
    confirmation: gcpConfirmationSchema,
  };
  server.registerTool(
    "gcp_enable_services",
    {
      title: "GCP Enable Services",
      description:
        "Habilita APIs (LOW_RISK_WRITE). Por defecto dryRun. En production exige confirmation exacta.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_enable_services",
          action: "enable_services",
          project: parsed.projectId,
          dryRun: parsed.dryRun,
          confirmed: Boolean(parsed.confirmation),
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          return jsonResult(
            await active.enableServices({
              projectId: parsed.projectId,
              environment: parsed.environment,
              services: parsed.services,
              dryRun: parsed.dryRun,
              ...(parsed.confirmation ? { confirmation: parsed.confirmation } : {}),
            }),
            "Enable services",
          );
        },
      );
    },
  );
}

export function registerServiceTools(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  registerGcpListEnabledServicesTool(server, provider);
  registerGcpListAvailableServicesTool(server, provider);
  registerGcpPlanEnableServicesTool(server, provider);
  registerGcpEnableServicesTool(server, provider);
}
