import { describe, expect, it } from "vitest";
import { claveVisitas, debeOfrecerBot, MS_PARA_OFRECER, OFERTA, registrarVisita, type SenalesOferta } from "./oferta-perfil";

const base: SenalesOferta = { botDisponible: true, perfilCompleto: false, descartada: false, guardadoTrabado: false, msEnLaPagina: 0, visitasPrevias: 0 };

describe("debeOfrecerBot: sólo si parece trabado", () => {
  it("de entrada (primera visita, recién llegó, sin intentar guardar) no se ofrece", () => {
    expect(debeOfrecerBot(base)).toEqual({ ofrecer: false, motivo: null });
  });
  it("a · intentó guardar y no pudo (o quedó incompleto)", () => {
    expect(debeOfrecerBot({ ...base, guardadoTrabado: true })).toEqual({ ofrecer: true, motivo: "guardado" });
  });
  it("b · más de 4 minutos en la página sin completarlo", () => {
    expect(MS_PARA_OFRECER).toBe(4 * 60 * 1000);
    expect(debeOfrecerBot({ ...base, msEnLaPagina: MS_PARA_OFRECER - 1 }).ofrecer).toBe(false);
    expect(debeOfrecerBot({ ...base, msEnLaPagina: MS_PARA_OFRECER })).toEqual({ ofrecer: true, motivo: "tiempo" });
  });
  it("c · segunda visita (o más) con el perfil todavía incompleto", () => {
    expect(debeOfrecerBot({ ...base, visitasPrevias: 1 })).toEqual({ ofrecer: true, motivo: "visitas" });
  });
  it("nunca con el perfil completo, sin bot o si dijo «Prefiero seguir yo»", () => {
    const trabado = { ...base, guardadoTrabado: true, msEnLaPagina: MS_PARA_OFRECER, visitasPrevias: 3 };
    expect(debeOfrecerBot({ ...trabado, perfilCompleto: true }).ofrecer).toBe(false);
    expect(debeOfrecerBot({ ...trabado, botDisponible: false }).ofrecer).toBe(false);
    expect(debeOfrecerBot({ ...trabado, descartada: true }).ofrecer).toBe(false);
  });
});

describe("registrarVisita (localStorage por workspace)", () => {
  function almacen() {
    const d = new Map<string, string>();
    return { d, getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => void d.set(k, v), removeItem: (k: string) => void d.delete(k) };
  }
  it("cuenta las visitas con el perfil incompleto y devuelve cuántas hubo antes", () => {
    const a = almacen();
    expect(registrarVisita(a, "ws1", false)).toBe(0);
    expect(registrarVisita(a, "ws1", false)).toBe(1);
    expect(registrarVisita(a, "ws2", false)).toBe(0);
    expect(a.d.get(claveVisitas("ws1"))).toBe("2");
  });
  it("con el perfil completo se olvida la cuenta", () => {
    const a = almacen();
    registrarVisita(a, "ws1", false);
    expect(registrarVisita(a, "ws1", true)).toBe(0);
    expect(a.d.has(claveVisitas("ws1"))).toBe(false);
  });
  it("sin almacenamiento o con datos raros no rompe", () => {
    expect(registrarVisita(null, "ws1", false)).toBe(0);
    const roto = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("x"); }, removeItem: () => {} };
    expect(registrarVisita(roto, "ws1", false)).toBe(0);
    const a = almacen();
    a.d.set(claveVisitas("ws1"), "abc");
    expect(registrarVisita(a, "ws1", false)).toBe(0);
  });
});

describe("textos de la oferta", () => {
  it("los pedidos por Daniel", () => {
    expect(OFERTA.titulo).toBe("¿Se te complica completarlo?");
    expect(OFERTA.texto).toBe("Lo podemos armar conversando: te pregunto de a un dato y vos confirmás antes de guardar.");
    expect(OFERTA.boton).toBe("Armalo conversando");
    expect(OFERTA.descartar).toBe("Prefiero seguir yo");
    expect(OFERTA.mensajeAlBot).toBe("Quiero armar mi perfil de precios conversando.");
  });
});
