/**
 * Semántica Vercel Ignored Build Step:
 * - exit 0 → cancelar / no construir
 * - exit 1 → continuar build
 *
 * Fuente: https://vercel.com/docs/project-configuration/git-settings#ignored-build-step
 */
export type IgnoreDecision = "skip_build" | "continue_build";

export function decideProductionIgnoreBuild(
  gitRef: string | undefined,
  productionBranch = "main",
): IgnoreDecision {
  const ref = (gitRef ?? "").trim();
  if (!ref) return "skip_build";
  return ref === productionBranch ? "continue_build" : "skip_build";
}

/** Comando canónico a configurar en clickaton-dnxsuite. */
export const CLICKATON_PRODUCTION_IGNORE_BUILD_COMMAND =
  'if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; else exit 0; fi';

/** Comando histórico incorrecto (Imp10): solo ignoraba clickaton-staging. */
export const CLICKATON_PRODUCTION_IGNORE_BUILD_COMMAND_LEGACY_WRONG =
  'if [ "$VERCEL_GIT_COMMIT_REF" = "clickaton-staging" ]; then exit 0; else exit 1; fi';

export function exitCodeForDecision(d: IgnoreDecision): 0 | 1 {
  return d === "skip_build" ? 0 : 1;
}
