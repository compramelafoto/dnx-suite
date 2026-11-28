import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/telegram/credentials", () => ({ leerTokenTelegram: vi.fn(), guardarTokenTelegram: vi.fn(), borrarTokenTelegram: vi.fn(), hayTokenTelegram: vi.fn() }));

const C = await import("./conexion");

beforeEach(() => B.vaciar());

describe("nuevoCodigoTelegram", () => {
  it("quien genera el código para vincular su celular pasa a ser el dueño del chat (le llegan sus chats de la Bandeja)", async () => {
    B.agregar("fotofficeTelegramConexion", { id: "cx1", workspaceId: "w1", botId: "1", botUsername: "bot", webhookSecretHash: "h", connectedByUserId: 4 });
    const ctx = { workspaceId: "w1", userId: 9, userLabel: "Admin", role: "WORKSPACE_ADMIN", acceso: { role: "WORKSPACE_ADMIN", levels: {} } as never };
    expect(await C.nuevoCodigoTelegram(ctx)).toEqual({ ok: true });
    expect(B.datos.fotofficeTelegramConexion[0].connectedByUserId).toBe(9);
  });
});
