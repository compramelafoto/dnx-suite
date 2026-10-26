import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ create: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { supportCaseToken: { create: (...a: unknown[]) => m.create(...a), findUnique: (...a: unknown[]) => m.find(...a) } } }));
import { buildSupportReplyEmail } from "@/emails/templates/support-reply";
import { crearTokenCaso, leerTokenCaso, urlDeCaso } from "./token-caso";

const now = new Date("2026-10-26T12:00:00Z");
const guardados = new Map<string, { ticketId: number; expiresAt: Date }>();
beforeEach(() => {
  guardados.clear();
  m.create.mockReset().mockImplementation(async ({ data }: { data: { tokenHash: string; ticketId: number; expiresAt: Date } }) => {
    guardados.set(data.tokenHash, data);
    return data;
  });
  m.find.mockReset().mockImplementation(async ({ where }: { where: { tokenHash: string } }) => guardados.get(where.tokenHash) ?? null);
});

describe("token del caso", () => {
  it("uno creado se lee; vence a los 30 días; uno inventado no sirve", async () => {
    const { token, expiresAt } = await crearTokenCaso(60, now);
    expect(expiresAt.toISOString()).toBe("2026-11-25T12:00:00.000Z");
    expect(await leerTokenCaso(token, now)).toEqual({ ticketId: 60 });
    expect(await leerTokenCaso(token, new Date(expiresAt.getTime() + 1))).toBeNull();
    expect(await leerTokenCaso("inventado", now)).toBeNull();
    expect(await leerTokenCaso("", now)).toBeNull();
  });

  it("en la base sólo queda el hash, nunca el token en claro", async () => {
    const { token } = await crearTokenCaso(60, now);
    const data = m.create.mock.calls[0]![0].data;
    expect(JSON.stringify(data)).not.toContain(token);
    expect(data.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it("fotógrafos van a su panel; el resto, a la página del caso", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.compramelafoto.com/";
    expect(urlDeCaso("abc", "PHOTOGRAPHER")).toBe("https://www.compramelafoto.com/fotografo/soporte?dnxbot_caso=abc");
    expect(urlDeCaso("abc", "LAB_PHOTOGRAPHER")).toBe("https://www.compramelafoto.com/fotografo/soporte?dnxbot_caso=abc");
    expect(urlDeCaso("abc", "CUSTOMER")).toBe("https://www.compramelafoto.com/caso/abc");
    expect(urlDeCaso("abc", null)).toBe("https://www.compramelafoto.com/caso/abc");
  });
});

describe("mail de respuesta", () => {
  const base = { requesterName: "Ana", ticketId: 60, message: "Hola <b>", supportUrl: "https://x/cliente/soporte" };
  it("con link del caso muestra el botón Responder y no el seguimiento viejo", () => {
    const { html } = buildSupportReplyEmail({ ...base, responderUrl: "https://x/caso/abc" });
    expect(html).toContain("Responder");
    expect(html).toContain("https://x/caso/abc");
    expect(html).not.toContain("Ver incidencia y hacer seguimiento");
    expect(html).toContain("Hola &lt;b&gt;");
  });
  it("sin link queda como hoy", () => {
    const { html } = buildSupportReplyEmail(base);
    expect(html).toContain("Ver incidencia y hacer seguimiento");
  });
});
