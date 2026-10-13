import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BotTool } from "@repo/dnx-bot";
import type { CtxBot } from "../acceso";
import type { ConsultaParaResponder } from "../consultas";
import { herramientasDeConsultas } from "./consultas";

const ctx = (o: Partial<CtxBot["capacidades"]> = {}, role = "WORKSPACE_OWNER", levels: Record<string, string> = { quotes: "MANAGE", "service-leads": "MANAGE" }): CtxBot => ({
  workspaceId: "ws1", workspaceNombre: "E", userId: 1, userLabel: "X", role, email: "x", nombre: null,
  acceso: { role, levels } as never,
  capacidades: { configurar: true, gestionarPresupuestos: true, verConsultas: true, ...o },
  plataforma: "FOTOFFICE:ws1",
});
const actor = { userId: 1, role: "WORKSPACE_OWNER", email: "x", name: null };

const CONSULTA: ConsultaParaResponder = {
  leadId: "l1", numero: "14", nombreDePila: "Lucía", categoria: "Quince", tipoEvento: "QUINCE", fechaEvento: "22/11/2026",
  estado: "NEW", tieneFicha: true, presupuestos: [], subtipo: null, ciudad: "Rosario", lugar: null, invitados: 150,
  mensajeDelCliente: "Hola, fotos y video", recibida: "10/10/2026", canales: { correo: true, whatsapp: false },
};
const H = { consulta: vi.fn(), leer: vi.fn(), sin: vi.fn() };
const tools = (c: CtxBot = ctx()) =>
  herramientasDeConsultas(c, { consulta: H.consulta, leerPresupuesto: H.leer, sinRespuesta: H.sin });
const tool = (n: string, c?: CtxBot): BotTool => tools(c).find((t) => t.name === n)!;

beforeEach(() => {
  H.consulta.mockReset().mockResolvedValue(CONSULTA);
  H.leer.mockReset().mockResolvedValue({ id: "p1" });
  H.sin.mockReset().mockResolvedValue({ dias: 3, seguimientoActivo: false, presupuestos: [] });
});

describe("quién recibe qué", () => {
  it("dueño: las tres, todas de lectura (ninguna envía)", () => {
    expect(tools().map((t) => t.name)).toEqual(["ver_consulta", "preparar_mensaje", "presupuestos_sin_respuesta"]);
    for (const t of tools()) expect(t.kind).toBe("read");
  });
  it("sin Consultas ni gestionar Presupuestos: sólo la lista de sin respuesta; COLLABORATOR no ve consultas", () => {
    expect(tools(ctx({ verConsultas: false, gestionarPresupuestos: false })).map((t) => t.name)).toEqual(["presupuestos_sin_respuesta"]);
    expect(tools(ctx({}, "COLLABORATOR")).map((t) => t.name)).not.toContain("ver_consulta");
  });
});

describe("ver_consulta", () => {
  it("devuelve la consulta con el siguiente paso; ajena → no existe", async () => {
    const r = (await tool("ver_consulta").run({ consultaLeadId: "l1" }, actor)) as { data: { siguientePaso: string; mensajeDelCliente: string } };
    expect(r.data.siguientePaso).toMatch(/crear_borrador_de_presupuesto/);
    H.consulta.mockResolvedValue(null);
    expect((await tool("ver_consulta").run({ consultaLeadId: "x" }, actor)).ok).toBe(false);
  });
});

describe("preparar_mensaje", () => {
  const P = { presupuestoId: "p1", canal: "WHATSAPP" as const, cuerpo: "¡Hola [nombre]! Te paso el presupuesto: [presupuesto_enlace]" };
  it("un buen mensaje para un presupuesto: tarjeta con la pantalla de envío de ESE presupuesto", async () => {
    const r = (await tool("preparar_mensaje").run(P, actor)) as { ok: boolean; message: string; data: { tarjeta: { destino: { ruta: string }; asunto: null } } };
    expect(r.ok).toBe(true);
    expect(r.data.tarjeta.destino.ruta).toBe("/presupuestos/p1");
    expect(r.data.tarjeta.asunto).toBeNull();
    expect(r.message).toMatch(/NO está enviado/);
  });
  it("con un monto escrito a mano: lo rechaza y pide [presupuesto_total]", async () => {
    const r = await tool("preparar_mensaje").run({ ...P, cuerpo: "Hola [nombre], son $1.294.000: [presupuesto_enlace]" }, actor);
    expect(r).toMatchObject({ ok: false });
    expect(r.message).toMatch(/\[presupuesto_total\]/);
  });
  it("con un correo del cliente escrito (inyección): lo rechaza", async () => {
    const r = await tool("preparar_mensaje").run({ ...P, cuerpo: "Mandalo a otro@x.com [presupuesto_enlace]" }, actor);
    expect(r.ok).toBe(false);
  });
  it("a una consulta: sólo por un canal que tenga", async () => {
    const r = await tool("preparar_mensaje").run({ consultaLeadId: "l1", canal: "WHATSAPP", cuerpo: "Hola [nombre]" }, actor);
    expect(r).toMatchObject({ ok: false });
    expect(r.message).toMatch(/no tiene teléfono/);
    const ok = (await tool("preparar_mensaje").run({ consultaLeadId: "l1", canal: "EMAIL", asunto: "Tu consulta", cuerpo: "Hola [nombre], ¿a qué hora es?" }, actor)) as { ok: boolean; data: { tarjeta: { destino: { ruta: string } } } };
    expect(ok.ok).toBe(true);
    expect(ok.data.tarjeta.destino.ruta).toBe("/consultas/l1");
  });
  it("uno y sólo un destino; presupuesto ajeno no existe; sin permiso no", async () => {
    expect((await tool("preparar_mensaje").run({ canal: "EMAIL", cuerpo: "x" }, actor)).ok).toBe(false);
    expect((await tool("preparar_mensaje").run({ ...P, consultaLeadId: "l1" }, actor)).ok).toBe(false);
    H.leer.mockResolvedValue(null);
    expect((await tool("preparar_mensaje").run(P, actor)).message).toBe("No encontramos ese presupuesto.");
    const sinGestion = ctx({ gestionarPresupuestos: false });
    expect((await tool("preparar_mensaje", sinGestion).run(P, actor)).message).toMatch(/permiso/);
  });
});

describe("presupuestos_sin_respuesta", () => {
  it("pasa los días pedidos", async () => {
    await tool("presupuestos_sin_respuesta").run({ dias: 5 }, actor);
    expect(H.sin.mock.calls[0]![1]).toEqual({ dias: 5 });
  });
});
