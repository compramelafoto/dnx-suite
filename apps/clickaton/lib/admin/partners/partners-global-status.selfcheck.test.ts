/**
 * Selfcheck Etapa 13 — panel global DNX Partners (Clickatón admin).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "../../..");

function read(rel: string): string {
  return readFileSync(join(appRoot, rel), "utf8");
}

describe("clickaton partners global status admin", () => {
  it("ruta central + detalle + requireClickatonAdmin", () => {
    const page = read("app/admin/(panel)/sponsors/estado-global/page.tsx");
    assert.match(page, /requireClickatonAdmin/);
    assert.match(page, /loadPartnerGlobalStatusOverview/);
    assert.match(page, /mode:\s*"CENTRAL"/);
    assert.match(page, /PartnerGlobalStatusCard/);
    assert.doesNotMatch(page, /DATABASE_URL|password|secret=/i);

    const detail = read("app/admin/(panel)/sponsors/estado-global/[platform]/page.tsx");
    assert.match(detail, /requireClickatonAdmin/);
    assert.match(detail, /foto-rank|FOTO_RANK/);
    assert.match(detail, /PartnerGlobalStatusDetail/);
    assert.doesNotMatch(detail, /FOTO_OFFICE/);
  });

  it("navegación incluye Estado global y isAdminNavActive excluye CRM", () => {
    const nav = read("config/admin/navigation.ts");
    assert.match(nav, /sponsorsGlobalStatus/);
    assert.match(nav, /Estado global/);
    assert.match(nav, /\/admin\/sponsors\/estado-global/);
    assert.match(nav, /SPONSORS_CRM_EXCLUDED_PREFIXES/);
    assert.doesNotMatch(nav, /token=|ssoSecret/i);
  });

  it("vistas no muestran secretos ni permiten edición", () => {
    const panel = read("components/admin/partners/PartnerGlobalStatusPanel.tsx");
    assert.match(panel, /solo lectura/i);
    assert.match(panel, /variant=/);
    assert.doesNotMatch(panel, /createPartner|publishCampaign|FormSection/);
    assert.doesNotMatch(panel, /process\.env\.|DATABASE_URL/);
    assert.match(panel, /partners-central-admin-link/);
  });
});
