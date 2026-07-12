import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GoogleCloudProvider } from "../../providers/google-cloud/index.js";
import { googleCloudProvider } from "../../providers/google-cloud/index.js";
import { jsonResult, withAudit } from "../shared/index.js";
import { getGoogleCloudProvider } from "./context.js";
import { gcpDryRunSchema } from "./schemas.js";

const dryOnly = { dryRun: gcpDryRunSchema };

export function registerGcpCheckInstallationTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  server.registerTool(
    "gcp_check_installation",
    {
      title: "GCP Check Installation",
      description: "Comprueba si gcloud está instalado y reporta versión (read-only).",
      inputSchema: dryOnly,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(dryOnly).parse(input);
      return withAudit(
        { tool: "gcp_check_installation", action: "check_installation", dryRun: parsed.dryRun, confirmed: false },
        async () => {
          const active = getGoogleCloudProvider(provider);
          if (parsed.dryRun) {
            return jsonResult(
              { success: true, changed: false, dryRun: true, riskLevel: "READ_ONLY", preview: { wouldFetch: ["version", "which"] } },
              "Preview instalación gcloud",
            );
          }
          return jsonResult(await active.checkInstallation(), "Instalación gcloud");
        },
      );
    },
  );
}

export function registerGcpGetAuthStatusTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  server.registerTool(
    "gcp_get_auth_status",
    {
      title: "GCP Auth Status",
      description: "Estado de autenticación gcloud (sin tokens).",
      inputSchema: dryOnly,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(dryOnly).parse(input);
      return withAudit(
        { tool: "gcp_get_auth_status", action: "auth_status", dryRun: parsed.dryRun, confirmed: false },
        async () => {
          const active = getGoogleCloudProvider(provider);
          if (parsed.dryRun) {
            return jsonResult({ success: true, dryRun: true, riskLevel: "READ_ONLY", preview: { wouldFetch: ["auth.list"] } });
          }
          return jsonResult(await active.getAuthStatus(), "Auth status GCP");
        },
      );
    },
  );
}

export function registerGcpListAccountsTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  server.registerTool(
    "gcp_list_accounts",
    {
      title: "GCP List Accounts",
      description: "Lista cuentas gcloud (email + status, sin credenciales).",
      inputSchema: dryOnly,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(dryOnly).parse(input);
      return withAudit(
        { tool: "gcp_list_accounts", action: "list_accounts", dryRun: parsed.dryRun, confirmed: false },
        async () => {
          const active = getGoogleCloudProvider(provider);
          if (parsed.dryRun) {
            return jsonResult({ success: true, dryRun: true, riskLevel: "READ_ONLY", preview: { wouldFetch: ["auth.list"] } });
          }
          return jsonResult(await active.listAccounts(), "Cuentas gcloud");
        },
      );
    },
  );
}

export function registerGcpGetActiveAccountTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  server.registerTool(
    "gcp_get_active_account",
    {
      title: "GCP Active Account",
      description: "Cuenta activa de gcloud config.",
      inputSchema: dryOnly,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(dryOnly).parse(input);
      return withAudit(
        { tool: "gcp_get_active_account", action: "get_active_account", dryRun: parsed.dryRun, confirmed: false },
        async () => {
          const active = getGoogleCloudProvider(provider);
          if (parsed.dryRun) {
            return jsonResult({ success: true, dryRun: true, riskLevel: "READ_ONLY", preview: { wouldFetch: ["config.get core/account"] } });
          }
          return jsonResult(await active.getActiveAccount(), "Cuenta activa");
        },
      );
    },
  );
}

export function registerGcpRunDoctorTool(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  server.registerTool(
    "gcp_run_doctor",
    {
      title: "GCP Doctor",
      description: "Diagnóstico read-only del módulo Google Cloud (instalación, auth, flags).",
      inputSchema: dryOnly,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => {
      const parsed = z.object(dryOnly).parse(input);
      return withAudit(
        { tool: "gcp_run_doctor", action: "doctor", dryRun: parsed.dryRun, confirmed: false },
        async () => {
          const active = getGoogleCloudProvider(provider);
          if (parsed.dryRun) {
            return jsonResult({
              success: true,
              dryRun: true,
              riskLevel: "READ_ONLY",
              preview: { wouldFetch: ["version", "auth", "config", "module flags"] },
            });
          }
          return jsonResult(await active.runDoctor(), "GCP Doctor");
        },
      );
    },
  );
}

export function registerDiagnosticTools(
  server: McpServer,
  provider: GoogleCloudProvider = googleCloudProvider,
): void {
  registerGcpCheckInstallationTool(server, provider);
  registerGcpGetAuthStatusTool(server, provider);
  registerGcpListAccountsTool(server, provider);
  registerGcpGetActiveAccountTool(server, provider);
  registerGcpRunDoctorTool(server, provider);
}
