import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(__dirname, "..", "..", "..", "..", "packages/db/prisma/migrations/20261004120000_fotoffice_campos_y_numeracion/migration.sql"),
  "utf8",
);

describe("migración de campos y numeración", () => {
  it("no altera tablas existentes ni borra nada", () => {
    expect(sql).not.toMatch(/ALTER TABLE "(?!Fotoffice(CustomField|CustomFieldOption|CustomValue|CustomValueChange|Sequence|SequenceChange|RecordNumber)")/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "/);
  });
  it("crea las siete tablas", () => {
    for (const t of ["FotofficeCustomField", "FotofficeCustomFieldOption", "FotofficeCustomValue", "FotofficeCustomValueChange", "FotofficeSequence", "FotofficeSequenceChange", "FotofficeRecordNumber"]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
    }
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(7);
  });
  it("tiene los dos índices únicos parciales de los números", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX "FotofficeRecordNumber_con_anio"[^;]*WHERE "year" IS NOT NULL/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "FotofficeRecordNumber_sin_anio"[^;]*\("workspaceId", "sequenceKey", "value"\) WHERE "year" IS NULL/);
  });
  it("tiene los cuatro CHECK", () => {
    for (const c of ["FotofficeCustomField_type", "FotofficeCustomField_entityType", "FotofficeSequence_digits", "FotofficeSequence_nextValue"]) {
      expect(sql).toMatch(new RegExp(`ADD CONSTRAINT "${c}" CHECK`));
    }
  });
});
