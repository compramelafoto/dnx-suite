/**
 * Etapa 13 — Gate operativo (sin escribir en DB CLF operativa).
 *
 * Valida:
 * - separación de entornos (no escribir en CLF_READONLY)
 * - matriz de políticas OPEN/REQUEST/INVITE/CLOSED/cupos (reglas Info Spot)
 * - licencia editorial
 * - sync inbound dry-run
 * - presencia de cron routes
 *
 * Uso: pnpm --filter infospot smoke:e13-gate
 */
import fs from "node:fs";
import path from "node:path";
import { reconcilePublicClfEvents } from "../clf-event-sync/reconcile";
import {
  isClfEventPublicPhotographerCall,
  availablePhotographerSlots,
} from "../clf-event-sync/import-rules";
import {
  assertProductionLicensePolicy,
  resolveDefaultEditorialLicenseStatus,
} from "../editorial-photos/license-policy";

type Step = { name: string; ok: boolean; detail?: string };

function loadEnvFile(filePath: string) {
  const map: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return map;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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
    if (v) map[k] = v;
  }
  return map;
}

function hostPrefix(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.match(/^ep-[a-z0-9-]+/i)?.[0] ?? null;
  } catch {
    return null;
  }
}

function fingerprintUrl(url: string | undefined) {
  if (!url) return { present: false as const };
  try {
    const u = new URL(url);
    return {
      present: true as const,
      hostPrefix: hostPrefix(url),
      hostTail: u.hostname.split(".").slice(-3).join("."),
    };
  } catch {
    return { present: true as const, hostPrefix: null, hostTail: "opaque" };
  }
}

/** Simula decisión de join público (espejo de route.ts + enroll cupo). */
function simulatePublicJoin(input: {
  status: string;
  visibility: string;
  joinPolicy: string;
  archivedAt: Date | null;
  maxPhotographers: number | null;
  activeCount: number;
  invited: boolean;
  existing: "none" | "ACTIVE" | "PENDING" | "REJECTED";
}): { outcome: string; ok: boolean } {
  if (input.archivedAt) return { ok: false, outcome: "not_found" };
  if (input.status === "CLOSED") return { ok: false, outcome: "closed" };
  const privateOrInvite =
    input.visibility === "PRIVATE" || input.joinPolicy === "INVITE_ONLY";
  if (privateOrInvite && !input.invited) {
    return { ok: false, outcome: "not_invited" };
  }
  if (input.existing === "ACTIVE") return { ok: true, outcome: "already_active" };
  if (input.existing === "PENDING" && input.joinPolicy === "REQUEST") {
    return { ok: true, outcome: "already_pending" };
  }
  if (input.existing === "REJECTED" && input.joinPolicy !== "REQUEST") {
    return { ok: false, outcome: "rejected" };
  }
  if (input.joinPolicy === "REQUEST" && !privateOrInvite) {
    return { ok: true, outcome: "request_pending" };
  }
  if (
    input.maxPhotographers != null &&
    input.activeCount >= input.maxPhotographers
  ) {
    return { ok: false, outcome: "cupo_completo" };
  }
  return { ok: true, outcome: "joined_active" };
}

