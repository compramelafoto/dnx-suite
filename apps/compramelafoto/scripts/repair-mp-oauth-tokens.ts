/**
 * CLF-MP-OAUTH-REFRESH-100 — audita y renueva los access token OAuth de Mercado Pago.
 *
 * Uso:
 *   npx tsx scripts/repair-mp-oauth-tokens.ts            # solo audita (dry-run)
 *   npx tsx scripts/repair-mp-oauth-tokens.ts --apply    # renueva los vencidos
 *   npx tsx scripts/repair-mp-oauth-tokens.ts --apply --user 195
 *   npx tsx scripts/repair-mp-oauth-tokens.ts --apply --user 813 --force
 *
 * `--force` renueva aunque el access token todavía sirva (control: verifica que el
 * refresh token y las credenciales de la aplicación MP funcionen).
 */
import { loadAnalysisEnv } from "./load-env-for-analysis";
loadAnalysisEnv();

type OwnerType = "USER" | "LAB";

async function tokenIsValid(token: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return { ok: true, detail: "OK" };
    const body: any = await res.json().catch(() => ({}));
    return { ok: false, detail: `${res.status} ${body?.message ?? body?.error ?? ""}`.trim() };
  } catch (err: any) {
    return { ok: false, detail: `NETERR ${err?.message ?? err}` };
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");
  const userArgIndex = process.argv.indexOf("--user");
  const onlyUserId = userArgIndex >= 0 ? Number(process.argv[userArgIndex + 1]) : null;

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { refreshMercadoPagoOwnerAccessToken } = await import(
    "../lib/mercadopago/mp-oauth-token-refresh"
  );

  const summary = { revisados: 0, validos: 0, vencidos: 0, renovados: 0, sinArreglo: 0 };

  try {
    const users = await prisma.user.findMany({
      where: {
        mpAccessToken: { not: null },
        ...(onlyUserId ? { id: onlyUserId } : {}),
      },
      select: { id: true, email: true, mpAccessToken: true, mpRefreshToken: true },
      orderBy: { id: "asc" },
    });
    const labs = onlyUserId
      ? []
      : await prisma.lab.findMany({
          where: { mpAccessToken: { not: null } },
          select: { id: true, name: true, mpAccessToken: true, mpRefreshToken: true },
          orderBy: { id: "asc" },
        });

    const owners: Array<{ type: OwnerType; id: number; label: string; token: string }> = [
      ...users.map((u) => ({
        type: "USER" as OwnerType,
        id: u.id,
        label: u.email ?? `user ${u.id}`,
        token: u.mpAccessToken as string,
      })),
      ...labs.map((l) => ({
        type: "LAB" as OwnerType,
        id: l.id,
        label: `lab ${l.name}`,
        token: l.mpAccessToken as string,
      })),
    ];

    for (const owner of owners) {
      summary.revisados++;
      const check = await tokenIsValid(owner.token);
      if (check.ok) {
        summary.validos++;
        if (!force) continue;
        console.log(`FORCE ${owner.type} ${owner.id} (${owner.label}): token válido, se renueva igual`);
      } else {
        summary.vencidos++;
      }
      if (!check.ok) {
        console.log(`VENCIDO ${owner.type} ${owner.id} (${owner.label}): ${check.detail}`);
      }
      if (!apply) continue;

      const result = await refreshMercadoPagoOwnerAccessToken({
        ownerType: owner.type,
        ownerId: owner.id,
      });
      if (!result.ok) {
        summary.sinArreglo++;
        console.log(`  -> NO SE PUDO RENOVAR (${result.code}): ${result.error}`);
        continue;
      }
      const recheck = await tokenIsValid(result.accessToken);
      if (recheck.ok) {
        summary.renovados++;
        console.log("  -> RENOVADO y verificado contra Mercado Pago");
      } else {
        summary.sinArreglo++;
        console.log(`  -> renovado pero sigue fallando: ${recheck.detail}`);
      }
    }

    console.log("\nRESUMEN", summary);
    if (!apply) {
      console.log("Modo dry-run. Volvé a correrlo con --apply para renovar los tokens vencidos.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
