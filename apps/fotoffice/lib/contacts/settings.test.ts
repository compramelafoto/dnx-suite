import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const findMany = vi.fn();
const update = vi.fn();
const updateMany = vi.fn();

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceContactSyncSetting: {
      upsert: (...args: unknown[]) => upsert(...args),
      findMany: (...args: unknown[]) => findMany(...args),
      update: (...args: unknown[]) => update(...args),
    },
    workspaceContactLink: {
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
  },
}));

const { listWorkspacesWithContactSync, setContactSyncEnabled } = await import("./settings");
const { updateLink } = await import("./links");

beforeEach(() => {
  upsert.mockReset();
  findMany.mockReset();
  update.mockReset();
  updateMany.mockReset();
});

describe("encender el interruptor", () => {
  it("deja registrado quién lo encendió y cuándo", async () => {
    // Encender esto sube datos personales de terceros a una cuenta de Google: tiene que
    // quedar constancia de quién tomó esa decisión.
    upsert.mockResolvedValue({});
    await setContactSyncEnabled({
      workspaceId: "w-1",
      moduleKey: "members",
      enabled: true,
      userId: 7,
    });
    const args = upsert.mock.calls[0][0];
    expect(args.create.enabledByUserId).toBe(7);
    expect(args.create.enabledAt).toBeInstanceOf(Date);
    expect(args.update.enabled).toBe(true);
  });

  it("apagarlo NO borra el grupo ni los contactos ya agendados", async () => {
    upsert.mockResolvedValue({});
    await setContactSyncEnabled({
      workspaceId: "w-1",
      moduleKey: "members",
      enabled: false,
      userId: 7,
    });
    const args = upsert.mock.calls[0][0];
    expect(args.update.enabled).toBe(false);
    // El grupo se conserva: si vuelven a encenderlo, los contactos siguen donde estaban.
    expect(args.update.googleGroupResourceName).toBeUndefined();
  });
});

describe("a quién hay que sincronizar", () => {
  it("solo los workspaces con algún módulo encendido", async () => {
    findMany.mockResolvedValue([{ workspaceId: "w-1" }, { workspaceId: "w-2" }]);
    await expect(listWorkspacesWithContactSync()).resolves.toEqual(["w-1", "w-2"]);
    expect(findMany.mock.calls[0][0].where).toEqual({ enabled: true });
  });

  it("un workspace con dos módulos encendidos aparece una sola vez", async () => {
    // Si apareciera dos veces, la corrida leería la agenda entera dos veces por cuota.
    findMany.mockResolvedValue([{ workspaceId: "w-1" }, { workspaceId: "w-1" }]);
    await expect(listWorkspacesWithContactSync()).resolves.toEqual(["w-1"]);
  });

  it("nadie encendido devuelve lista vacía, no rompe", async () => {
    findMany.mockResolvedValue([]);
    await expect(listWorkspacesWithContactSync()).resolves.toEqual([]);
  });
});

describe("aislamiento de vínculos por workspace", () => {
  it("updateLink filtra por workspaceId e id, no toca datos de otro workspace", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await updateLink("w-1", "link-123", { status: "SYNCED" });
    const args = updateMany.mock.calls[0][0];
    expect(args.where).toEqual({ workspaceId: "w-1", id: "link-123" });
    expect(args.data).toEqual({ status: "SYNCED" });
  });
});
