/**
 * Invitación al consentimiento de Split 1:N **en producción**.
 *
 * Es la contraparte de `smoke-split-consent-sandbox.ts`, que fuerza `x-test-status` y por
 * eso nunca puede usarse acá: en producción el estado lo decide el receptor aceptando en
 * Mercado Pago. Lo único que puede hacer la plataforma es mandar la invitación y después
 * consultar el estado.
 *
 * Deliberadamente es un comando y no una pantalla: así no queda ninguna superficie
 * desplegada capaz de invitar en producción mientras esto sea una operación puntual.
 *
 * Cuatro frenos, y los cuatro hacen falta:
 *   1. `--confirm` — sin eso no sale ninguna petición.
 *   2. `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED` — el gate del adaptador.
 *   3. `allowProductionWrites` en la config — el gate del cliente HTTP, que es otro.
 *   4. La cuenta del token tiene que ser real, no un usuario de prueba.
 *
 * El 3 es el que se olvida: el adaptador puede autorizar la escritura y el cliente HTTP
 * rechazarla igual. Ver `mercado-pago-http-client.ts` (`WRITE_METHODS`).
 *
 * El 4 nació de un error real: el 2026-11-02 esta invitación falló con 403 porque el token
 * era de un usuario de prueba. El prefijo `APP_USR-` no los distingue, así que ahora se le
 * pregunta a Mercado Pago de quién es la cuenta antes de escribir. Ver `live-account-guard.ts`.
 *
 * Imprime el `inviteUrl` entero a propósito: es lo que hay que hacerle llegar al receptor.
 * No es una credencial — para aceptar, la persona tiene que entrar a su propia cuenta de
 * Mercado Pago. El token de la plataforma nunca se imprime.
 *
 * Uso:
 *   DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED=true \
 *   pnpm --filter @repo/payments exec tsx src/cli/prod-split-consent-invite.ts -- \
 *     --email=alguien@ejemplo.com --confirm
 */
import { randomUUID } from "node:crypto";
import {
  assertLiveCollectorAccount,
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoSplitConsentAdapter,
} from "../index.js";
import { isSplitConsentProductionEnabled } from "../providers/mercado-pago/split-consent/production-flag.js";

const TOKEN_ENV_CANDIDATES = [
  "DNX_MP_PLATFORM_ACCESS_TOKEN",
  "MP_ACCESS_TOKEN",
  "MERCADOPAGO_ACCESS_TOKEN",
] as const;

