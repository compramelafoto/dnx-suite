/**
 * Genera previews HTML locales (sin red, sin envío).
 *
 *   pnpm --filter @repo/communications preview:email
 *
 * Salida (gitignored):
 *   packages/communications/.tmp/email-previews/
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEmailTemplateEngine } from "../templates/engine";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../.tmp/email-previews");

const jobs = [
  {
    file: "system-test-clickaton.html",
    templateId: "system.test",
    brandId: "clickaton",
    data: {
      recipientName: "Usuario de prueba",
      message: "El sistema funciona correctamente.",
      actionLabel: "Abrir preview",
      actionUrl: "https://example.com/preview",
    },
  },
  {
    file: "system-test-dnx.html",
    templateId: "system.test",
    brandId: "dnx",
    data: {
      recipientName: "Usuario de prueba",
      message: "Preview DNX Suite.",
    },
  },
  {
    file: "system-test-compramelafoto.html",
    templateId: "system.test",
    brandId: "compramelafoto",
    data: {
      recipientName: "Usuario de prueba",
      message: "Preview ComprameLaFoto.",
    },
  },
  {
    file: "user-welcome-dnx.html",
    templateId: "user.welcome",
    brandId: "dnx",
    data: {
      recipientName: "Usuario de prueba",
      platformName: "DNX Suite",
      loginUrl: "https://example.com/login",
    },
  },
  {
    file: "user-welcome-clickaton.html",
    templateId: "user.welcome",
    brandId: "clickaton",
    data: {
      recipientName: "Usuario de prueba",
      platformName: "Clickatón",
      loginUrl: "https://example.com/login",
    },
  },
] as const;

async function main(): Promise<void> {
  const engine = createEmailTemplateEngine();
  await mkdir(outDir, { recursive: true });

  const written: string[] = [];
  for (const job of jobs) {
    const result = await engine.render({
      templateId: job.templateId,
      brandId: job.brandId,
      locale: "es-AR",
      data: job.data,
      allowHttp: false,
    });
    if (!result.ok || !result.html) {
      throw new Error(
        `Preview falló (${job.file}): ${result.errorCode} ${result.errorMessage}`,
      );
    }
    const target = path.join(outDir, job.file);
    await writeFile(target, result.html, "utf8");
    written.push(target);
  }

  console.log(`Previews generados (${written.length}):`);
  for (const file of written) {
    console.log(` - ${file}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
