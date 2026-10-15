import { describe, expect, it } from "vitest";
import { saludoComprador } from "./saludo";

const TOKEN = "a1".repeat(32);

describe("saludoComprador", () => {
  it("álbum: ayuda a encontrar y comprar, con globito a los 20 s", () => {
    for (const p of [{ tipo: "album", slug: "x" }, { tipo: "album_id", albumId: 3, photoId: null }] as const) {
      const s = saludoComprador(p);
      expect(s.saludo).toBe("Hola, soy DNX Bot. Te ayudo a encontrar tus fotos o a elegir qué comprar.");
      expect(s.sugerencias).toEqual(["¿Cómo encuentro mis fotos?", "¿Cuánto salen las fotos?", "¿Hay packs o descuentos?"]);
      expect(s.globitoDemoraMs).toBe(20000);
      expect(s.globito).toEqual({
        campaign: "comprador_album",
        texto: "¿Te ayudo a encontrar tus fotos o a elegir un pack?",
        botones: [
          { label: "Encontrar mis fotos", mensaje: "¿Cómo encuentro mis fotos en este álbum?", accion: "CLICKED" },
          { label: "Elegir un pack", mensaje: "¿Qué packs o descuentos tiene este álbum?", accion: "CLICKED" },
        ],
      });
    }
  });

  it("página de quitar una foto: sugerencias propias", () => {
    const s = saludoComprador({ tipo: "album_id", albumId: 3, photoId: 9 });
    expect(s.sugerencias).toEqual(["Quiero que saquen esta foto", "¿Cuánto tarda?"]);
  });

  it("descarga: globito a los 20 s", () => {
    const s = saludoComprador({ tipo: "descarga", token: TOKEN });
    expect(s.saludo).toBe("Hola, soy DNX Bot. ¿Problemas para bajar tus fotos?");
    expect(s.sugerencias).toEqual(["No puedo bajar el ZIP", "Se me venció el enlace", "Reenviame el enlace por mail"]);
    expect(s.globitoDemoraMs).toBe(20000);
    expect(s.globito).toEqual({
      campaign: "comprador_descarga",
      texto: "¿Problemas para bajar tus fotos?",
      botones: [{ label: "Sí, ayudame", mensaje: "Tengo problemas para bajar mis fotos", accion: "CLICKED" }],
    });
    expect(JSON.stringify(s)).not.toContain(TOKEN);
  });

  it("pack y recuperar pack: sin globito", () => {
    for (const p of [{ tipo: "pack", token: "x".repeat(30) }, { tipo: "recuperar_pack" }] as const) {
      const s = saludoComprador(p);
      expect(s.saludo).toBe("Hola, soy DNX Bot. Te ayudo con tu pack de preventa.");
      expect(s.sugerencias).toEqual(["¿Cómo elijo mis fotos?", "No me llegó el enlace del pack", "El alumno está mal cargado"]);
      expect(s.globito).toBeNull();
      expect(s.globitoDemoraMs).toBeNull();
    }
  });

  it("pago: sin globito; sugerencias según el resultado", () => {
    for (const resultado of ["failure", "pending"] as const) {
      const s = saludoComprador({ tipo: "pago", resultado, orderId: 4 });
      expect(s.saludo).toBe("Hola, soy DNX Bot. ¿Te ayudo con tu pago?");
      expect(s.sugerencias).toEqual(["¿En qué quedó mi pago?", "Quiero reintentar el pago", "Me cobraron dos veces"]);
      expect(s.globito).toBeNull();
      expect(s.globitoDemoraMs).toBeNull();
    }
    const ok = saludoComprador({ tipo: "pago", resultado: "success", orderId: 4 });
    expect(ok.saludo).toBe("Hola, soy DNX Bot. ¿Te ayudo con tu pago?");
    expect(ok.sugerencias).toEqual(["No me llegó el mail con las fotos", "¿Cuándo puedo descargar?"]);
    expect(ok.globito).toBeNull();
  });

  it("mis pedidos y soporte", () => {
    for (const p of [{ tipo: "mis_pedidos" }, { tipo: "soporte" }] as const) {
      const s = saludoComprador(p);
      expect(s.saludo).toBe("Hola, soy DNX Bot. ¿En qué te ayudo con tus compras?");
      expect(s.sugerencias).toEqual(["¿En qué quedó mi pedido?", "Reenviame el enlace de descarga", "Quiero que saquen una foto"]);
      expect(s.globito).toBeNull();
    }
  });

  it("los textos no llevan asteriscos", () => {
    const todos = [
      { tipo: "album", slug: "x" }, { tipo: "descarga", token: TOKEN }, { tipo: "pack", token: "x".repeat(30) },
      { tipo: "pago", resultado: "success", orderId: null }, { tipo: "mis_pedidos" },
    ] as const;
    for (const p of todos) expect(JSON.stringify(saludoComprador(p))).not.toContain("*");
  });
});
