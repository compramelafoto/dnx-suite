import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { seguirCotizacionesPorWhatsapp } = await import("./seguimiento-whatsapp-servidor");
type Deps = NonNullable<Parameters<typeof seguirCotizacionesPorWhatsapp>[0]>;

const AHORA = new Date("2026-11-20T13:00:00Z");
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000);
const CAND = {
  aprobacionId: "a1", workspaceId: "w1", waId: "5493410000000", enviadaEn: hace(3), nombre: "Lucía Pérez", categoria: "15 años",
  abierta: true, ruta: "w/dnx-estudio/presupuesto/tok", chat: { id: "c1", estado: "BOT", ultimoEntranteEn: hace(3.1) }, yaEnviados: 0,
};

function deps(extra: Partial<Deps> = {}) {
  const plantilla = vi.fn(async () => ({ ok: true as const, simulado: false as const, waMessageId: "wamid" }));
  const marcar = vi.fn(async () => undefined);
  const d: Deps = { ahora: AHORA, candidatos: async () => [CAND], plantilla, marcar, ...extra };
  return { d, plantilla, marcar };
}

describe("seguirCotizacionesPorWhatsapp", () => {
  it("manda la plantilla con nombre, evento y la ruta del botón, y lo deja anotado", async () => {
    const { d, plantilla, marcar } = deps();
    expect(await seguirCotizacionesPorWhatsapp(d)).toEqual({ revisadas: 1, enviadas: 1, fallidas: 0 });
    expect(plantilla).toHaveBeenCalledWith("w1", "5493410000000", { nombre: "seguimiento_cotizacion", idioma: "es_AR", cuerpo: ["Lucía", "tus 15"], boton: "w/dnx-estudio/presupuesto/tok" }, "c1");
    expect(marcar).toHaveBeenCalledWith("w1", "c1", "Seguimiento de cotización 1 enviado por WhatsApp");
  });

  it("si Meta rechaza la plantilla (todavía no aprobada) no lo anota: se reintenta al día siguiente", async () => {
    const { d, marcar } = deps({ plantilla: async () => ({ ok: false as const, codigo: "132001" }) });
    expect(await seguirCotizacionesPorWhatsapp(d)).toEqual({ revisadas: 1, enviadas: 0, fallidas: 1 });
    expect(marcar).not.toHaveBeenCalled();
  });

  it("en modo prueba no manda nada y devuelve a quién le escribiría", async () => {
    const { d, plantilla, marcar } = deps({ prueba: true });
    const r = await seguirCotizacionesPorWhatsapp(d);
    expect(r).toMatchObject({ revisadas: 1, enviadas: 0, prueba: [{ aprobacionId: "a1", numero: 1 }] });
    expect(plantilla).not.toHaveBeenCalled();
    expect(marcar).not.toHaveBeenCalled();
  });

  it("no le escribe a quien respondió después de recibir la cotización ni a un chat que atiende una persona", async () => {
    const respondio = deps({ candidatos: async () => [{ ...CAND, chat: { ...CAND.chat, ultimoEntranteEn: hace(1) } }] });
    expect(await seguirCotizacionesPorWhatsapp(respondio.d)).toMatchObject({ enviadas: 0 });
    expect(respondio.plantilla).not.toHaveBeenCalled();
    const persona = deps({ candidatos: async () => [{ ...CAND, chat: { ...CAND.chat, estado: "HUMANO" } }] });
    expect(await seguirCotizacionesPorWhatsapp(persona.d)).toMatchObject({ enviadas: 0 });
  });
});
