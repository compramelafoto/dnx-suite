import assert from "node:assert/strict";
import test from "node:test";
import {
  CLICKATON_CONTENT_ACCENT,
  CLICKATON_CONTENT_ACCENT_STYLE,
  CLICKATON_CONTENT_LABELS,
  CLICKATON_CONTENT_STATUS_LABELS,
  CLICKATON_CONTENT_TYPE_LABELS,
} from "./content-labels";

test("el acento del CMS es el amarillo de marca", () => {
  assert.equal(CLICKATON_CONTENT_ACCENT, "#ffc400");
  assert.equal(
    CLICKATON_CONTENT_ACCENT_STYLE["--content-ui-accent"],
    CLICKATON_CONTENT_ACCENT,
  );
});

test("el copy no arrastra marcas de otras apps", () => {
  const values = Object.values(CLICKATON_CONTENT_LABELS).filter(
    (value): value is string => typeof value === "string",
  );
  assert.ok(values.length > 0);
  for (const value of values) {
    assert.equal(/ComprameLaFoto|FotoRank|Fotoffice/i.test(value), false, value);
  }
  assert.ok(values.some((value) => value.includes("Clickatón")));
});

test("hay etiqueta para cada estado y tipo usado en el panel", () => {
  for (const status of ["DRAFT", "PUBLISHED", "ARCHIVED"]) {
    assert.ok(CLICKATON_CONTENT_STATUS_LABELS[status]);
  }
  for (const type of ["BLOG", "FEATURE", "CASE_STUDY", "COMPARISON"]) {
    assert.ok(CLICKATON_CONTENT_TYPE_LABELS[type]);
  }
});
