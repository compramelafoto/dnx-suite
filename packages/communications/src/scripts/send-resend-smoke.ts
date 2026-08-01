/**
 * Smoke controlado Resend — un solo destinatario, allowlist + doble confirmación.
 *
 * Dry run (default):
 *   pnpm --filter @repo/communications smoke:resend -- \
 *     --to test@example.com --template system.test --brand clickaton
 *
 * Live (manual):
 *   COMMUNICATIONS_LIVE_SEND=true pnpm --filter @repo/communications smoke:resend -- \
 *     --to AUTORIZADO --template system.test --brand clickaton --confirm-live-send
 *
 * No imprime HTML, API keys ni allowlist.
 */
import { createCommunicationsFacade } from "../communications";
import {
  createResendEmailRuntime,
  createSmokeIdempotencyKey,
  isBasicEmailFormat,
  maskEmail,
  maskIdempotencyKey,
  normalizeEmailAddress,
} from "../email/runtime/index";
import { loadCommunicationsEnvFiles } from "./load-env";

type CliArgs = {
  to?: string;
  template: "system.test" | "user.welcome";
  brand: "dnx" | "clickaton" | "compramelafoto";
  confirmLiveSend: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    template: "system.test",
    brand: "dnx",
    confirmLiveSend: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--confirm-live-send") {
      args.confirmLiveSend = true;
      continue;
    }
    if (token === "--to") {
      args.to = argv[++i];
      continue;
    }
    if (token === "--template") {
      const value = argv[++i];
      if (value === "system.test" || value === "user.welcome") {
        args.template = value;
      } else {
        throw new Error(`Template no soportado: ${value}`);
      }
      continue;
    }
    if (token === "--brand") {
      const value = argv[++i];
      if (value === "dnx" || value === "clickaton" || value === "compramelafoto") {
        args.brand = value;
      } else {
        throw new Error(`Brand no soportado: ${value}`);
      }
      continue;
    }
    throw new Error(`Argumento desconocido: ${token}`);
  }
  return args;
}

function printHelp(): void {
  console.log(`Uso:
  pnpm --filter @repo/communications smoke:resend -- \\
    --to test@example.com --template system.test --brand clickaton

Live (requiere env + allowlist + --confirm-live-send):
  COMMUNICATIONS_LIVE_SEND=true pnpm --filter @repo/communications smoke:resend -- \\
    --to AUTORIZADO --template system.test --brand clickaton --confirm-live-send

Variables: RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME,
           RESEND_ALLOWED_RECIPIENTS, COMMUNICATIONS_LIVE_SEND`);
}

async function main(): Promise<void> {
  // pnpm a veces reenvía "--" como argumento literal.
  const argv = process.argv.slice(2).filter((token) => token !== "--");
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.to || !isBasicEmailFormat(normalizeEmailAddress(args.to))) {
    console.error("ERROR: --to requiere un email válido (un solo destinatario).");
    process.exitCode = 1;
    return;
  }

  const loadedEnvFiles = loadCommunicationsEnvFiles();
  const to = normalizeEmailAddress(args.to);
  const runtime = createResendEmailRuntime({
    env: process.env,
    confirmLiveSend: args.confirmLiveSend,
  });

  const facade = createCommunicationsFacade();
  facade.registerProvider("email", runtime.provider);

  const testId = createSmokeIdempotencyKey("smoke");
  const generatedAt = new Date().toISOString();

  const renderData =
    args.template === "system.test"
      ? {
          recipientName: "Usuario de prueba",
          message:
            "Prueba técnica controlada de DNX Communications. No requiere acción.",
          generatedAt,
          testId: maskIdempotencyKey(testId),
          environment: runtime.environment,
        }
      : {
          recipientName: "Usuario de prueba",
          platformName:
            args.brand === "clickaton"
              ? "Clickatón"
              : args.brand === "compramelafoto"
                ? "ComprameLaFoto"
                : "DNX Suite",
        };

  const rendered = await facade.render({
    templateId: args.template,
    brandId: args.brand,
    locale: "es-AR",
    data: renderData,
  });

  if (!rendered.ok) {
    console.error("RENDER_FAILED", rendered.errorCode, rendered.errorMessage);
    process.exitCode = 1;
    return;
  }

  const recipientSummary = runtime.summarizeRecipient(to);

  console.log("=== DNX Communications — Resend smoke ===");
  console.log("mode:", runtime.canLiveSend ? "LIVE" : "DRY_RUN");
  console.log("environment:", runtime.environment);
  console.log("template:", args.template);
  console.log("brand:", args.brand);
  console.log("provider: resend");
  console.log("to:", recipientSummary.masked);
  console.log("toDomain:", recipientSummary.domain ?? "n/a");
  console.log("recipientAllowed:", recipientSummary.allowed);
  console.log("allowedRecipientCount:", runtime.allowedRecipientCount);
  console.log("confirmLiveSend:", args.confirmLiveSend);
  console.log("liveSendFlag:", runtime.config?.liveSendEnabled ?? false);
  console.log("fromConfigured:", Boolean(runtime.from));
  console.log("configOk:", Boolean(runtime.config));
  if (runtime.blockCode) {
    console.log("blockCode:", runtime.blockCode);
  }
  console.log("idempotencyKey:", maskIdempotencyKey(testId));
  console.log("subject:", rendered.subject);
  console.log("htmlBytes:", rendered.html?.length ?? 0);
  console.log("textBytes:", rendered.text?.length ?? 0);
  if (loadedEnvFiles.length > 0) {
    console.log("envFilesLoaded:", loadedEnvFiles.length);
  }

  if (!runtime.from) {
    console.log("RESULT skipped — remitente/config incompleta");
    console.log("errorCode:", runtime.configErrorCode ?? "RESEND_CONFIGURATION_MISSING");
    process.exitCode = runtime.canLiveSend ? 1 : 0;
    return;
  }

  const result = await facade.send({
    channel: "email",
    to: [{ email: to }],
    from: {
      email: runtime.from.email,
      name: runtime.from.name,
    },
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: testId,
    metadata: {
      templateId: args.template,
      brandId: args.brand,
      smoke: true,
    },
  });

  console.log("=== CommunicationResult ===");
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        status: result.status,
        channel: result.channel,
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        communicationId: result.communicationId,
        dryRun: result.dryRun,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        to: maskEmail(to),
      },
      null,
      2,
    ),
  );

  if (result.status === "failed") {
    process.exitCode = 1;
    return;
  }

  // skipped por protecciones → exit 0 en dry-run; exit 1 si se pidió live y falló gate
  if (result.status === "skipped" && args.confirmLiveSend && !result.ok) {
    if (result.errorCode === "RECIPIENT_NOT_ALLOWED") {
      process.exitCode = 1;
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
