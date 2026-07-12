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

export function registerGcpListSecretsTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = { projectId: gcpProjectIdSchema, dryRun: gcpDryRunSchema };
  server.registerTool(
    "gcp_list_secrets",
    {
      title: "GCP List Secrets",
      description: "Lista secretos (solo IDs/nombres, nunca valores).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_list_secrets",
          action: "list_secrets",
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
              preview: { wouldFetch: ["secrets.list"] },
            });
          }
          return jsonResult(await active.listSecrets(parsed.projectId), "Secretos (metadatos)");
        },
      );
    },
  );
}

export function registerGcpGetSecretMetadataTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    secretId: z.string().min(1).max(255),
    dryRun: gcpDryRunSchema,
  };
  server.registerTool(
    "gcp_get_secret_metadata",
    {
      title: "GCP Secret Metadata",
      description: "Metadatos de un secreto. Nunca lee el valor.",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_get_secret_metadata",
          action: "get_secret_metadata",
          project: parsed.projectId,
          dryRun: parsed.dryRun,
          confirmed: false,
          metadata: { secretId: parsed.secretId },
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          if (parsed.dryRun) {
            return jsonResult({
              success: true,
              dryRun: true,
              riskLevel: "READ_ONLY",
              projectId: parsed.projectId,
              preview: { wouldFetch: ["secrets.describe"], secretId: parsed.secretId },
            });
          }
          return jsonResult(
            await active.getSecretMetadata(parsed.projectId, parsed.secretId),
            "Secret metadata",
          );
        },
      );
    },
  );
}

export function registerGcpPlanSecretTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    environment: gcpEnvironmentSchema,
    secretId: z.string().min(1).max(255),
    replication: z.literal("automatic").default("automatic"),
    dryRun: gcpDryRunSchema,
  };
  server.registerTool(
    "gcp_plan_secret",
    {
      title: "GCP Plan Secret",
      description: "Plan idempotente para crear secreto (sin valor).",
      inputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_plan_secret",
          action: "plan_secret",
          project: parsed.projectId,
          dryRun: true,
          confirmed: false,
          metadata: { secretId: parsed.secretId },
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          return jsonResult(
            await active.planSecret({
              projectId: parsed.projectId,
              environment: parsed.environment,
              secretId: parsed.secretId,
              replication: "automatic",
            }),
            "Plan secret",
          );
        },
      );
    },
  );
}

export function registerGcpCreateSecretTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    environment: gcpEnvironmentSchema,
    secretId: z.string().min(1).max(255),
    replication: z.literal("automatic").default("automatic"),
    dryRun: gcpDryRunSchema,
    confirmation: gcpConfirmationSchema,
  };
  server.registerTool(
    "gcp_create_secret",
    {
      title: "GCP Create Secret",
      description: "Crea secreto vacío (LOW_RISK_WRITE). No acepta ni devuelve valores.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_create_secret",
          action: "create_secret",
          project: parsed.projectId,
          dryRun: parsed.dryRun,
          confirmed: Boolean(parsed.confirmation),
          metadata: { secretId: parsed.secretId },
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          return jsonResult(
            await active.createSecret({
              projectId: parsed.projectId,
              environment: parsed.environment,
              secretId: parsed.secretId,
              replication: "automatic",
              dryRun: parsed.dryRun,
              ...(parsed.confirmation ? { confirmation: parsed.confirmation } : {}),
            }),
            "Create secret",
          );
        },
      );
    },
  );
}

export function registerGcpAddSecretVersionTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  const inputSchema = {
    projectId: gcpProjectIdSchema,
    environment: gcpEnvironmentSchema,
    secretId: z.string().min(1).max(255),
    value: z.string().min(1),
    dryRun: gcpDryRunSchema,
    confirmation: gcpConfirmationSchema,
  };
  server.registerTool(
    "gcp_add_secret_version",
    {
      title: "GCP Add Secret Version",
      description:
        "Agrega versión via stdin (HIGH_RISK_WRITE). Nunca loguea ni devuelve el valor. Preferí dryRun.",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (input) => {
      const parsed = z.object(inputSchema).parse(input);
      return withAudit(
        {
          tool: "gcp_add_secret_version",
          action: "add_secret_version",
          project: parsed.projectId,
          dryRun: parsed.dryRun,
          confirmed: Boolean(parsed.confirmation),
          metadata: { secretId: parsed.secretId, valueProvided: true },
        },
        async () => {
          const active = getGoogleCloudProvider(provider);
          const result = await active.addSecretVersion({
            projectId: parsed.projectId,
            environment: parsed.environment,
            secretId: parsed.secretId,
            value: parsed.value,
            dryRun: parsed.dryRun,
            ...(parsed.confirmation ? { confirmation: parsed.confirmation } : {}),
          });
          // Doble seguro: nunca devolver el value
          return jsonResult(result, "Add secret version");
        },
      );
    },
  );
}

export function registerSecretManagerTools(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  registerGcpListSecretsTool(server, provider);
  registerGcpGetSecretMetadataTool(server, provider);
  registerGcpPlanSecretTool(server, provider);
  registerGcpCreateSecretTool(server, provider);
  registerGcpAddSecretVersionTool(server, provider);
}
