import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertPartnerGlobalStatusPayloadSafe,
  assertSafePartnersCentralAdminUrl,
  buildUnverifiablePlatformStatus,
  listPartnerGlobalPlacementsForApp,
  resolveDnxPartnersCentralPlatformUrl,
} from "../../../packages/partners/src/global-status";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../");

function readRepo(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("infospot partners global status local page", () => {
  it("administrador accede con requireInfoSpotAdminAccess; sin escritura", () => {
    const page = readRepo("apps/infospot/app/admin/sponsors-dnx-partners/page.tsx");
    assert.match(page, /requireInfoSpotAdminAccess/);
    assert.match(page, /loadPartnerGlobalStatusForLocalApp/);
    assert.match(page, /INFO_SPOT/);
    assert.match(page, /solo lectura/i);
    assert.doesNotMatch(page, /createPartner|publishCampaign|ensureAdPlacementCatalog/);
    assert.doesNotMatch(
      page,
      /DNX_PARTNERS_INFOSPOT_DATABASE_URL|DATABASE_URL/,
    );
  });

  it("página estrictamente de solo lectura", () => {
    const view = readRepo("apps/infospot/components/partners/PartnerLocalStatusView.tsx");
    assert.match(view, /data-readonly="true"/);
    assert.match(view, /Gestionar sponsors en DNX Partners/);
    assert.doesNotMatch(view, /<form|type="submit"|onSubmit/);
    assert.doesNotMatch(view, /Crear|Editar|Publicar|Aprobar|Sincronizar|Activar/);
  });

  it("consulta usa réplica local y fail-closed UNVERIFIABLE", () => {
    const loader = readRepo("packages/db/src/partners-global-status-loader.ts");
    assert.match(loader, /mode: "REPLICA"/);
    assert.match(loader, /loadPartnerGlobalStatusForLocalApp/);
    const page = readRepo("apps/infospot/app/admin/sponsors-dnx-partners/page.tsx");
    assert.match(page, /buildUnverifiablePlatformStatus/);
    const bad = buildUnverifiablePlatformStatus("INFO_SPOT", "LOCAL_REPLICA", "timeout");
    assert.equal(bad.health, "UNVERIFIABLE");
    assert.equal(bad.campaigns.total, null);
  });

  it("menú solo con showAdmin (dirección)", () => {
    const nav = readRepo("apps/infospot/components/redaccion/redaccion-nav.tsx");
    assert.match(nav, /Sponsors — DNX Partners/);
    assert.match(nav, /\/admin\/sponsors-dnx-partners/);
    const admin = readRepo("apps/infospot/app/admin/page.tsx");
    assert.match(admin, /Sponsors — DNX Partners/);
  });

  it("placements welcome y marquee; FotoOffice excluido", () => {
    const rows = listPartnerGlobalPlacementsForApp("INFO_SPOT");
    assert.ok(rows.some((p) => p.placementKey === "INFOSPOT_HOME_WELCOME" && p.mounted));
    assert.ok(rows.some((p) => p.placementKey === "INFOSPOT_HOME_MARQUEE" && p.mounted));
    assert.ok(
      !rows.some(
        (p) =>
          String(p.placementKey).includes("FOTOOFFICE") ||
          String(p.placementKey).includes("FOTO_OFFICE"),
      ),
    );
  });

  it("enlace central HTTPS sin credenciales; secretos no en payload", () => {
    const href = resolveDnxPartnersCentralPlatformUrl("INFO_SPOT");
    assert.match(href, /^https:\/\/maratonfotografica\.com\/admin\/sponsors\/estado-global\/infospot$/);
    assert.doesNotMatch(href, /token=|email=|password=|secret=/);
    const stripped = assertSafePartnersCentralAdminUrl(
      "https://maratonfotografica.com/admin/sponsors?token=abc&email=a@b.com",
    );
    assert.doesNotMatch(stripped, /token=|email=/);
    assert.throws(() =>
      assertPartnerGlobalStatusPayloadSafe({ DATABASE_URL: "postgres://x" }),
    );
  });

  it("home welcome/marquee y flujos editoriales no importan el loader de estado", () => {
    const home = readRepo("apps/infospot/app/page.tsx");
    assert.match(home, /PartnerAdsWelcome/);
    assert.match(home, /PartnerLogoMarquee/);
    assert.doesNotMatch(home, /partners-global-status-loader/);
    const article = readRepo("apps/infospot/app/noticias/[slug]/page.tsx");
    assert.doesNotMatch(article, /partners-global-status-loader/);
    const editor = readRepo("apps/infospot/app/redaccion/page.tsx");
    assert.doesNotMatch(editor, /partners-global-status-loader/);
  });
});
