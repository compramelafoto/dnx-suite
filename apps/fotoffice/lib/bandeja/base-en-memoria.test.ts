import { describe, expect, it } from "vitest";
import { crearBaseEnMemoria } from "@/lib/circuitos/base-en-memoria";

describe("base en memoria: tablas de la Bandeja", () => {
  it("aplica los defaults y los únicos de la migración", async () => {
    const prisma = crearBaseEnMemoria().prisma as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const chat = await prisma.fotofficeWaChat.create({ data: { workspaceId: "w1", waId: "5493413419869", ultimoMensajeEn: new Date() } });
    expect(chat).toMatchObject({ estado: "BOT", noLeidos: 0, asignadoUserId: null, clientId: null });
    await expect(
      prisma.fotofficeWaChat.create({ data: { workspaceId: "w1", waId: "5493413419869", ultimoMensajeEn: new Date() } }),
    ).rejects.toMatchObject({ code: "P2002" });
    // Otro workspace, mismo teléfono: permitido.
    await prisma.fotofficeWaChat.create({ data: { workspaceId: "w2", waId: "5493413419869", ultimoMensajeEn: new Date() } });

    const base = { workspaceId: "w1", chatId: chat.id, direccion: "ENTRANTE", autor: "CLIENTE" };
    const m = await prisma.fotofficeWaMensaje.create({ data: { ...base, waMessageId: "wamid.1" } });
    expect(m).toMatchObject({ tipo: "TEXTO", estadoEnvio: "RECIBIDO" });
    await expect(prisma.fotofficeWaMensaje.create({ data: { ...base, waMessageId: "wamid.1" } })).rejects.toMatchObject({ code: "P2002" });
    // Sin waMessageId (mensajes de sistema) no chocan entre sí.
    await prisma.fotofficeWaMensaje.create({ data: base });
    await prisma.fotofficeWaMensaje.create({ data: base });
  });

  it("la conexión es una por workspace y el phoneNumberId sólo choca con valor", async () => {
    const prisma = crearBaseEnMemoria().prisma as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const c = await prisma.fotofficeWaConexion.create({ data: { workspaceId: "w1" } });
    expect(c).toMatchObject({ modo: "SIMULADO", pausaBotHoras: 4 });
    await expect(prisma.fotofficeWaConexion.create({ data: { workspaceId: "w1" } })).rejects.toMatchObject({ code: "P2002" });
    await prisma.fotofficeWaConexion.create({ data: { workspaceId: "w2" } });
    await prisma.fotofficeWaConexion.create({ data: { workspaceId: "w3", phoneNumberId: "99" } });
    await expect(prisma.fotofficeWaConexion.create({ data: { workspaceId: "w4", phoneNumberId: "99" } })).rejects.toMatchObject({ code: "P2002" });
  });
});
