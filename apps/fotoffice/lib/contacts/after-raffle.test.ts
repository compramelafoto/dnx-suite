import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ list: vi.fn(), sync: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./settings", () => ({ listWorkspacesWithContactSync: H.list }));
vi.mock("./sync", () => ({ syncWorkspaceContacts: H.sync }));

import { syncContactsAfterRosterClose } from "./after-raffle";

describe("la agenda al cerrar el padrón del sorteo", () => {
  beforeEach(() => {
    H.list.mockReset().mockResolvedValue(["ws_sfpr"]);
    H.sync.mockReset().mockResolvedValue({ quedaronCambiosSinAplicar: false });
  });

  it("sincroniza sólo las instituciones que cerraron y tienen Contacts encendido", async () => {
    const r = await syncContactsAfterRosterClose(["ws_sfpr", "ws_otra"]);
    expect(H.sync).toHaveBeenCalledTimes(1);
    expect(H.sync).toHaveBeenCalledWith("ws_sfpr");
    expect(r).toEqual([{ workspaceId: "ws_sfpr", ok: true }]);
  });

  it("sin sorteos sellados no consulta nada", async () => {
    expect(await syncContactsAfterRosterClose([])).toEqual([]);
    expect(H.list).not.toHaveBeenCalled();
  });

  it("si Google falla, no lanza: el sorteo sigue", async () => {
    H.sync.mockRejectedValue(new Error("Google no contesta"));
    await expect(syncContactsAfterRosterClose(["ws_sfpr"])).resolves.toEqual([
      { workspaceId: "ws_sfpr", ok: false },
    ]);
  });

  it("si ni siquiera se puede leer la configuración, tampoco lanza", async () => {
    H.list.mockRejectedValue(new Error("base caída"));
    await expect(syncContactsAfterRosterClose(["ws_sfpr"])).resolves.toEqual([]);
  });
});
