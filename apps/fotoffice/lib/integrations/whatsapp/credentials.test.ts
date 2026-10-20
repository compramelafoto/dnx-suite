import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
type Clave = { workspaceId_integrationKey: { workspaceId: string; integrationKey: string } };
const db = { rows: [] as Row[] };
const buscar = (w: Clave) =>
  db.rows.find((r) => r.workspaceId === w.workspaceId_integrationKey.workspaceId && r.integrationKey === w.workspaceId_integrationKey.integrationKey);

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceIntegration: {
      upsert: vi.fn(async ({ create }: { create: Row }) => {
        db.rows = db.rows.filter((r) => r.workspaceId !== create.workspaceId || r.integrationKey !== create.integrationKey);
        db.rows.push({ ...create, connectedAt: new Date(), lastUsedAt: null });
        return create;
      }),
      findUnique: vi.fn(async ({ where }: { where: Clave }) => buscar(where) ?? null),
      delete: vi.fn(async ({ where }: { where: Clave }) => {
        db.rows = db.rows.filter((r) => r !== buscar(where));
        return null;
      }),
    },
  },
}));

const { guardarTokenWhatsapp, leerTokenWhatsapp, hayTokenWhatsapp, borrarTokenWhatsapp } = await import("./credentials");

beforeEach(() => {
  db.rows = [];
  process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY = randomBytes(32).toString("base64");
});

describe("token de WhatsApp en el baúl", () => {
  it("guarda cifrado y lo recupera igual, sólo para su workspace", async () => {
    await guardarTokenWhatsapp("w1", "EAAG-token-secreto");
    expect(JSON.stringify(db.rows)).not.toContain("EAAG-token-secreto");
    expect(db.rows[0]).toMatchObject({ provider: "WHATSAPP", integrationKey: "whatsapp" });
    expect(await leerTokenWhatsapp("w1")).toBe("EAAG-token-secreto");
    expect(await leerTokenWhatsapp("w2")).toBeNull();
    expect(await hayTokenWhatsapp("w1")).toBe(true);
  });

  it("reemplazar el token deja uno solo", async () => {
    await guardarTokenWhatsapp("w1", "uno");
    await guardarTokenWhatsapp("w1", "  dos  ");
    expect(db.rows).toHaveLength(1);
    expect(await leerTokenWhatsapp("w1")).toBe("dos");
  });

  it("un token vacío no se guarda", async () => {
    await expect(guardarTokenWhatsapp("w1", "   ")).rejects.toThrow();
    expect(db.rows).toHaveLength(0);
  });

  it("si cambió la clave maestra, leer devuelve null en vez de lanzar", async () => {
    await guardarTokenWhatsapp("w1", "tok");
    process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY = randomBytes(32).toString("base64");
    expect(await leerTokenWhatsapp("w1")).toBeNull();
  });

  it("borrar lo deja sin token", async () => {
    await guardarTokenWhatsapp("w1", "tok");
    await borrarTokenWhatsapp("w1");
    expect(await hayTokenWhatsapp("w1")).toBe(false);
  });
});
