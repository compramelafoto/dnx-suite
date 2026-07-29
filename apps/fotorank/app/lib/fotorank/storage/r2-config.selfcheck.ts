/**
 * Valida configuración R2 sin subir objetos ni imprimir secrets.
 * pnpm --filter fotorank run test:storage:r2-config
 */
import { r2PrivateStorageConfigSelfcheck } from "./r2-private-storage";
import { resolvePrivateStorageProviderName } from "./provider";

const result = r2PrivateStorageConfigSelfcheck();
console.log(
  JSON.stringify(
    {
      providerResolved: resolvePrivateStorageProviderName(),
      configured: result.configured,
      ok: result.ok,
      missing: result.missing,
      bucket: result.bucket ?? null,
      endpointHost: result.endpointHost ?? null,
      note: result.configured
        ? "Credenciales presentes — no se realizó upload de prueba."
        : "Sin credenciales: provider local activo (esperado en dev).",
    },
    null,
    2,
  ),
);
console.log("r2-config.selfcheck.ts OK");
