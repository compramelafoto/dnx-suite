import { describe, expect, it } from "vitest";
import { hashDeToken } from "@/lib/presupuestos/enlace";
import {
  DESCARGAS_INCLUIDAS, descargasRestantes, estadoDeEntrega, estadoVisibleDeEntrega, fechaArgentina, generacionDeEntrega, pesos, tituloDeVideo, tokenDeEntrega,
  recordatorioQueCorresponde, urlDeVideos, validarFranjas, leerFranjas, vencimientosDesde, videosVencidos,
} from "./entrega";

const g = (estado: string, conversionEstado: string | null) => ({ estado, conversionEstado });

describe("estadoDeEntrega", () => {
  it("lista: todas LISTA o SIN_IMAGEN y al menos una LISTA", () => {
    expect(estadoDeEntrega([g("COMPLETA", "LISTA"), g("COMPLETA", "SIN_IMAGEN")])).toBe("LISTA");
    expect(estadoDeEntrega([g("COMPLETA", "LISTA")])).toBe("LISTA");
  });
  it("ignora las descartadas", () => {
    expect(estadoDeEntrega([g("COMPLETA", "LISTA"), g("DESCARTADA", null)])).toBe("LISTA");
  });
  it("una que sigue grabando: todavía no", () => {
    expect(estadoDeEntrega([g("COMPLETA", "LISTA"), g("GRABANDO", null)])).toBe("CONVIRTIENDO");
  });
  it("en cola o convirtiendo: todavía no", () => {
    expect(estadoDeEntrega([g("COMPLETA", "LISTA"), g("COMPLETA", "PENDIENTE")])).toBe("CONVIRTIENDO");
    expect(estadoDeEntrega([g("COMPLETA", "LISTA"), g("COMPLETA", "PROCESANDO")])).toBe("CONVIRTIENDO");
  });
  it("con error: no sale hasta que se resuelva", () => {
    expect(estadoDeEntrega([g("COMPLETA", "LISTA"), g("COMPLETA", "ERROR")])).toBe("CON_ERROR");
    // Pero si además hay una en curso, primero se espera.
    expect(estadoDeEntrega([g("COMPLETA", "ERROR"), g("COMPLETA", "PROCESANDO")])).toBe("CONVIRTIENDO");
  });
  it("sólo SIN_IMAGEN o nada: no hay videos para entregar", () => {
    expect(estadoDeEntrega([g("COMPLETA", "SIN_IMAGEN")])).toBe("SIN_VIDEOS");
    expect(estadoDeEntrega([])).toBe("SIN_VIDEOS");
    expect(estadoDeEntrega([g("DESCARTADA", null)])).toBe("SIN_VIDEOS");
  });
});

describe("estadoVisibleDeEntrega", () => {
  const ahora = new Date("2026-10-22T15:00:00Z");
  it("enviada, borrada o vencida", () => {
    expect(estadoVisibleDeEntrega({ preparacion: "LISTA", enviadoAt: null, videosVencenAt: null, videosBorradosAt: null }, ahora)).toBe("LISTA_PARA_ENVIAR");
    expect(estadoVisibleDeEntrega({ preparacion: "CONVIRTIENDO", enviadoAt: null, videosVencenAt: null, videosBorradosAt: null }, ahora)).toBe("CONVIRTIENDO");
    const env = { preparacion: "LISTA" as const, enviadoAt: new Date("2026-10-01T00:00:00Z"), videosVencenAt: new Date("2026-10-31T00:00:00Z"), videosBorradosAt: null };
    expect(estadoVisibleDeEntrega(env, ahora)).toBe("ENVIADA");
    expect(estadoVisibleDeEntrega({ ...env, videosVencenAt: new Date("2026-10-22T14:00:00Z") }, ahora)).toBe("BORRADA");
    expect(estadoVisibleDeEntrega({ ...env, videosBorradosAt: new Date("2026-10-21T00:00:00Z") }, ahora)).toBe("BORRADA");
  });
});

