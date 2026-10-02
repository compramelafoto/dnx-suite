import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(__dirname, "..", "..", "..", "..", "packages/db/prisma/migrations/20261005120000_fotoffice_plantillas/migration.sql"),
  "utf8",
);

describe("migración de plantillas de mensajes", () => {
  it("no altera tablas existentes ni borra nada", () => {
    expect(sql).not.toMatch(/ALTER TABLE "(?!Fotoffice(MessageTemplate|Message)")/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "/);
  });
  it("crea las dos tablas", () => {
    expect(sql).toMatch(/CREATE TABLE "FotofficeMessageTemplate"/);
    expect(sql).toMatch(/CREATE TABLE "FotofficeMessage"/);
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(2);
  });
  it("el cuerpo es TEXT y la plantilla del registro se pone en NULL al borrarse", () => {
    expect(sql.match(/"body" TEXT NOT NULL/g)).toHaveLength(2);
    expect(sql).toMatch(/"FotofficeMessage_templateId_fkey"[^;]*ON DELETE SET NULL/);
    expect(sql).toMatch(/"FotofficeMessageTemplate_workspaceId_fkey"[^;]*ON DELETE CASCADE/);
    expect(sql).toMatch(/"FotofficeMessage_workspaceId_fkey"[^;]*ON DELETE CASCADE/);
  });
  it("tiene el índice único parcial de las plantillas de sistema", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "FotofficeMessageTemplate_systemKey" ON "FotofficeMessageTemplate"\("workspaceId", "systemKey"\) WHERE "systemKey" IS NOT NULL/,
    );
  });
  it("tiene los índices del registro", () => {
    expect(sql).toMatch(/ON "FotofficeMessage"\("workspaceId", "entityType", "entityId", "createdAt"\)/);
    expect(sql).toMatch(/ON "FotofficeMessage"\("workspaceId", "channel", "createdAt"\)/);
  });
  it("tiene los cinco CHECK", () => {
    for (const c of [
      "FotofficeMessageTemplate_channel",
      "FotofficeMessageTemplate_entityType",
      "FotofficeMessageTemplate_subject",
      "FotofficeMessage_channel",
      "FotofficeMessage_status",
    ]) {
      expect(sql).toMatch(new RegExp(`ADD CONSTRAINT "${c}" CHECK`));
    }
    expect(sql).toMatch(/"channel" = 'EMAIL' AND "subject" IS NOT NULL\) OR \("channel" = 'WHATSAPP' AND "subject" IS NULL/);
    expect(sql).toMatch(/CHECK \("status" IN \('SENT', 'FAILED', 'OPENED_WHATSAPP'\)\)/);
  });
});
