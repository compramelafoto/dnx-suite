import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { filterSidebarByRoles } from "@repo/design-system";
import {
  assertPartnerGlobalStatusPayloadSafe,
  assertSafePartnersCentralAdminUrl,
  buildUnverifiablePlatformStatus,
  listPartnerGlobalPlacementsForApp,
  resolveDnxPartnersCentralPlatformUrl,
} from "../../../../../../packages/partners/src/global-status";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../../../../");

function readRepo(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("fotorank partners global status local page", () => {
  it("administrador SUPER_ADMIN accede; roles no globales no", () => {
    const page = readRepo(
      "apps/fotorank/app/(dashboard)/dashboard/sponsors-dnx-partners/page.tsx",
    );
    assert.match(page, /requireAuth/);
    assert.match(page, /userIsFotorankSuperAdmin/);
    assert.match(page, /redirect\("\/dashboard"\)/);
    assert.match(page, /loadPartnerGlobalStatusForLocalApp/);
    assert.match(page, /FOTO_RANK/);
    assert.match(page, /solo lectura/i);
    assert.doesNotMatch(page, /createPartner|publishCampaign|ensureAdPlacementCatalog/);
    assert.doesNotMatch(page, /DNX_PARTNERS_FOTORANK_DATABASE_URL|DNX_PARTNERS_FOTORANK_ADS_DATABASE_URL/);
  });

  it("página estrictamente de solo lectura", () => {
    const view = readRepo("apps/fotorank/app/components/partners/PartnerLocalStatusView.tsx");
    assert.match(view, /data-readonly="true"/);
    assert.match(view, /Gestionar sponsors en DNX Partners/);
    assert.match(view, /partners-central-admin-link/);
    assert.doesNotMatch(view, /<form|type="submit"|onSubmit/);
    assert.doesNotMatch(view, /Crear|Editar|Publicar|Aprobar|Sincronizar|Activar/);
  });

  it("consulta usa réplica local y fail-closed UNVERIFIABLE", () => {
    const loader = readRepo("packages/db/src/partners-global-status-loader.ts");
    assert.match(loader, /mode: "REPLICA"/);
    assert.match(loader, /loadPartnerGlobalStatusForLocalApp/);
    assert.match(loader, /buildUnverifiablePlatformStatus/);
    const page = readRepo(
      "apps/fotorank/app/(dashboard)/dashboard/sponsors-dnx-partners/page.tsx",
    );
    assert.match(page, /buildUnverifiablePlatformStatus/);
    const bad = buildUnverifiablePlatformStatus("FOTO_RANK", "LOCAL_REPLICA", "timeout");
    assert.equal(bad.health, "UNVERIFIABLE");
    assert.equal(bad.campaigns.total, null);
  });

  it("menú solo SUPER_ADMIN; organizador no ve la entrada", () => {
    const layout = readRepo("apps/fotorank/app/components/DashboardLayout.tsx");
    assert.match(layout, /Sponsors — DNX Partners/);
    assert.match(layout, /\/dashboard\/sponsors-dnx-partners/);
    assert.match(layout, /roles:\s*\["super_admin"\]/);
    assert.match(layout, /isSuperAdmin/);
    const dashboardLayout = readRepo("apps/fotorank/app/(dashboard)/layout.tsx");
    assert.match(dashboardLayout, /isSuperAdmin=\{isSuperAdmin\}/);

    const sections = [
      {
        title: "Configuración",
        items: [
          {
            label: "Sponsors — DNX Partners",
            href: "/dashboard/sponsors-dnx-partners",
            icon: "settings",
            roles: ["super_admin"],
          },
        ],
      },
    ];
    const asOrganizer = filterSidebarByRoles(sections, ["admin"]);
    assert.equal(asOrganizer.length, 0);
    const asSa = filterSidebarByRoles(sections, ["admin", "super_admin"]);
    assert.equal(asSa[0]?.items[0]?.href, "/dashboard/sponsors-dnx-partners");
  });

  it("tres placements FotoRank montados; FotoOffice excluido", () => {
    const fr = listPartnerGlobalPlacementsForApp("FOTO_RANK");
    assert.ok(fr.some((p) => p.placementKey === "FOTORANK_CONTEST_WELCOME" && p.mounted));
    assert.ok(fr.some((p) => p.placementKey === "FOTORANK_HOME_MARQUEE" && p.mounted));
    assert.ok(fr.some((p) => p.placementKey === "FOTORANK_CONTEST_MARQUEE" && p.mounted));
    assert.ok(!fr.some((p) => String(p.placementKey).includes("FOTOOFFICE") || String(p.placementKey).includes("FOTO_OFFICE")));
    const view = readRepo("apps/fotorank/app/components/partners/PartnerLocalStatusView.tsx");
    assert.match(view, /fotoOfficeNote/);
  });

  it("enlace central HTTPS sin credenciales; secretos no en payload", () => {
    const href = resolveDnxPartnersCentralPlatformUrl("FOTO_RANK");
    assert.match(href, /estado-global\/foto-rank/);
    assert.doesNotMatch(href, /token=|email=|password=|secret=/);
    const stripped = assertSafePartnersCentralAdminUrl(
      "https://maratonfotografica.com/admin/sponsors?token=abc&email=a@b.com",
    );
    assert.doesNotMatch(stripped, /token=|email=/);
    assert.throws(() =>
      assertPartnerGlobalStatusPayloadSafe({ DATABASE_URL: "postgres://x" }),
    );
  });

  it("welcome, marquee y Santa Fe en Foco public-ui intactos", () => {
    const contestPage = readRepo("apps/fotorank/app/concursos/[slug]/page.tsx");
    assert.match(contestPage, /FotorankContestPartnerWelcome/);
    assert.match(contestPage, /FotorankPartnerLogoMarquee/);
    assert.match(contestPage, /santa-fe-en-foco/);
    assert.match(contestPage, /ContestPublicLanding/);
    const landing = readRepo("apps/fotorank/app/concursos/[slug]/ContestPublicLanding.tsx");
    assert.match(landing, /public-ui/);
    const home = readRepo("apps/fotorank/app/page.tsx");
    assert.match(home, /FotorankPartnerLogoMarquee/);
  });
});
