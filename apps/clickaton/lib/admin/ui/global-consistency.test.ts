import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adminNavigation } from "@/config/admin/navigation";

const ROOT = join(process.cwd());

describe("global admin navigation consistency", () => {
  it("uses human task labels without english leftovers", () => {
    const labels = adminNavigation.map((item) => item.label);
    assert.ok(labels.includes("Inicio"));
    assert.ok(labels.includes("Productos y kits"));
    assert.ok(labels.includes("Códigos promocionales"));
    assert.ok(labels.includes("Publicaciones y comunicaciones"));
    assert.ok(labels.includes("Sponsors y beneficios"));
    assert.ok(labels.includes("Banners del inicio"));
    assert.ok(!labels.includes("Dashboard"));
    assert.ok(!labels.includes("Sponsors"));
    assert.ok(!labels.includes("Catálogo"));
    assert.ok(!labels.some((label) => /Timeline|Fulfillment|Entries|Sync/i.test(label)));
  });

  it("keeps route hrefs unchanged for main modules", () => {
    const byLabel = Object.fromEntries(adminNavigation.map((i) => [i.label, i.href]));
    assert.equal(byLabel["Inicio"], "/admin");
    assert.equal(byLabel["Ediciones"], "/admin/ediciones");
    assert.equal(byLabel["Inscripciones"], "/admin/inscripciones");
    assert.equal(byLabel["Integraciones"], "/admin/integraciones");
    assert.equal(byLabel["Productos y kits"], "/admin/catalogo");
    assert.equal(byLabel["Códigos promocionales"], "/admin/promociones");
    assert.equal(byLabel["Publicaciones y comunicaciones"], "/admin/social");
  });
});

describe("auth brand legal paths", () => {
  it("Clickatón auth links point to /legal/* routes", () => {
    const brand = readFileSync(
      join(ROOT, "../../packages/auth-ui/src/brand/clickaton.ts"),
      "utf8",
    );
    assert.match(brand, /privacyUrl:\s*"\/legal\/privacidad"/);
    assert.match(brand, /termsUrl:\s*"\/legal\/terminos"/);
    assert.doesNotMatch(brand, /privacyUrl:\s*"\/privacidad"/);
    assert.doesNotMatch(brand, /termsUrl:\s*"\/terminos"/);
  });
});

describe("public marathons error visibility", () => {
  it("does not swallow list/detail source failures as empty/404", () => {
    const listPage = readFileSync(join(ROOT, "app/(public)/maratones/page.tsx"), "utf8");
    assert.match(listPage, /listPublicMarathons\(\)/);
    assert.doesNotMatch(listPage, /catch\s*\{[\s\S]*listed\s*=\s*\[\]/);

    const detailPage = readFileSync(
      join(ROOT, "app/(public)/maratones/[slug]/page.tsx"),
      "utf8",
    );
    assert.match(detailPage, /if \(!marathon\) notFound\(\)/);
    assert.doesNotMatch(
      detailPage,
      /catch\s*\{[\s\S]*notFound\(\)/,
    );

    const home = readFileSync(join(ROOT, "app/(public)/page.tsx"), "utf8");
    assert.doesNotMatch(home, /catch\s*\{[\s\S]*editions\s*=\s*\[\]/);

    const upcoming = readFileSync(
      join(ROOT, "components/home/UpcomingEventsSection.tsx"),
      "utf8",
    );
    assert.doesNotMatch(upcoming, /catch\s*\{[\s\S]*editions\s*=\s*\[\]/);
  });
});

describe("global shell and error source contracts", () => {
  it("breadcrumbs root is Inicio", () => {
    const crumbs = readFileSync(join(ROOT, "components/admin/AdminBreadcrumbs.tsx"), "utf8");
    assert.match(crumbs, /label: "Inicio"/);
    assert.doesNotMatch(crumbs, /label: "Admin"/);
  });

  it("forbidden and not-found pages have human exits", () => {
    const forbidden = readFileSync(join(ROOT, "app/admin/acceso-denegado/page.tsx"), "utf8");
    assert.match(forbidden, /No tenés permiso para acceder a esta sección/);
    assert.match(forbidden, /Ir a Mi cuenta/);
    assert.match(forbidden, /Volver al inicio/);
    // Copy visible (no strings de UI en inglés). El nombre del componente puede ser interno.
    assert.doesNotMatch(forbidden, />\s*Forbidden\s*</);
    assert.doesNotMatch(forbidden, />\s*Unauthorized\s*</);
    assert.doesNotMatch(forbidden, /Acceso denegado/);

    const notFound = readFileSync(join(ROOT, "app/not-found.tsx"), "utf8");
    assert.match(notFound, /No encontramos esta página/);
    assert.match(notFound, /Volver al inicio/);
    assert.match(notFound, /Ir a Mi cuenta/);
  });

  it("loading screens have contextual Spanish copy", () => {
    const adminLoading = readFileSync(join(ROOT, "app/admin/(panel)/loading.tsx"), "utf8");
    assert.match(adminLoading, /Cargando el panel/);
    const accountLoading = readFileSync(
      join(ROOT, "app/(public)/mi-cuenta/loading.tsx"),
      "utf8",
    );
    assert.match(accountLoading, /Cargando tu cuenta/);
  });

  it("dashboard uses specific action verbs", () => {
    const dash = readFileSync(join(ROOT, "app/admin/(panel)/page.tsx"), "utf8");
    assert.match(dash, /Revisar inscripciones/);
    assert.match(dash, /Preparar publicaciones/);
    assert.match(dash, /Conectar Mercado Pago/);
    assert.doesNotMatch(dash, /breadcrumbs=\{\[\{ label: "Dashboard"/);
    assert.doesNotMatch(dash, /acceso completo del MVP/);
  });

  it("integrations explain purpose and avoid raw OK/FAIL labels", () => {
    const integrations = readFileSync(join(ROOT, "config/admin/integrations.ts"), "utf8");
    assert.match(integrations, /Sin conectar/);
    assert.match(integrations, /Configuración incompleta|Disponible para continuar/);
    assert.match(integrations, /Permite cobrar las inscripciones/);
    assert.doesNotMatch(integrations, /statusLabel: "OK"|statusLabel: "FAIL"/);
  });

  it("mobile nav has accessible close control", () => {
    const mobile = readFileSync(
      join(ROOT, "components/admin/AdminMobileNavigation.tsx"),
      "utf8",
    );
    assert.match(mobile, /aria-label="Cerrar menú/);
    assert.match(mobile, /min-h-11/);
    assert.match(mobile, /aria-modal/);
  });
});
