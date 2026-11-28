import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/access/acceso", () => ({ resolverAcceso: vi.fn() }));

const E = await import("./equipo");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;
const acceso = (nivel: "VIEW" | "MANAGE" | "NONE", role = "STAFF") => ({ role, levels: { "whatsapp-inbox": nivel } }) as never;

beforeEach(() => {
  B.vaciar();
  B.agregar("user", { id: 4, name: "Daniel", email: "d@x.com" });
  B.agregar("user", { id: 7, name: "Sabina", email: "s@x.com" });
  B.agregar("user", { id: 8, name: null, email: "leo@x.com" });
  B.agregar("user", { id: 9, name: "Nadie", email: "n@x.com" });
  for (const [userId, ws] of [[4, "w1"], [7, "w1"], [8, "w1"], [9, "w1"], [7, "w2"]] as const) B.agregar("workspaceMembership", { id: `${userId}-${ws}`, userId, workspaceId: ws, role: "STAFF" });
});

describe("personasDeLaBandeja", () => {
  it("quienes ven la Bandeja, por nombre, con si pueden atender", async () => {
    const niveles: Record<number, "VIEW" | "MANAGE" | "NONE"> = { 4: "MANAGE", 7: "MANAGE", 8: "VIEW", 9: "NONE" };
    const r = await E.personasDeLaBandeja("w1", { accesoDe: async (u) => acceso(niveles[u]) });
    expect(r).toEqual([
      { userId: 4, nombre: "Daniel", puedeOperar: true },
      { userId: 8, nombre: "leo@x.com", puedeOperar: false },
      { userId: 7, nombre: "Sabina", puedeOperar: true },
    ]);
  });
});

describe("contarAbiertosPorPersona", () => {
  it("cuenta los chats abiertos de cada persona del workspace", async () => {
    const c = (p: Record<string, unknown>) => P.fotofficeWaChat.create({ data: { workspaceId: "w1", waId: String(Math.random()), ultimoMensajeEn: new Date(), ...p } });
    await c({ estado: "HUMANO", asignadoUserId: 7 });
    await c({ estado: "HUMANO", asignadoUserId: 7 });
    await c({ estado: "HUMANO", asignadoUserId: 4 });
    await c({ estado: "RESUELTO", resueltoPorUserId: 4 });
    await P.fotofficeWaChat.create({ data: { workspaceId: "w2", waId: "x", estado: "HUMANO", asignadoUserId: 7, ultimoMensajeEn: new Date() } });
    const m = await E.contarAbiertosPorPersona("w1");
    expect(m.get(7)).toBe(2);
    expect(m.get(4)).toBe(1);
  });
});
