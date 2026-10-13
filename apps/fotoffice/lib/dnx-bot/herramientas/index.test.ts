import { describe, expect, it } from "vitest";
import { toInputSchema } from "@repo/dnx-bot";
import type { CtxBot } from "../acceso";
import { herramientasPara } from "./index";

function ctx(capacidades: CtxBot["capacidades"]): CtxBot {
  return {
    workspaceId: "ws1",
    workspaceNombre: "DNX Estudio",
    userId: 7,
    userLabel: "Daniel",
    role: capacidades.configurar ? "WORKSPACE_OWNER" : "STAFF",
    email: "d@x.test",
    nombre: "Daniel",
    capacidades,
    plataforma: "FOTOFFICE:ws1",
  };
}
const PERFILES = [
  ctx({ configurar: true, gestionarPresupuestos: true, verConsultas: true }),
  ctx({ configurar: false, gestionarPresupuestos: true, verConsultas: true }),
  ctx({ configurar: false, gestionarPresupuestos: false, verConsultas: false }),
];

describe("herramientasPara", () => {
  it("todo esquema convierte a JSON Schema de objeto", () => {
    for (const c of PERFILES) for (const t of herramientasPara(c)) expect(toInputSchema(t.input).type, t.name).toBe("object");
  });
  it("nombres únicos; las de escritura tienen describe", () => {
    for (const c of PERFILES) {
      const tools = herramientasPara(c);
      expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length);
      for (const t of tools.filter((x) => x.kind === "write")) expect(t.describe, t.name).toBeTypeOf("function");
    }
  });
  it("no hay herramienta de envío", () => {
    for (const c of PERFILES) for (const t of herramientasPara(c)) expect(t.name).not.toMatch(/enviar|mandar|whatsapp|correo/i);
  });
  it("quien no configura nunca recibe más herramientas que el dueño", () => {
    const [dueno, staff] = PERFILES.map((c) => herramientasPara(c).map((t) => t.name));
    for (const n of staff!) expect(dueno).toContain(n);
  });
});
