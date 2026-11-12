import { describe, expect, it } from "vitest";
import { decidirSeguimiento, horarioDeSeguimiento, MARCA_SEGUIMIENTO_CONSULTA, pasoPrecio, textoSeguimientoConsulta, type MensajeDelChat } from "./seguimiento-consulta";

describe("pasoPrecio", () => {
  it("reconoce un mensaje del bot con precios", () => {
    expect(pasoPrecio("La copia 10x15 sale $ 1.200 cada una.")).toBe(true);
    expect(pasoPrecio("Son $15.000 en total")).toBe(true);
  });
  it("no confunde mensajes sin importes", () => {
    expect(pasoPrecio("¿Qué medida querés?")).toBe(false);
    expect(pasoPrecio(null)).toBe(false);
  });
});

describe("textoSeguimientoConsulta", () => {
  it("corto, con el nombre de pila y una sola pregunta", () => {
    const t = textoSeguimientoConsulta("Ana María López");
    expect(t.startsWith("¡Hola Ana!")).toBe(true);
    expect(t.length).toBeLessThan(200);
    expect(t.match(/\?/g)?.length).toBe(1);
  });
  it("dice de qué hablaron cuando se sabe, y nunca ofrece el enlace para pagar", () => {
    expect(textoSeguimientoConsulta("Lucía Gómez", "las copias")).toBe("¡Hola Lucía! 😊 ¿Pudiste pensar lo de las copias? Si querés, te lo dejo armado.");
    expect(textoSeguimientoConsulta("Lucía", "el cuadro")).toContain("lo del cuadro?");
    expect(textoSeguimientoConsulta("Lucía")).toBe("¡Hola Lucía! 😊 ¿Pudiste ver lo que te pasé? Si querés, te lo dejo armado.");
    expect(textoSeguimientoConsulta("Lucía")).not.toContain("enlace");
  });
  it("sin nombre saluda igual", () => {
    expect(textoSeguimientoConsulta(null).startsWith("¡Hola!")).toBe(true);
  });
  it("la marca es fija (sirve para no repetirlo)", () => {
    expect(MARCA_SEGUIMIENTO_CONSULTA).toBe("Seguimiento de consulta enviado");
  });
});

const T0 = new Date("2026-10-28T15:00:00Z");
const m = (min: number, direccion: string, autor: string, texto: string | null): MensajeDelChat => ({ direccion, autor, texto, createdAt: new Date(T0.getTime() + min * 60_000) });
const cliente = (min: number, texto: string) => m(min, "ENTRANTE", "CLIENTE", texto);
const bot = (min: number, texto: string) => m(min, "SALIENTE", "BOT", texto);
const PRECIO_COPIAS = "Son 20 copias 10x15 a $900: $18.000. ¿Querés que te arme el pedido? 😊";

describe("decidirSeguimiento", () => {
  it("sale cuando el bot pasó el precio de copias y el cliente no volvió a escribir; dice el tema", () => {
    expect(decidirSeguimiento([cliente(0, "cuánto salen 20 copias 10x15?"), bot(1, PRECIO_COPIAS)])).toEqual({ desde: new Date(T0.getTime() + 60_000), tema: "las copias" });
    expect(decidirSeguimiento([bot(1, "El cuadro canvas 30x40 sale $25.000 😊")])?.tema).toBe("el cuadro");
  });

  it("sin precio del bot no hay seguimiento", () => {
    expect(decidirSeguimiento([cliente(0, "hola"), bot(1, "¡Hola! ¿En qué te puedo ayudar?")])).toBeNull();
  });

  it("no sale para foto carnet ni para lo que se hace en el local ('sin turno', 'venir')", () => {
    expect(decidirSeguimiento([bot(1, "La foto carnet sale $6.000, no hace falta turno 😊")])).toBeNull();
    expect(decidirSeguimiento([bot(1, "Las 4 fotos para el DNI salen $6.000, sin turno 😊")])).toBeNull();
    expect(decidirSeguimiento([bot(1, "Sale $6.000. Podés venir hoy hasta las 19 😊")])).toBeNull();
    expect(decidirSeguimiento([bot(1, "Sale $6.000. ¿Venís hoy? 😊")])).toBeNull();
  });

  it("no sale si el precio no es de un producto o de algo para armar un pedido", () => {
    expect(decidirSeguimiento([bot(1, "La sesión de estudio sale $40.000 😊")])).toBeNull();
  });

  it("no sale si el cliente dijo después que ya fue o ya lo resolvió", () => {
    for (const t of ["Ya fui, gracias!", "ya lo resolví 🙌", "Ya las retiré", "no, gracias"]) {
      expect(decidirSeguimiento([bot(1, PRECIO_COPIAS), cliente(2, t)])).toBeNull();
    }
    expect(decidirSeguimiento([bot(1, PRECIO_COPIAS), cliente(2, "dale, lo pienso")])).not.toBeNull();
  });

  it("no sale si una persona del estudio escribió después (Bandeja o celular)", () => {
    expect(decidirSeguimiento([bot(1, PRECIO_COPIAS), m(5, "SALIENTE", "USUARIO", "Hola, soy Cami del estudio")])).toBeNull();
    expect(decidirSeguimiento([bot(1, PRECIO_COPIAS), m(5, "SALIENTE", "CELULAR", "Te espero mañana")])).toBeNull();
  });

  it("no sale si el chat pasó a una persona o alguien lo tomó después del precio", () => {
    expect(decidirSeguimiento([bot(1, PRECIO_COPIAS), m(2, "SISTEMA", "SISTEMA", "El bot pasó el chat a una persona: factura")])).toBeNull();
    expect(decidirSeguimiento([bot(1, PRECIO_COPIAS), m(2, "SISTEMA", "SISTEMA", "Cami tomó el chat")])).toBeNull();
    // Lo de antes del precio no cuenta.
    expect(decidirSeguimiento([m(0, "SISTEMA", "SISTEMA", "Cami tomó el chat"), bot(1, PRECIO_COPIAS)])).not.toBeNull();
  });

  it("vale el último mensaje del bot con precio", () => {
    expect(decidirSeguimiento([bot(1, PRECIO_COPIAS), cliente(2, "y la foto carnet?"), bot(3, "La foto carnet sale $6.000, sin turno 😊")])).toBeNull();
  });
});

describe("horarioDeSeguimiento", () => {
  it("de 9 a 20 h de Argentina (UTC−3)", () => {
    expect(horarioDeSeguimiento(new Date("2026-10-29T08:30:00Z"))).toBe(false); // 05:30
    expect(horarioDeSeguimiento(new Date("2026-10-29T11:59:00Z"))).toBe(false); // 08:59
    expect(horarioDeSeguimiento(new Date("2026-10-29T12:00:00Z"))).toBe(true); // 09:00
    expect(horarioDeSeguimiento(new Date("2026-10-29T22:59:00Z"))).toBe(true); // 19:59
    expect(horarioDeSeguimiento(new Date("2026-10-29T23:00:00Z"))).toBe(false); // 20:00
  });
});
