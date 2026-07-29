/**
 * Fixtures cross-app 1–6 contra DNX Staging Identity.
 * No imprime secretos.
 *
 *   DNX_IDENTITY_DATABASE_URL=… pnpm auth:cross-app:fixtures
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/prisma";
import {
  createOpaqueToken,
  findUserByIdentity,
  requireNormalizedIdentityEmail,
  registerDnxAccount,
  resetPasswordWithToken,
  resolveOrCreateUser,
  resolveOrLinkGoogleUser,
  verifyUserPassword,
} from "../src/index";

function loadCutoverEnv() {
  const path = join(import.meta.dirname, "../../db/.env.cutover.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
  if (process.env.DNX_IDENTITY_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.DNX_IDENTITY_DATABASE_URL;
    process.env.DIRECT_URL =
      process.env.DNX_IDENTITY_DIRECT_URL || process.env.DNX_IDENTITY_DATABASE_URL;
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  loadCutoverEnv();
  assert(process.env.DATABASE_URL, "DATABASE_URL / DNX_IDENTITY_DATABASE_URL required");

  const stamp = Date.now().toString(36);
  const results: Array<{ fixture: number; ok: boolean; userId?: number; detail: string }> = [];

  // 1 — seed histórico ComprameLaFoto monorepo
  const clf = await prisma.user.findFirst({
    where: { email: { endsWith: "@clf.dnx.test" } },
    orderBy: { id: "asc" },
  });
  results.push(
    clf
      ? {
          fixture: 1,
          ok: true,
          userId: clf.id,
          detail: "seed @clf.dnx.test presente en identidad compartida",
        }
      : { fixture: 1, ok: false, detail: "faltan seeds @clf.dnx.test" },
  );

  // 2 — registro desde Clickatón
  const email2 = requireNormalizedIdentityEmail(`fx2.clickaton.${stamp}@dnx.fixture.test`);
  const pass2 = `Fx2-${stamp}-Aa1!`;
  const reg2 = await registerDnxAccount({
    email: email2,
    password: pass2,
    passwordConfirm: pass2,
    name: "Fixture Two",
    sourceApplication: "clickaton",
    appBaseUrl: "https://clickaton-staging.vercel.app",
    acceptedTerms: true,
    acceptedPrivacy: true,
    sendVerification: false,
  });
  assert(reg2.ok, `fx2 register: ${!reg2.ok ? reg2.message : ""}`);
  const login2a = await verifyUserPassword({ email: email2, password: pass2 });
  const login2b = await verifyUserPassword({ email: email2, password: pass2 });
  assert(login2a.ok && login2b.ok && login2a.user.id === login2b.user.id, "fx2 same id");
  results.push({
    fixture: 2,
    ok: true,
    userId: login2a.user.id,
    detail: "register clickaton → verify password same User.id",
  });

  // 3 — registro desde FotoRank
  const email3 = requireNormalizedIdentityEmail(`fx3.fotorank.${stamp}@dnx.fixture.test`);
  const pass3 = `Fx3-${stamp}-Bb2!`;
  const reg3 = await registerDnxAccount({
    email: email3,
    password: pass3,
    passwordConfirm: pass3,
    name: "Fixture Three",
    sourceApplication: "fotorank",
    appBaseUrl: "https://fotorank.staging.dnxsuite.com",
    acceptedTerms: true,
    acceptedPrivacy: true,
    sendVerification: false,
  });
  assert(reg3.ok, "fx3 register");
  const login3 = await verifyUserPassword({ email: email3, password: pass3 });
  assert(login3.ok, "fx3 login");
  const found3 = await findUserByIdentity({ type: "email", email: email3 });
  assert(found3?.id === login3.user.id, "fx3 identity lookup");
  results.push({
    fixture: 3,
    ok: true,
    userId: login3.user.id,
    detail: "register fotorank → login shared identity",
  });

  // 4 — forgot/reset desde Clickatón sobre user fixture 2
  const pass4 = `Fx4-${stamp}-Cc3!`;
  const { rawToken, tokenHash } = createOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: login2a.user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const reset = await resetPasswordWithToken({
    rawToken,
    newPassword: pass4,
    passwordConfirm: pass4,
  });
  const login4 = await verifyUserPassword({ email: email2, password: pass4 });
  assert(login4.ok && login4.user.id === reset.userId, "fx4 reset id");
  results.push({
    fixture: 4,
    ok: true,
    userId: reset.userId,
    detail: "reset password → same User.id cross-app",
  });

  // 5 — Google sobre cuenta email existente
  const email5 = requireNormalizedIdentityEmail(`fx5.google.${stamp}@dnx.fixture.test`);
  const pass5 = `Fx5-${stamp}-Dd4!`;
  const reg5 = await registerDnxAccount({
    email: email5,
    password: pass5,
    passwordConfirm: pass5,
    name: "Fixture Five",
    sourceApplication: "compramelafoto",
    appBaseUrl: "https://example.com",
    acceptedTerms: true,
    acceptedPrivacy: true,
    sendVerification: false,
  });
  assert(reg5.ok, "fx5 register");
  const googleId = `google-fx5-${stamp}`;
  const linked = await resolveOrLinkGoogleUser({
    google: {
      id: googleId,
      email: email5,
      name: "Fixture Five",
      picture: null,
      verifiedEmail: true,
    },
  });
  const linked2 = await resolveOrLinkGoogleUser({
    google: {
      id: googleId,
      email: email5,
      name: "Fixture Five",
      picture: null,
      verifiedEmail: true,
    },
  });
  assert(linked.userId === linked2.userId, "fx5 no duplicate");
  assert(reg5.ok && linked.userId === reg5.user.id, "fx5 same as email user");
  results.push({
    fixture: 5,
    ok: true,
    userId: linked.userId,
    detail: "email+password + Google → single User.id",
  });

  // 6 — Google-only → crear contraseña → login email
  const email6 = requireNormalizedIdentityEmail(`fx6.gonly.${stamp}@dnx.fixture.test`);
  const gOnly = await resolveOrCreateUser({
    email: email6,
    googleId: `google-only-${stamp}`,
    name: "Fixture Six",
    createRole: "CUSTOMER",
    sourceApplication: "fotoffice",
    markEmailVerified: true,
  });
  const pass6 = `Fx6-${stamp}-Ee5!`;
  const tok6 = createOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: gOnly.user.id,
      tokenHash: tok6.tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const setPass = await resetPasswordWithToken({
    rawToken: tok6.rawToken,
    newPassword: pass6,
    passwordConfirm: pass6,
  });
  const login6 = await verifyUserPassword({ email: email6, password: pass6 });
  assert(login6.ok && login6.user.id === setPass.userId && login6.user.id === gOnly.user.id, "fx6");
  results.push({
    fixture: 6,
    ok: true,
    userId: gOnly.user.id,
    detail: "google-only → set password → login email same id",
  });

  console.log("=== cross-app identity fixtures ===");
  for (const r of results) console.log(JSON.stringify(r));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`FAILED ${failed.length}/${results.length}`);
    process.exit(1);
  }
  console.log("ALL FIXTURES PASS");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
