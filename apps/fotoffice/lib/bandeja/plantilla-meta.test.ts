import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { enviarPlantilla } = await import("./plantilla-meta");

const CONEXION = { workspaceId: "w1", modo: "REAL" as const, phoneNumberId: "299578913244973" };

describe("enviarPlantilla", () => {
  it("manda la plantilla con los parámetros del cuerpo y del botón, al número sin el 9", async () => {
    let cuerpo: Record<string, unknown> = {};
    const f = (async (_u: string, init?: RequestInit) => {
      cuerpo = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ messages: [{ id: "wamid.X" }] }));
    }) as typeof fetch;
    const r = await enviarPlantilla(CONEXION, "5493413748324", { nombre: "seguimiento_cotizacion", idioma: "es_AR", cuerpo: ["Lucía", "tus 15"], boton: "w/dnx/presupuesto/abc" }, { fetch: f, leerToken: async () => "t" });
    expect(r).toEqual({ ok: true, simulado: false, waMessageId: "wamid.X" });
    expect(cuerpo).toMatchObject({
      to: "543413748324",
      type: "template",
      template: {
        name: "seguimiento_cotizacion",
        language: { code: "es_AR" },
        components: [
          { type: "body", parameters: [{ type: "text", text: "Lucía" }, { type: "text", text: "tus 15" }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "w/dnx/presupuesto/abc" }] },
        ],
      },
    });
  });

  it("devuelve el código de Meta si la rechaza (por ejemplo, plantilla todavía no aprobada)", async () => {
    const f = (async () => new Response(JSON.stringify({ error: { code: 132001 } }), { status: 400 })) as typeof fetch;
    expect(await enviarPlantilla(CONEXION, "5493413748324", { nombre: "x", idioma: "es_AR", cuerpo: [] }, { fetch: f, leerToken: async () => "t" })).toEqual({ ok: false, codigo: "132001" });
  });
});