function sanitize(msg: string): string {
  return msg
    .replace(/APP_USR-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/TEST-[A-Za-z0-9_-]+/g, "[REDACTED]");
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function parseEmails(argv: string[]): string[] {
  const out: string[] = [];
  for (const arg of argv) {
    if (!arg.startsWith("--email=")) continue;
    const value = arg.slice("--email=".length).trim().toLowerCase();
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

/** Token de la plataforma cobradora. Devuelve el nombre de la variable, no el valor. */
function resolveToken(
  env: NodeJS.ProcessEnv,
): { ok: true; token: string; source: string } | { ok: false; reason: string } {
  for (const name of TOKEN_ENV_CANDIDATES) {
    const value = env[name]?.trim();
    if (!value) continue;
    if (value.startsWith("TEST-")) {
      return {
        ok: false,
        reason: `${name} es un token de prueba (TEST-). En producción hace falta el token productivo.`,
      };
    }
    return { ok: true, token: value, source: name };
  }
  return {
    ok: false,
    reason: `Falta el token de la plataforma. Probá una de: ${TOKEN_ENV_CANDIDATES.join(", ")}`,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const confirm = argv.includes("--confirm");
  const emails = parseEmails(argv);

  if (emails.length === 0) {
    console.log(
      JSON.stringify(
        {
          step: "prod_split_consent_invite",
          status: "SIN_EMAILS",
          message: "Pasá al menos un --email=<correo de la cuenta de Mercado Pago>",
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }

  const invalidos = emails.filter((e) => !emailValido(e));
  if (invalidos.length > 0) {
    console.log(
      JSON.stringify(
        { step: "prod_split_consent_invite", status: "EMAIL_INVALIDO", invalidos },
        null,
        2,
      ),
    );
    process.exitCode = 2;
    return;
  }

  if (!isSplitConsentProductionEnabled()) {
    console.log(
      JSON.stringify(
        {
          step: "prod_split_consent_invite",
          status: "FLAG_APAGADA",
          message:
            "DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED no está encendida. Encendela solo para esta corrida.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 3;
    return;
  }

  const tokenResult = resolveToken(process.env);
  if (!tokenResult.ok) {
    console.log(
      JSON.stringify(
        { step: "prod_split_consent_invite", status: "SIN_TOKEN", message: tokenResult.reason },
        null,
        2,
      ),
    );
    process.exitCode = 3;
    return;
  }

  // La identidad de la cuenta se consulta siempre, también en el ensayo: es una lectura, y
  // es lo único que distingue una credencial productiva de un usuario de prueba. Así el
  // ensayo pasa a ser útil de verdad: dice de quién es el token antes de tocar nada.
  let identity;
  try {
    identity = await assertLiveCollectorAccount(
      new MercadoPagoHttpClient(
        createMercadoPagoProviderConfig({
          environment: "production",
          accessToken: tokenResult.token,
        }),
      ),
    );
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    console.log(
      JSON.stringify(
        {
          step: "prod_split_consent_invite",
          status: "CUENTA_RECHAZADA",
          tokenSource: tokenResult.source,
          errorCode: e.code ?? "ERROR",
          message: sanitize(String(e.message ?? err)),
        },
        null,
        2,
      ),
    );
    process.exitCode = 3;
    return;
  }

  const cuenta = {
    id: identity.id,
    apodo: identity.nickname,
    correo: identity.email,
  };

  if (!confirm) {
    console.log(
      JSON.stringify(
        {
          step: "prod_split_consent_invite",
          status: "DRY_RUN",
          environment: "production",
          tokenSource: tokenResult.source,
          cuenta,
          emails,
          message: "Repetí con --confirm para enviar las invitaciones de verdad.",
        },
        null,
        2,
      ),
    );
    return;
  }

  // `allowProductionWrites` es el segundo gate, el del cliente HTTP. Sin esto el POST
  // falla con MercadoPagoProductionWriteBlockedError aunque la flag esté encendida.
  const config = createMercadoPagoProviderConfig({
    environment: "production",
    accessToken: tokenResult.token,
    allowProductionWrites: true,
  });
  const http = new MercadoPagoHttpClient(config);
  const adapter = new MercadoPagoSplitConsentAdapter({ config, httpClient: http });

  const report: Record<string, unknown> = {
    step: "prod_split_consent_invite",
    environment: "production",
    tokenSource: tokenResult.source,
    cuenta,
  };

  try {
    // Reusar lo que ya exista evita invitaciones duplicadas a alguien que ya consintió.
    const existentes = await adapter.list({ environment: "production" });
    const porEmail = new Map(
      existentes.map((c) => [c.sellerEmail.toLowerCase(), c] as const),
    );

    const yaActivos = emails.filter((e) => porEmail.get(e)?.status === "ACTIVE");
    const aInvitar = emails.filter((e) => porEmail.get(e)?.status !== "ACTIVE");

    report.yaActivos = yaActivos.map((email) => ({
      email,
      receiverId: porEmail.get(email)?.receiverId ?? null,
      status: "ACTIVE",
    }));

    if (aInvitar.length > 0) {
      const creados = await adapter.invite({
        environment: "production",
        sellerEmails: aInvitar,
        idempotencyKey: randomUUID(),
      });
      report.invitados = creados.map((c) => ({
        email: c.sellerEmail,
        receiverId: c.receiverId,
        status: c.status,
        inviteUrl: c.inviteUrl ?? null,
      }));
      const sinRespuesta = aInvitar.filter(
        (e) => !creados.some((c) => c.sellerEmail.toLowerCase() === e),
      );
      if (sinRespuesta.length > 0) {
        // 207 parcial: Mercado Pago aceptó algunos y rechazó otros.
        report.rechazados = sinRespuesta;
      }
    } else {
      report.invitados = [];
    }

    const pendientes = (report.invitados as Array<{ status: string }>).filter(
      (c) => c.status !== "ACTIVE",
    ).length;
    report.resumen = {
      pedidos: emails.length,
      yaActivos: yaActivos.length,
      pendientesDeAceptar: pendientes,
      rechazados: Array.isArray(report.rechazados) ? report.rechazados.length : 0,
    };
    report.siguientePaso =
      pendientes > 0
        ? "Pasale el inviteUrl a cada receptor. El consentimiento se otorga en Mercado Pago, no acá."
        : "Nada pendiente.";

    console.log(JSON.stringify(report, null, 2));
    process.exitCode = Array.isArray(report.rechazados) ? 1 : 0;
  } catch (err: unknown) {
    const e = err as {
      message?: string;
      name?: string;
      code?: string;
      statusCode?: number;
    };
    // El código HTTP distingue dos causas que se parecen y se arreglan distinto: 401 es
    // credencial mala, 403 es credencial buena sin permiso para esta operación. Sin el
    // número, "Operation not allowed" no dice cuál de las dos es.
    console.log(
      JSON.stringify(
        {
          ...report,
          status: "FALLO",
          errorCode: e.code ?? e.name ?? "ERROR",
          httpStatus: e.statusCode ?? null,
          errorMessage: sanitize(String(e.message ?? err)),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(
    JSON.stringify({
      step: "prod_split_consent_invite",
      status: "FALLO",
      error: sanitize(err instanceof Error ? err.message : String(err)),
    }),
  );
  process.exitCode = 1;
});
