/**
 * Runtime guard: Preview no puede arrancar contra DB Production (y viceversa).
 * ETAPA 11B — falla el bootstrap si la identidad DB no coincide con VERCEL_ENV.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { assertEnvironmentDatabaseIdentity } = await import(
    "./app/lib/fotorank/db/environment-db-guard"
  );
  const result = assertEnvironmentDatabaseIdentity();
  if (!result.ok) {
    // Log sin secretos; aborta el proceso Node en Preview/Production mal configurado.
    console.error("[fotorank.db-guard] ABORT", {
      reason: result.reason,
      vercelEnv: result.vercelEnv,
      hostHint: result.hostHint,
    });
    if (result.vercelEnv === "preview" || result.vercelEnv === "production") {
      throw new Error(
        `ABORT DB identity: ${result.reason} (VERCEL_ENV=${result.vercelEnv} hostHint=${result.hostHint ?? "—"})`,
      );
    }
  } else if (result.vercelEnv === "preview" || result.vercelEnv === "production") {
    console.info("[fotorank.db-guard] OK", {
      vercelEnv: result.vercelEnv,
      hostHint: result.hostHint,
    });
  }
}