describe("vencimientos", () => {
  it("videos y cassettes vencen 30 días después del envío", () => {
    const e = new Date("2026-10-22T18:30:00Z");
    const v = vencimientosDesde(e);
    expect(v.videosVencenAt.toISOString()).toBe("2026-11-21T18:30:00.000Z");
    expect(v.cassettesVencenAt.toISOString()).toBe("2026-11-21T18:30:00.000Z");
  });
  it("vencida = llegó la fecha; sin fecha no vence", () => {
    const ahora = new Date("2026-11-21T18:30:00Z");
    expect(videosVencidos({ videosVencenAt: new Date("2026-11-21T18:30:00Z") }, ahora)).toBe(true);
    expect(videosVencidos({ videosVencenAt: new Date("2026-11-21T18:31:00Z") }, ahora)).toBe(false);
    expect(videosVencidos({ videosVencenAt: null }, ahora)).toBe(false);
  });
});

describe("descargasRestantes", () => {
  it("3 incluidas más las extra, menos las usadas, nunca negativo", () => {
    expect(DESCARGAS_INCLUIDAS).toBe(3);
    expect(descargasRestantes({ descargasExtra: 0, usadas: 0 })).toEqual({ quedan: 3, total: 3 });
    expect(descargasRestantes({ descargasExtra: 2, usadas: 1 })).toEqual({ quedan: 4, total: 5 });
    expect(descargasRestantes({ descargasExtra: 0, usadas: 5 })).toEqual({ quedan: 0, total: 3 });
  });
});

describe("recordatorioQueCorresponde", () => {
  // Corre a las 10 de Argentina (13:00 UTC). Vence el 21/11 a las 15:30 de Argentina.
  const vence = new Date("2026-11-21T18:30:00Z");
  const a = (dia: string) => new Date(`${dia}T13:00:00Z`);
  it("faltan más de 10 días: nada", () => {
    expect(recordatorioQueCorresponde({ videosVencenAt: vence, recordatorios: [] }, a("2026-11-10"))).toBeNull();
  });
  it("faltan 10: el de 10", () => {
    expect(recordatorioQueCorresponde({ videosVencenAt: vence, recordatorios: [] }, a("2026-11-11"))).toBe(10);
  });
  it("ya mandado el de 10 y faltan 7: nada", () => {
    expect(recordatorioQueCorresponde({ videosVencenAt: vence, recordatorios: [10] }, a("2026-11-14"))).toBeNull();
  });
  it("faltan 5 sin haber mandado el de 10: sólo el de 5", () => {
    expect(recordatorioQueCorresponde({ videosVencenAt: vence, recordatorios: [] }, a("2026-11-16"))).toBe(5);
  });
  it("faltan 1 (o vence hoy más tarde): el de 1, una sola vez", () => {
    expect(recordatorioQueCorresponde({ videosVencenAt: vence, recordatorios: [10, 5] }, a("2026-11-20"))).toBe(1);
    expect(recordatorioQueCorresponde({ videosVencenAt: vence, recordatorios: [10, 5] }, a("2026-11-21"))).toBe(1);
    expect(recordatorioQueCorresponde({ videosVencenAt: vence, recordatorios: [10, 5, 1] }, a("2026-11-21"))).toBeNull();
  });
  it("ya vencida o sin fecha: nada (se borra, no se avisa)", () => {
    expect(recordatorioQueCorresponde({ videosVencenAt: vence, recordatorios: [] }, new Date("2026-11-21T19:00:00Z"))).toBeNull();
    expect(recordatorioQueCorresponde({ videosVencenAt: null, recordatorios: [] }, a("2026-11-20"))).toBeNull();
  });
  it("cuenta días de Argentina, no de UTC", () => {
    // 22/11 01:00 UTC = 21/11 22:00 en Argentina: vence el 22/11 a las 00:30 de Argentina, falta 1 día.
    const venceMedianoche = new Date("2026-11-22T03:30:00Z");
    expect(recordatorioQueCorresponde({ videosVencenAt: venceMedianoche, recordatorios: [10, 5] }, new Date("2026-11-21T13:00:00Z"))).toBe(1);
  });
});

