import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const masterKeyBase64 = randomBytes(32).toString("base64");

type Row = Record<string, unknown>;
type ClaveUnica = { workspaceId_integrationKey: { workspaceId: string; integrationKey: string } };

const db = { rows: [] as Row[] };

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceIntegration: {
      upsert: vi.fn(async ({ create }: { create: Row }) => {
        db.rows = db.rows.filter(
          (r) => r.workspaceId !== create.workspaceId || r.integrationKey !== create.integrationKey,
        );
        db.rows.push({ ...create, connectedAt: new Date(), lastUsedAt: null });
        return create;
      }),
      findUnique: vi.fn(async ({ where }: { where: ClaveUnica }) => {
        const key = where.workspaceId_integrationKey;
        return (
          db.rows.find(
            (r) => r.workspaceId === key.workspaceId && r.integrationKey === key.integrationKey,
          ) ?? null
        );
      }),
      findMany: vi.fn(async ({ where }: { where: { workspaceId: string } }) =>
        db.rows.filter((r) => r.workspaceId === where.workspaceId),
      ),
      update: vi.fn(async ({ where, data }: { where: ClaveUnica; data: Row }) => {
        const key = where.workspaceId_integrationKey;
        const row = db.rows.find(
          (r) => r.workspaceId === key.workspaceId && r.integrationKey === key.integrationKey,
        );
        if (row) Object.assign(row, data);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: ClaveUnica }) => {
        const key = where.workspaceId_integrationKey;
        db.rows = db.rows.filter(
          (r) => r.workspaceId !== key.workspaceId || r.integrationKey !== key.integrationKey,
        );
        return null;
      }),
    },
  },
}));

import {
  deleteIntegration,
  getIntegrationSummary,
  markIntegrationNeedsReconsent,
  readRefreshToken,
  saveIntegration,
} from "./store";

const entrada = {
  workspaceId: "ws-1",
  integrationKey: "google-calendar",
  provider: "GOOGLE",
  accountEmail: "sfpr@gmail.com",
  accountExternalId: "10293",
  grantedScopes: ["https://www.googleapis.com/auth/calendar.events"],
  refreshToken: "1//refresh-secretisimo",
  connectedByUserId: 7,
};

describe("almacén de integraciones", () => {
  beforeEach(() => {
    db.rows = [];
    process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY = masterKeyBase64;
  });

  it("guarda la credencial cifrada: el token no queda en ninguna columna", async () => {
    await saveIntegration(entrada);
    const guardado = JSON.stringify(db.rows[0]);
    expect(guardado).not.toContain(entrada.refreshToken);
    expect(guardado).toContain("sfpr@gmail.com");
  });

  it("lo guardado se recupera igual", async () => {
    await saveIntegration(entrada);
    expect(await readRefreshToken("ws-1", "google-calendar")).toBe(entrada.refreshToken);
  });

  it("el resumen no expone la credencial", async () => {
    await saveIntegration(entrada);
    const resumen = await getIntegrationSummary("ws-1", "google-calendar");
    expect(resumen?.accountEmail).toBe("sfpr@gmail.com");
    expect(resumen?.status).toBe("ACTIVE");
    expect(JSON.stringify(resumen)).not.toContain(entrada.refreshToken);
    expect(Object.keys(resumen ?? {})).not.toContain("ciphertext");
  });

  it("reconectar la misma integración reemplaza la credencial, no acumula filas", async () => {
    await saveIntegration(entrada);
    await saveIntegration({ ...entrada, refreshToken: "1//nuevo" });
    expect(db.rows).toHaveLength(1);
    expect(await readRefreshToken("ws-1", "google-calendar")).toBe("1//nuevo");
  });

  it("un workspace no ve la integración de otro", async () => {
    await saveIntegration(entrada);
    expect(await getIntegrationSummary("ws-2", "google-calendar")).toBeNull();
    expect(await readRefreshToken("ws-2", "google-calendar")).toBeNull();
  });

  it("marcar que necesita reconexión no borra la fila", async () => {
    await saveIntegration(entrada);
    await markIntegrationNeedsReconsent("ws-1", "google-calendar");
    expect((await getIntegrationSummary("ws-1", "google-calendar"))?.status).toBe(
      "NEEDS_RECONSENT",
    );
  });

  it("desconectar devuelve la credencial para poder revocarla, y borra la fila", async () => {
    await saveIntegration(entrada);
    expect(await deleteIntegration("ws-1", "google-calendar")).toBe(entrada.refreshToken);
    expect(db.rows).toHaveLength(0);
    expect(await deleteIntegration("ws-1", "google-calendar")).toBeNull();
  });

  it("sin clave maestra no se guarda nada", async () => {
    delete process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY;
    await expect(saveIntegration(entrada)).rejects.toThrow();
    expect(db.rows).toHaveLength(0);
  });
});
