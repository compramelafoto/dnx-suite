/**
 * Integración live opt-in — NO corre en `pnpm test` / CI / pre-commit.
 *
 *   pnpm --filter @repo/communications test:resend-live -- \
 *     --to AUTORIZADO --confirm-live-send
 *
 * Sin config o sin confirmación → SKIPPED (exit 0).
 * Fallo real de proveedor → FAIL (exit 1).
 * Éxito → PASS (exit 0).
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCommunicationsEnvFiles } from "./load-env";

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function readArg(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

function main(): void {
  loadCommunicationsEnvFiles();
  const argv = process.argv.slice(2).filter((token) => token !== "--");
  const confirm = hasFlag(argv, "--confirm-live-send");
  const to = readArg(argv, "--to");
  const env = process.env as Record<string, string | undefined>;
  const live = (env["COMMUNICATIONS_LIVE_SEND"] ?? "").toLowerCase() === "true";
  const hasKey = Boolean(env["RESEND_API_KEY"]?.trim());


  if (!confirm || !live || !hasKey || !to) {
    console.log("SKIPPED: test:resend-live requiere");
    console.log("  - COMMUNICATIONS_LIVE_SEND=true");
    console.log("  - RESEND_API_KEY");
    console.log("  - --to <allowlisted>");
    console.log("  - --confirm-live-send");
    process.exitCode = 0;
    return;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const smoke = resolve(here, "send-resend-smoke.ts");
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      smoke,
      "--to",
      to,
      "--template",
      readArg(argv, "--template") ?? "system.test",
      "--brand",
      readArg(argv, "--brand") ?? "dnx",
      "--confirm-live-send",
    ],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.status === 0) {
    console.log("PASS: resend-live opt-in");
    process.exitCode = 0;
    return;
  }
  console.error("FAIL: resend-live opt-in");
  process.exitCode = result.status ?? 1;
}

main();