describe("validarFranjas", () => {
  it("ordena por km y acepta precios con centavos", () => {
    expect(validarFranjas([{ hastaKm: 20, precioArs: 8000 }, { hastaKm: 5, precioArs: 3500.5 }])).toEqual({
      ok: true,
      franjas: [{ hastaKm: 5, precioArs: 3500.5 }, { hastaKm: 20, precioArs: 8000 }],
    });
  });
  it("lista vacía = a coordinar", () => {
    expect(validarFranjas([])).toEqual({ ok: true, franjas: [] });
  });
  it("rechaza km repetidos, cero, negativos o no números", () => {
    expect(validarFranjas([{ hastaKm: 5, precioArs: 1 }, { hastaKm: 5, precioArs: 2 }]).ok).toBe(false);
    expect(validarFranjas([{ hastaKm: 0, precioArs: 1 }]).ok).toBe(false);
    expect(validarFranjas([{ hastaKm: -3, precioArs: 1 }]).ok).toBe(false);
    expect(validarFranjas([{ hastaKm: "5", precioArs: 1 }]).ok).toBe(false);
    expect(validarFranjas([{ hastaKm: Number.NaN, precioArs: 1 }]).ok).toBe(false);
  });
  it("rechaza precios negativos, con más de dos decimales o desmedidos", () => {
    expect(validarFranjas([{ hastaKm: 5, precioArs: -1 }]).ok).toBe(false);
    expect(validarFranjas([{ hastaKm: 5, precioArs: 1.234 }]).ok).toBe(false);
    expect(validarFranjas([{ hastaKm: 5, precioArs: 1e12 }]).ok).toBe(false);
  });
  it("rechaza lo que no es una lista, demasiadas franjas o campos de más", () => {
    expect(validarFranjas(null).ok).toBe(false);
    expect(validarFranjas({ hastaKm: 5, precioArs: 1 }).ok).toBe(false);
    expect(validarFranjas(Array.from({ length: 21 }, (_, i) => ({ hastaKm: i + 1, precioArs: 1 }))).ok).toBe(false);
    expect(validarFranjas([{ hastaKm: 5, precioArs: 1, otro: 1 }]).ok).toBe(false);
  });
  it("leerFranjas: lo guardado, o [] si está roto", () => {
    expect(leerFranjas([{ hastaKm: 5, precioArs: 1 }])).toEqual([{ hastaKm: 5, precioArs: 1 }]);
    expect(leerFranjas(null)).toEqual([]);
    expect(leerFranjas("x")).toEqual([]);
  });
});

describe("formatos", () => {
  it("pesos sin signo", () => {
    expect(pesos(1500000)).toBe("15.000 pesos");
    expect(pesos(150050)).toBe("1.500,50 pesos");
  });
  it("fechas en hora argentina", () => {
    // 22/11 01:00 UTC = 21/11 en Argentina.
    expect(fechaArgentina(new Date("2026-11-22T01:00:00Z"))).toBe("21/11/2026");
    expect(fechaArgentina(new Date("2026-11-22T01:00:00Z"), "corta")).toBe("21/11");
  });
});

describe("token y dirección", () => {
  it("token HMAC de 43 caracteres, distinto por entrega y por generación", () => {
    const a = tokenDeEntrega("e1", "clave", 0);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenDeEntrega("e1", "clave", 0)).toBe(a);
    expect(tokenDeEntrega("e1", "clave", 1)).not.toBe(a);
    expect(tokenDeEntrega("e2", "clave", 0)).not.toBe(a);
    expect(tokenDeEntrega("e1", "otra", 0)).not.toBe(a);
  });
  it("rearma la generación vigente desde el hash guardado", () => {
    expect(generacionDeEntrega("e1", hashDeToken(tokenDeEntrega("e1", "clave", 3)), "clave")).toBe(3);
    expect(generacionDeEntrega("e1", hashDeToken(tokenDeEntrega("e1", "otra", 3)), "clave")).toBeNull();
    expect(generacionDeEntrega("e1", null, "clave")).toBeNull();
  });
  it("título visible", () => {
    expect(tituloDeVideo({ titulo: " Boda ", tipo: "VHS", cassetteNumero: 2 })).toBe("Boda");
    expect(tituloDeVideo({ titulo: null, tipo: "VHS", cassetteNumero: 2 })).toBe("Cassette 2");
    expect(tituloDeVideo({ titulo: "", tipo: "DVD", cassetteNumero: null })).toBe("DVD");
  });
  it("dominio propio o /w/<slug>", () => {
    expect(urlDeVideos({ customDomain: "estudio.com.ar", appOrigin: "https://fotoffice.com", slug: "x", token: "t" })).toBe("https://estudio.com.ar/videos/t");
    expect(urlDeVideos({ customDomain: null, appOrigin: "https://fotoffice.com", slug: "mi-estudio", token: "t" })).toBe("https://fotoffice.com/w/mi-estudio/videos/t");
    expect(urlDeVideos({ customDomain: null, appOrigin: "", slug: "mi-estudio", token: "t" })).toBeNull();
  });
});
