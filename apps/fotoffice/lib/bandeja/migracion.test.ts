import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(
  join(RAIZ, "packages/db/prisma/migrations/20261027100000_fotoffice_bandeja_whatsapp/migration.sql"),
  "utf8",
);
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

const TABLAS = ["FotofficeWaConexion", "FotofficeWaChat", "FotofficeWaMensaje"];

describe("migración de la Bandeja de WhatsApp", () => {
  it("crea sólo las tres tablas nuevas y no toca ninguna existente", () => {
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(3);
    for (const t of TABLAS) expect(sql).toContain(`CREATE TABLE "${t}"`);
    expect(sql).not.toMatch(/ALTER TABLE "(?!FotofficeWa(Conexion|Chat|Mensaje)")/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|ADD COLUMN/);
  });

  it("únicos e índices del diseño", () => {
    for (const idx of [
      `CREATE UNIQUE INDEX "FotofficeWaConexion_workspaceId_key" ON "FotofficeWaConexion"("workspaceId")`,
      `CREATE UNIQUE INDEX "FotofficeWaConexion_phoneNumberId_key" ON "FotofficeWaConexion"("phoneNumberId")`,
      `CREATE UNIQUE INDEX "FotofficeWaChat_workspaceId_waId_key" ON "FotofficeWaChat"("workspaceId", "waId")`,
      `ON "FotofficeWaChat"("workspaceId", "estado", "ultimoMensajeEn")`,
      `ON "FotofficeWaChat"("workspaceId", "asignadoUserId")`,
      `ON "FotofficeWaChat"("clientId")`,
      `CREATE UNIQUE INDEX "FotofficeWaMensaje_workspaceId_waMessageId_key" ON "FotofficeWaMensaje"("workspaceId", "waMessageId")`,
      `CREATE UNIQUE INDEX "FotofficeWaMensaje_chatId_clientToken_key" ON "FotofficeWaMensaje"("chatId", "clientToken")`,
      `ON "FotofficeWaMensaje"("chatId", "createdAt")`,
    ]) expect(sql).toContain(idx);
  });

  it("FKs: workspace y chat en cascada, cliente en SET NULL", () => {
    const fk = (t: string, col: string, dest: string, accion: string) =>
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE "${t}" ADD CONSTRAINT "${t}_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${dest}"\\("id"\\) ON DELETE ${accion}`),
      );
    for (const t of TABLAS) fk(t, "workspaceId", "Workspace", "CASCADE");
    fk("FotofficeWaMensaje", "chatId", "FotofficeWaChat", "CASCADE");
    fk("FotofficeWaChat", "clientId", "Client", "SET NULL");
  });

  it("defaults del diseño", () => {
    expect(sql).toContain(`"modo" TEXT NOT NULL DEFAULT 'SIMULADO'`);
    expect(sql).toContain(`"pausaBotHoras" INTEGER NOT NULL DEFAULT 4`);
    expect(sql).toContain(`"estado" TEXT NOT NULL DEFAULT 'BOT'`);
    expect(sql).toContain(`"noLeidos" INTEGER NOT NULL DEFAULT 0`);
  });

  it("el esquema coincide y las tablas existentes sólo reciben relaciones inversas", () => {
    expect(modelo("FotofficeWaChat")).toContain("@@unique([workspaceId, waId])");
    expect(modelo("FotofficeWaChat")).toContain("@@index([workspaceId, estado, ultimoMensajeEn])");
    expect(modelo("FotofficeWaMensaje")).toContain("@@unique([workspaceId, waMessageId])");
    expect(modelo("FotofficeWaMensaje")).toContain("@@unique([chatId, clientToken])");
    expect(modelo("FotofficeWaMensaje")).toMatch(/clientToken\s+String\?/);
    expect(sql).toContain('"clientToken" TEXT,');
    expect(modelo("FotofficeWaMensaje")).toContain("@@index([chatId, createdAt])");
    expect(modelo("Workspace")).toMatch(/fotofficeWaConexion\s+FotofficeWaConexion\?/);
    expect(modelo("Workspace")).toMatch(/fotofficeWaChats\s+FotofficeWaChat\[\]/);
    expect(modelo("Client")).toMatch(/fotofficeWaChats\s+FotofficeWaChat\[\]/);
  });
});