async function main() {
  const candidates = [
    "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/apps/infospot/.env.local",
    path.join(process.cwd(), "apps/infospot/.env.local"),
    path.join(process.cwd(), "../../apps/infospot/.env.local"),
  ];
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    for (const [k, v] of Object.entries(loadEnvFile(c))) {
      if (!process.env[k]) process.env[k] = v;
    }
    break;
  }

  const steps: Step[] = [];
  const blockers: string[] = [];

  const isDb = fingerprintUrl(process.env.DATABASE_URL);
  const clfRo = fingerprintUrl(process.env.CLF_READONLY_DATABASE_URL);
  const clfWrite = fingerprintUrl(process.env.CLF_WRITE_DATABASE_URL);
  const allowWrite = process.env.ALLOW_CLF_WRITE_FROM_INFOSPOT === "true";
  const clfPublic = process.env.COMPRAMELAFOTO_PUBLIC_URL || "";
  const isPublic = process.env.NEXT_PUBLIC_INFOSPOT_URL || "";

  steps.push({
    name: "env_hosts_separated",
    ok: Boolean(isDb.hostPrefix && clfRo.hostPrefix && isDb.hostPrefix !== clfRo.hostPrefix),
    detail: `IS=${isDb.hostPrefix} CLF_RO=${clfRo.hostPrefix}`,
  });

  const clfPublicIsProd =
    /compramelafoto\.com/i.test(clfPublic) && !/dnxsuite|localhost|staging/i.test(clfPublic);
  steps.push({
    name: "clf_public_url_audit",
    ok: true,
    detail: `COMPRAMELAFOTO_PUBLIC_URL host=${(() => {
      try {
        return new URL(clfPublic).host;
      } catch {
        return "(unset/invalid)";
      }
    })()}; prodHost=${clfPublicIsProd}`,
  });

  if (!clfWrite.present && !allowWrite) {
    blockers.push(
      "Sin CLF_WRITE_DATABASE_URL ni ALLOW_CLF_WRITE_FROM_INFOSPOT — no se puede provisionar/join real en staging controlado",
    );
  }
  if (clfPublicIsProd) {
    blockers.push(
      "COMPRAMELAFOTO_PUBLIC_URL apunta a producción — join/leave HTTP real bloqueado por seguridad",
    );
  }

  // Policy matrix
  const cases: Array<{ name: string; input: Parameters<typeof simulatePublicJoin>[0]; expect: string }> = [
    {
      name: "open_join",
      input: {
        status: "ACTIVE",
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
        archivedAt: null,
        maxPhotographers: 2,
        activeCount: 0,
        invited: false,
        existing: "none",
      },
      expect: "joined_active",
    },
    {
      name: "open_idempotent",
      input: {
        status: "ACTIVE",
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
        archivedAt: null,
        maxPhotographers: 2,
        activeCount: 1,
        invited: false,
        existing: "ACTIVE",
      },
      expect: "already_active",
    },
    {
      name: "open_cupo_lleno",
      input: {
        status: "ACTIVE",
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
        archivedAt: null,
        maxPhotographers: 1,
        activeCount: 1,
        invited: false,
        existing: "none",
      },
      expect: "cupo_completo",
    },
    {
      name: "request_pending",
      input: {
        status: "ACTIVE",
        visibility: "PUBLIC",
        joinPolicy: "REQUEST",
        archivedAt: null,
        maxPhotographers: 1,
        activeCount: 1,
        invited: false,
        existing: "none",
      },
      expect: "request_pending",
    },
    {
      name: "invite_only_blocked",
      input: {
        status: "ACTIVE",
        visibility: "UNLISTED",
        joinPolicy: "INVITE_ONLY",
        archivedAt: null,
        maxPhotographers: null,
        activeCount: 0,
        invited: false,
        existing: "none",
      },
      expect: "not_invited",
    },
    {
      name: "invite_only_allowed",
      input: {
        status: "ACTIVE",
        visibility: "PRIVATE",
        joinPolicy: "INVITE_ONLY",
        archivedAt: null,
        maxPhotographers: null,
        activeCount: 0,
        invited: true,
        existing: "none",
      },
      expect: "joined_active",
    },
    {
      name: "closed_blocked",
      input: {
        status: "CLOSED",
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
        archivedAt: null,
        maxPhotographers: null,
        activeCount: 0,
        invited: false,
        existing: "none",
      },
      expect: "closed",
    },
  ];

  for (const c of cases) {
    const got = simulatePublicJoin(c.input);
    steps.push({
      name: `join_policy_${c.name}`,
      ok: got.outcome === c.expect,
      detail: `expected=${c.expect} got=${got.outcome}`,
    });
  }

  // Info Spot “Buscan fotógrafos”
  steps.push({
    name: "call_open_eligible",
    ok: isClfEventPublicPhotographerCall({
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      archivedAt: null,
      shareSlug: "e-x",
      status: "ACTIVE",
      maxPhotographers: 2,
      activePhotographerCount: 0,
    }),
  });
  steps.push({
    name: "call_hidden_when_full",
    ok:
      isClfEventPublicPhotographerCall({
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
        archivedAt: null,
        shareSlug: "e-x",
        status: "ACTIVE",
        maxPhotographers: 1,
        activePhotographerCount: 1,
      }) === false,
  });
  steps.push({
    name: "call_hidden_when_closed",
    ok:
      isClfEventPublicPhotographerCall({
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
        archivedAt: null,
        shareSlug: "e-x",
        status: "CLOSED",
        maxPhotographers: null,
        activePhotographerCount: 0,
      }) === false,
  });
  steps.push({
    name: "call_hidden_request",
    ok:
      isClfEventPublicPhotographerCall({
        visibility: "PUBLIC",
        joinPolicy: "REQUEST",
        archivedAt: null,
        shareSlug: "e-x",
        status: "ACTIVE",
        maxPhotographers: null,
      }) === false,
  });
  steps.push({
    name: "slots_math",
    ok: availablePhotographerSlots({ maxPhotographers: 3, activePhotographerCount: 1 }) === 2,
  });

  // License: kill switch CONTRACT=0 vs términos vigentes (default AUTHORIZED)
  const prevForce = process.env.INFOSPOT_FORCE_PRODUCTION_LICENSE_POLICY;
  const prevContract = process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT;
  const prevDefault = process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT;
  process.env.INFOSPOT_FORCE_PRODUCTION_LICENSE_POLICY = "1";
  process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT = "0";
  process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT = "AUTHORIZED";
  const blockedLic = assertProductionLicensePolicy();
  const pending = resolveDefaultEditorialLicenseStatus();
  steps.push({
    name: "license_kill_switch_blocks",
    ok: blockedLic.ok === false && pending === "PENDING",
    detail: `assert=${blockedLic.ok} default=${pending}`,
  });
  delete process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT;
  delete process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT;
  const okLic = assertProductionLicensePolicy();
  const auth = resolveDefaultEditorialLicenseStatus();
  steps.push({
    name: "license_ok_with_terms_contract",
    ok: okLic.ok && auth === "AUTHORIZED",
  });
  if (prevForce == null) delete process.env.INFOSPOT_FORCE_PRODUCTION_LICENSE_POLICY;
  else process.env.INFOSPOT_FORCE_PRODUCTION_LICENSE_POLICY = prevForce;
  if (prevContract == null) delete process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT;
  else process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT = prevContract;
  if (prevDefault == null) delete process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT;
  else process.env.INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT = prevDefault;

  // Sync dry-run (read-only against CLF)
  try {
    const summary = await reconcilePublicClfEvents({ dryRun: true, limit: 5 });
    steps.push({
      name: "inbound_sync_dry_run",
      ok: summary.failed === 0 && summary.scanned > 0,
      detail: `scanned=${summary.scanned} failed=${summary.failed}`,
    });
  } catch (err) {
    steps.push({
      name: "inbound_sync_dry_run",
      ok: false,
      detail: String(err).slice(0, 200),
    });
    blockers.push("Sync inbound dry-run falló");
  }

  // Cron routes present
  const cronSync = fs.existsSync(
    "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/apps/infospot/app/api/cron/clf-events-sync/route.ts",
  );
  const cronCov = fs.existsSync(
    "/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/apps/infospot/app/api/cron/reconcile-public-coverage/route.ts",
  );
  steps.push({ name: "cron_route_clf_sync", ok: cronSync });
  steps.push({ name: "cron_route_coverage_reconcile", ok: cronCov });

  // R2
  const r2 =
    Boolean(process.env.R2_BUCKET_NAME || process.env.R2_BUCKET) &&
    Boolean(process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL);
  steps.push({
    name: "r2_env_local",
    ok: true,
    detail: r2 ? "present" : "missing in local env — storage real staging pendiente (blocker operativo)",
  });
  if (!r2) blockers.push("R2/storage no configurado en entorno local de gate");

  // Schema drift note
  steps.push({
    name: "note_event_schema_drift",
    ok: true,
    detail:
      "IS staging Event table carece de columna status (25 cols); CLF_RO sí la tiene (38). No usar IS DB como write CLF.",
  });

  const failed = steps.filter((s) => !s.ok && !s.name.startsWith("note_"));
  // r2 missing is important but gate script still returns structured report
  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        action: "e13-gate",
        isPublic,
        environments: { isDb, clfRo, clfWriteConfigured: clfWrite.present || allowWrite },
        passed: steps.filter((s) => s.ok).length,
        failed: failed.map((f) => f.name),
        steps,
        blockers,
        decision:
          blockers.length > 0
            ? "NO-GO producción: faltan write CLF staging + URL no-prod + R2/Safari reales"
            : "GO condicional",
      },
      null,
      2,
    ),
  );
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(String(err));
  process.exitCode = 1;
});
