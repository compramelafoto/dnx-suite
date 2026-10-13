import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEscolarLandingChecklist,
  buildEscolarLandingStatus,
  buildEscolarLandingUrl,
  buildPhotographerSchoolLeadsWhere,
  formatLeadDateAR,
  schoolLeadStatusLabel,
  type EscolarLandingProfile,
} from "@/lib/schools/photographer-escolar-landing";

const completo: EscolarLandingProfile = {
  role: "PHOTOGRAPHER",
  publicPageHandler: "estudio-sol",
  isPublicPageEnabled: true,
  logoUrl: "https://cdn/logo.png",
  whatsapp: "+54 9 341 555-1234",
  phone: null,
  companyName: "Estudio Sol",
};

describe("landing escolar — URL", () => {
  it("arma la URL pública con /escolar", () => {
    assert.equal(buildEscolarLandingUrl("estudio-sol"), "https://www.compramelafoto.com/estudio-sol/escolar");
  });
  it("normaliza a minúsculas y recorta espacios", () => {
    assert.equal(buildEscolarLandingUrl("  Estudio-Sol "), "https://www.compramelafoto.com/estudio-sol/escolar");
  });
  it("sin handler no hay URL", () => {
    assert.equal(buildEscolarLandingUrl(null), null);
    assert.equal(buildEscolarLandingUrl("   "), null);
  });
});

describe("landing escolar — checklist", () => {
  it("perfil completo: todo hecho y disponible", () => {
    const st = buildEscolarLandingStatus(completo);
    assert.equal(st.available, true);
    assert.equal(st.pendingCount, 0);
    assert.equal(st.unavailableReason, null);
    assert.ok(st.checklist.every((i) => i.done));
  });

  it("sin handler: no disponible, URL null, ítem obligatorio pendiente", () => {
    const st = buildEscolarLandingStatus({ ...completo, publicPageHandler: null });
    assert.equal(st.available, false);
    assert.equal(st.url, null);
    assert.match(st.unavailableReason!, /dirección pública/);
    const handler = st.checklist.find((i) => i.id === "handler")!;
    assert.equal(handler.done, false);
    assert.equal(handler.required, true);
  });

  it("página pública apagada: no disponible pero muestra la URL (deshabilitada)", () => {
    const st = buildEscolarLandingStatus({ ...completo, isPublicPageEnabled: false });
    assert.equal(st.available, false);
    assert.equal(st.url, "https://www.compramelafoto.com/estudio-sol/escolar");
    assert.match(st.unavailableReason!, /apagada/);
  });

  it("rol LAB_PHOTOGRAPHER: la landing no se sirve", () => {
    const st = buildEscolarLandingStatus({ ...completo, role: "LAB_PHOTOGRAPHER" });
    assert.equal(st.available, false);
  });

  it("teléfono sin WhatsApp cuenta como contacto", () => {
    const items = buildEscolarLandingChecklist({ ...completo, whatsapp: "", phone: "341 4440000" });
    assert.equal(items.find((i) => i.id === "contact")!.done, true);
  });

  it("faltan logo, contacto y nombre: 3 pendientes no obligatorios, sigue disponible", () => {
    const st = buildEscolarLandingStatus({ ...completo, logoUrl: null, whatsapp: null, phone: " ", companyName: "" });
    assert.equal(st.available, true);
    assert.equal(st.pendingCount, 3);
    assert.ok(st.checklist.filter((i) => !i.done).every((i) => !i.required));
  });

  it("cada ítem enlaza a la configuración del fotógrafo", () => {
    for (const item of buildEscolarLandingChecklist(completo)) {
      assert.match(item.href, /^\/fotografo\/configuracion\?tab=(datos|diseno)$/);
    }
  });
});

describe("landing escolar — consulta de leads aislada", () => {
  it("siempre filtra por el usuario logueado", () => {
    assert.deepEqual(buildPhotographerSchoolLeadsWhere(42), { referredByUserId: 42 });
  });
  it("rechaza ids inválidos (nunca devuelve un where sin filtro)", () => {
    for (const bad of [0, -1, NaN, 1.5, Number.POSITIVE_INFINITY]) {
      assert.throws(() => buildPhotographerSchoolLeadsWhere(bad));
    }
  });
});

describe("landing escolar — formato", () => {
  it("fecha en hora argentina (UTC-3)", () => {
    assert.equal(formatLeadDateAR("2026-10-13T02:30:00.000Z"), "12/10/2026 23:30");
  });
  it("fecha inválida", () => {
    assert.equal(formatLeadDateAR("no-es-fecha"), "—");
    assert.equal(formatLeadDateAR(null), "—");
  });
  it("estados en castellano", () => {
    assert.equal(schoolLeadStatusLabel("NEW"), "Nueva");
    assert.equal(schoolLeadStatusLabel("CONVERTED"), "Convertida");
  });
});
