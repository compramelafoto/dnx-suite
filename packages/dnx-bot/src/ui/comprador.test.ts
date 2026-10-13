import { describe, expect, it } from "vitest";
import { debeMostrarGlobitoDiferido, estadoUrlComprador, marcarGlobitoVisto, paginaActual, textoTicket } from "./comprador";

function almacen() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}
describe("burbuja de compradores", () => {
  it("manda la página con su búsqueda", () => {
    expect(paginaActual("/pago/failure", "?orderId=8")).toBe("/pago/failure?orderId=8");
    expect(estadoUrlComprador("/api/bot/comprador", "/pago/failure", "?orderId=8")).toBe("/api/bot/comprador/estado?pagePath=%2Fpago%2Ffailure%3ForderId%3D8");
    expect(paginaActual("/a/1", "?" + "x".repeat(400)).length).toBe(300);
  });
  it("el globito se muestra una vez por visita", () => {
    const a = almacen();
    expect(debeMostrarGlobitoDiferido(a, "comprador_album")).toBe(true);
    marcarGlobitoVisto(a, "comprador_album");
    expect(debeMostrarGlobitoDiferido(a, "comprador_album")).toBe(false);
    expect(debeMostrarGlobitoDiferido(null, "comprador_album")).toBe(true);
  });
  it("textos del ticket: fotógrafos igual que siempre; compradores ven el error", () => {
    expect(textoTicket(200, { ticketId: 4 }, "fotografo")).toBe("Abrí el pedido de soporte #4. La respuesta te aparece en Soporte y te llega por mail.");
    expect(textoTicket(422, { error: "x" }, "fotografo")).toBe("No pude abrir el pedido. Escribinos desde Soporte.");
    expect(textoTicket(422, { error: "Para derivarte necesito tu mail." }, "comprador")).toBe("Para derivarte necesito tu mail.");
    expect(textoTicket(200, { ticketId: 4, reused: true }, "comprador")).toBe("Ya tenés abierto el caso #4. Te responden por mail.");
  });
  it("textos del ticket: el resto de los casos", () => {
    expect(textoTicket(200, { ticketId: 4, reused: true }, "fotografo")).toBe("Ya tenés abierto el pedido de soporte #4. La respuesta te aparece en Soporte y te llega por mail.");
    expect(textoTicket(429, { error: "Ya abriste muchos." }, "fotografo")).toBe("Ya abriste muchos.");
    expect(textoTicket(429, {}, "fotografo")).toBe("No pude abrir el pedido. Escribinos desde Soporte.");
    expect(textoTicket(500, {}, "fotografo")).toBe("No pude abrir el pedido. Escribinos desde Soporte.");
    expect(textoTicket(200, { ticketId: 7 }, "comprador")).toBe("Abrí el caso #7. Te responden por mail.");
    expect(textoTicket(429, { error: "Ya abriste un caso hace poco." }, "comprador")).toBe("Ya abriste un caso hace poco.");
    expect(textoTicket(500, {}, "comprador")).toBe("No pude abrir el caso. Probá de nuevo en un rato.");
  });
  it("el almacenamiento que falla no rompe nada", () => {
    const roto = {
      getItem: () => { throw new Error("bloqueado"); },
      setItem: () => { throw new Error("bloqueado"); },
      removeItem: () => { throw new Error("bloqueado"); },
    };
    expect(debeMostrarGlobitoDiferido(roto, "comprador_album")).toBe(true);
    expect(() => marcarGlobitoVisto(roto, "comprador_album")).not.toThrow();
    expect(() => marcarGlobitoVisto(null, "comprador_album")).not.toThrow();
  });
  it("cada campaña lleva su propia marca", () => {
    const a = almacen();
    marcarGlobitoVisto(a, "comprador_album");
    expect(debeMostrarGlobitoDiferido(a, "comprador_descarga")).toBe(true);
    expect(a.getItem("dnxbot:globito:comprador_album")).not.toBeNull();
  });
});
