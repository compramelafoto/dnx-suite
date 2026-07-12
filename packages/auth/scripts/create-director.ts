/**
 * CLI: bootstrap del primer Director de Info Spot (DNX Identity).
 *
 * Uso desde la raíz del monorepo:
 *   pnpm dnx:create-director
 *
 * No interactivo (opcional):
 *   DNX_DIRECTOR_NAME=… DNX_DIRECTOR_EMAIL=… [DNX_DIRECTOR_PASSWORD=…] pnpm dnx:create-director
 *
 * Si el User ya existe y no pasás contraseña, se conserva la actual.
 * Nunca modifica User.role (p. ej. SUPER_ADMIN).
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(__dirname, "../../..");

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(resolve(monorepoRoot, "packages/db/.env"));
loadEnvFile(resolve(monorepoRoot, "apps/infospot/.env.local"));
loadEnvFile(resolve(monorepoRoot, "apps/infospot/.env"));
loadEnvFile(resolve(monorepoRoot, ".env"));

async function promptHidden(rl: ReturnType<typeof createInterface>, label: string): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return (await rl.question(label)).trim();
  }

  output.write(label);
  return new Promise((resolvePrompt, reject) => {
    let value = "";
    const onData = (chunk: Buffer) => {
      const str = chunk.toString("utf8");
      for (const ch of str) {
        if (ch === "\n" || ch === "\r") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          output.write("\n");
          resolvePrompt(value);
          return;
        }
        if (ch === "\u0003") {
          input.setRawMode(false);
          input.pause();
          input.off("data", onData);
          reject(new Error("Cancelado."));
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };
    input.resume();
    input.setRawMode(true);
    input.on("data", onData);
  });
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL no está configurada. Definila en packages/db/.env o apps/infospot/.env.local.",
    );
  }

  const { bootstrapInfoSpotDirector } = await import("../src/bootstrap-director.js");
  const { prisma } = await import("../src/prisma.js");

  const envName = process.env.DNX_DIRECTOR_NAME?.trim();
  const envEmail = process.env.DNX_DIRECTOR_EMAIL?.trim();
  const nonInteractive = Boolean(envName && envEmail);
  // En modo no interactivo: sin DNX_DIRECTOR_PASSWORD → conservar la actual.
  const envPasswordProvided = Object.prototype.hasOwnProperty.call(
    process.env,
    "DNX_DIRECTOR_PASSWORD",
  );

  let name = envName ?? "";
  let email = envEmail ?? "";
  let password: string | undefined = envPasswordProvided
    ? process.env.DNX_DIRECTOR_PASSWORD
    : undefined;

  const rl = createInterface({ input, output });

  try {
    output.write("\nDNX Identity — Director de Info Spot\n");
    output.write(
      "(preserva User.role; asigna InfoSpotUserRole INFOSPOT_DIRECTOR)\n\n",
    );

    if (!name) name = (await rl.question("Nombre: ")).trim();
    if (!email) email = (await rl.question("Email: ")).trim();

    if (!nonInteractive && !envPasswordProvided) {
      const existing = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true, role: true },
      });
      if (existing) {
        output.write(
          `Usuario existente id=${existing.id} (suite role: ${existing.role}).\n`,
        );
        output.write(
          "Dejá la contraseña vacía para conservarla, o ingresá una nueva (≥ 8).\n",
        );
        const pwd = await promptHidden(rl, "Contraseña (opcional): ");
        if (pwd) {
          const confirm = await promptHidden(rl, "Confirmar contraseña: ");
          if (pwd !== confirm) throw new Error("Las contraseñas no coinciden.");
          password = pwd;
        } else {
          password = undefined;
        }
      } else {
        const pwd = await promptHidden(rl, "Contraseña (≥ 8): ");
        const confirm = await promptHidden(rl, "Confirmar contraseña: ");
        if (pwd !== confirm) throw new Error("Las contraseñas no coinciden.");
        password = pwd;
      }
    }

    const result = await bootstrapInfoSpotDirector({
      name,
      email,
      password: password && password.length > 0 ? password : undefined,
    });

    output.write("\nDirector listo.\n");
    output.write(`  userId:              ${result.userId}\n`);
    output.write(`  email:               ${result.email}\n`);
    output.write(`  User.role (suite):   ${result.suiteRole} (preservado)\n`);
    output.write(
      `  User:                ${result.userCreated ? "creado" : "reutilizado"}\n`,
    );
    output.write(
      `  nombre actualizado:  ${result.nameUpdated ? "sí" : "no"}\n`,
    );
    output.write(
      `  contraseña:          ${result.passwordUpdated ? "actualizada" : "conservada / ya configurada"}\n`,
    );
    output.write(
      `  InfoSpotUserRole:    ${result.membershipCreated ? "creado" : "actualizado"}\n`,
    );
    output.write(`  app role:            INFOSPOT_DIRECTOR\n`);
    output.write(`  status:              ACTIVE\n`);
    output.write(`  publicationPolicy:   DIRECT_PUBLISH\n`);
    output.write(`  canPublish:          true\n`);
    if (result.activeDirectorsBefore > 0) {
      output.write(
        `\nAviso: ya había ${result.activeDirectorsBefore} Director(es) ACTIVE antes de este comando.\n`,
      );
    }
    output.write("\nIngreso: Info Spot → /ingresar con ese email y contraseña.\n");
    output.write("El flujo de invitaciones (/admin/usuarios) no se modificó.\n\n");
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
