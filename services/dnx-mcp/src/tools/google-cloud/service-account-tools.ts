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

export function registerGcpListServiceAccountsTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = { projectId: gcpProjectIdSchema, dryRun: gcpDryRunSchema };
  server.registerTool(
    "gcp_list_service_accounts",
    {
      title: "GCP List Service Accounts",
      description: "Lista service accounts del proyecto (sin keys).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_list_service_accounts",
          action: "list_service_accounts",
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
              preview: { wouldFetch: ["iam.service-accounts.list"] },
            });
          }
          return jsonResult(await active.listServiceAccounts(parsed.projectId), "Service accounts");
        },
      );
    },
  );
}

export function registerGcpPlanServiceAccountTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    environment: gcpEnvironmentSchema,
    accountId: z.string().min(6).max(30),
    displayName: z.string().optional(),
    description: z.string().optional(),
    dryRun: gcpDryRunSchema,
  };
  server.registerTool(
    "gcp_plan_service_account",
    {
      title: "GCP Plan Service Account",
      description: "Plan idempotente para crear SA (sin roles ni keys).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_plan_service_account",
          action: "plan_service_account",
          project: parsed.projectId,
          dryRun: true,
          confirmed: false,
          metadata: { accountId: parsed.accountId },
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          return jsonResult(
            await active.planServiceAccount({
              projectId: parsed.projectId,
              environment: parsed.environment,
              accountId: parsed.accountId,
              ...(parsed.displayName ? { displayName: parsed.displayName } : {}),
              ...(parsed.description ? { description: parsed.description } : {}),
            }),
            "Plan service account",
          );
        },
      );
    },
  );
}

export function registerGcpCreateServiceAccountTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    environment: gcpEnvironmentSchema,
    accountId: z.string().min(6).max(30),
    displayName: z.string().optional(),
    description: z.string().optional(),
    dryRun: gcpDryRunSchema,
    confirmation: gcpConfirmationSchema,
  };
  server.registerTool(
    "gcp_create_service_account",
    {
      title: "GCP Create Service Account",
      description:
        "Crea service account (LOW_RISK_WRITE). No crea keys ni asigna roles. Preferí dryRun.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_create_service_account",
          action: "create_service_account",
          project: parsed.projectId,
          dryRun: parsed.dryRun,
          confirmed: Boolean(parsed.confirmation),
          metadata: { accountId: parsed.accountId },
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          return jsonResult(
            await active.createServiceAccount({
              projectId: parsed.projectId,
              environment: parsed.environment,
              accountId: parsed.accountId,
              dryRun: parsed.dryRun,
              ...(parsed.displayName ? { displayName: parsed.displayName } : {}),
              ...(parsed.description ? { description: parsed.description } : {}),
              ...(parsed.confirmation ? { confirmation: parsed.confirmation } : {}),
            }),
            "Create service account",
          );
        },
      );
    },
  );
}

/**
 * Reservadas para fases futuras — tipadas pero NO registradas.
 * gcp_get_service_account_roles
 * gcp_grant_service_account_role
 * gcp_revoke_service_account_role
 */
export type FutureServiceAccountRoleTools =
  | "gcp_get_service_account_roles"
  | "gcp_grant_service_account_role"
  | "gcp_revoke_service_account_role";

export function registerServiceAccountTools(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  registerGcpListServiceAccountsTool(server, provider);
  registerGcpPlanServiceAccountTool(server, provider);
  registerGcpCreateServiceAccountTool(server, provider);
}
