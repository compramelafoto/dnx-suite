import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTemplateVariableRegistry,
  schoolTemplateVariablesPlugin,
  applyFormatter,
} from "../../index";
import {
  clickatonTemplateVariablesPlugin,
  createClickatonTemplateExampleData,
  normalizeInstagramHandle,
  CLICKATON_TEMPLATE_VARIABLE_DEFINITIONS,
  formatDateDayMonthUppercase,
  formatDateLongUppercase,
  formatDateShort,
  formatParticipantNumber,
  CLICKATON_DEFAULT_TIMEZONE,
} from "./index";

describe("clickaton plugin", () => {
  it("registra plugin clickaton aislado; mezcla con school choca en aliases", () => {
    const click = createTemplateVariableRegistry([clickatonTemplateVariablesPlugin]);
    const school = createTemplateVariableRegistry([schoolTemplateVariablesPlugin]);
    assert.ok(click.getVariableDefinition("participant.fullName"));
    assert.ok(school.getVariableDefinition("student.fullName"));
    assert.equal(click.getVariableDefinition("student.fullName"), undefined);
    assert.equal(school.getVariableDefinition("participant.fullName"), undefined);
    assert.throws(() =>
      createTemplateVariableRegistry([
        schoolTemplateVariablesPlugin,
        clickatonTemplateVariablesPlugin,
      ])
    );
  });

  it("catálogo tiene familias esperadas", () => {
    const paths = new Set(CLICKATON_TEMPLATE_VARIABLE_DEFINITIONS.map((d) => d.path));
    for (const p of [
      "participant.fullName",
      "participant.instagramHandle",
      "participant.photoUrl",
      "participant.numberFormatted",
      "edition.name",
      "edition.eventDate",
      "branding.logoUrl",
      "branding.primaryColor",
      "organization.name",
      "sponsors.primary.name",
      "card.message",
    ]) {
      assert.ok(paths.has(p), p);
    }
  });

  it("aliases clickaton resuelven", () => {
    const reg = createTemplateVariableRegistry([clickatonTemplateVariablesPlugin]);
    const data = createClickatonTemplateExampleData();
    const r = reg.resolveTemplateVariable("instagram", data);
    assert.equal(r.status, "resolved");
    assert.equal(r.path, "participant.instagramHandle");
  });

  it("normalizeInstagramHandle casos", () => {
    const plain = normalizeInstagramHandle("dnxfotografia");
    assert.equal(plain.ok, true);
    if (plain.ok) assert.equal(plain.handle, "dnxfotografia");

    const a = normalizeInstagramHandle("@dnxfotografia");
    assert.equal(a.ok, true);
    if (a.ok) {
      assert.equal(a.handle, "dnxfotografia");
      assert.equal(a.displayHandle, "@dnxfotografia");
    }

    const b = normalizeInstagramHandle("instagram.com/dnxfotografia");
    assert.equal(b.ok, true);
    if (b.ok) assert.equal(b.handle, "dnxfotografia");

    const c = normalizeInstagramHandle("https://www.instagram.com/dnxfotografia/");
    assert.equal(c.ok, true);
    if (c.ok) assert.equal(c.handle, "dnxfotografia");

    const d = normalizeInstagramHandle("@dani.fotos_2026");
    assert.equal(d.ok, true);
    if (d.ok) assert.equal(d.handle, "dani.fotos_2026");

    const e = normalizeInstagramHandle("  @dnxfotografia  ");
    assert.equal(e.ok, true);
    if (e.ok) assert.equal(e.handle, "dnxfotografia");

    assert.equal(normalizeInstagramHandle("").ok, false);
    assert.equal(normalizeInstagramHandle("bad handle!!").ok, false);
    assert.equal(normalizeInstagramHandle("@@").ok, false);
  });

  it("participantNumber formatter", () => {
    assert.equal(formatParticipantNumber(1), "0001");
    assert.equal(formatParticipantNumber(25), "0025");
    assert.equal(formatParticipantNumber(154), "0154");
    assert.equal(formatParticipantNumber(1200), "1200");
    assert.equal(applyFormatter(25, "participantNumber").text, "0025");
  });

  it("fechas timezone Argentina", () => {
    assert.equal(formatDateShort("2026-09-19"), "19/09/2026");
    assert.equal(formatDateDayMonthUppercase("2026-09-19"), "19 DE SEPTIEMBRE");
    assert.match(formatDateLongUppercase("2026-09-19"), /19 DE SEPTIEMBRE/);

    // cerca de medianoche UTC: 2026-09-19T03:00:00Z → sigue siendo 19 en Córdoba
    const near = formatDateShort(
      new Date("2026-09-19T03:00:00.000Z"),
      CLICKATON_DEFAULT_TIMEZONE
    );
    assert.equal(near, "19/09/2026");

    // 2026-09-19T02:00:00Z es 18/09 en Córdoba (UTC-3) → verificar ancla
    const edge = formatDateShort(
      new Date("2026-09-19T02:00:00.000Z"),
      CLICKATON_DEFAULT_TIMEZONE
    );
    assert.equal(edge, "18/09/2026");
  });

  it("example data ficticia y sin school keys", () => {
    const d = createClickatonTemplateExampleData();
    assert.equal((d.participant as { fullName: string }).fullName, "Daniel Fotógrafo");
    assert.equal((d.participant as { instagramHandle: string }).instagramHandle, "@dnxfotografia");
    assert.equal((d.branding as { primaryColor: string }).primaryColor, "#FFE600");
    assert.equal(d["student.fullName"], undefined);
    assert.equal(d["school.name"], undefined);
  });

  it("instagram vacío en overrides no deja @", () => {
    const d = createClickatonTemplateExampleData({
      participant: { instagram: "", instagramHandle: "" },
    });
    assert.equal((d.participant as { instagramHandle: string }).instagramHandle, "");
    assert.equal((d.participant as { instagram: string }).instagram, "");
  });

  it("producto desconocido: registry clickaton solo", () => {
    const reg = createTemplateVariableRegistry([clickatonTemplateVariablesPlugin]);
    assert.equal(reg.getVariableDefinition("student.fullName"), undefined);
  });
});
