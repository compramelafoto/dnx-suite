import type { VercelProvider } from "../../vercel/index.js";
import type { VercelPreviewEnvPort } from "./prepare-application.js";

/**
 * Adapta VercelProvider al puerto de Preview env para prepareApplication.
 * Solo target `preview` — nunca production.
 */
export function createVercelPreviewEnvPort(vercel: VercelProvider): VercelPreviewEnvPort {
  return {
    isConfigured: () => vercel.isConfigured(),
    async listPreviewEnvKeys(projectIdOrName: string): Promise<string[]> {
      vercel.assertConfigured();
      const envs = await vercel.envVars.list(projectIdOrName);
      const keys = new Set<string>();
      for (const env of envs) {
        if (env.target?.includes("preview")) {
          keys.add(env.key);
        }
      }
      return [...keys];
    },
    async createPreviewEnvVar(
      projectIdOrName: string,
      key: string,
      value: string,
    ): Promise<void> {
      vercel.assertConfigured();
      await vercel.envVars.create(projectIdOrName, {
        key,
        value,
        type: "encrypted",
        target: ["preview"],
      });
    },
  };
}
