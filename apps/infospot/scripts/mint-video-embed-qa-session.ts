/**
 * Emite una sesión temporal de Director en staging para QA local.
 * No cambia contraseñas ni roles. Escribe cookie en .qa-artifacts (gitignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@repo/db";
import { createUserSession, DNX_SESSION_COOKIE } from "@repo/auth";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../.qa-artifacts");

const host = process.env.DATABASE_URL ?? "";
if (/bitter-salad/i.test(host)) {
  console.error("Abortado: DATABASE_URL parece Production.");
  process.exit(1);
}

const director = await prisma.infoSpotUserRole.findFirst({
  where: { role: "INFOSPOT_DIRECTOR", status: "ACTIVE" },
  orderBy: { createdAt: "asc" },
  select: {
    userId: true,
    user: { select: { id: true, email: true, name: true, isBlocked: true } },
  },
});

if (!director || director.user.isBlocked) {
  console.error("No hay INFOSPOT_DIRECTOR ACTIVE.");
  process.exit(1);
}

const session = await createUserSession(director.userId, { rememberMe: true });
mkdirSync(outDir, { recursive: true });
const artifact = {
  cookieName: DNX_SESSION_COOKIE,
  userId: director.user.id,
  email: director.user.email,
  name: director.user.name,
  createdAt: new Date().toISOString(),
  purpose: "video-embed-live-qa",
};
writeFileSync(resolve(outDir, "video-embed-qa-session.json"), JSON.stringify({ ...artifact, rawToken: session.rawToken }, null, 2));
writeFileSync(
  resolve(outDir, "video-embed-qa-identity.json"),
  JSON.stringify(artifact, null, 2),
);
console.log(`QA session for userId=${director.user.id} email=${director.user.email}`);
