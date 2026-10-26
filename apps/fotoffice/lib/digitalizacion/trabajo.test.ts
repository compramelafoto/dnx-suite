import { describe, expect, it } from "vitest";
import {
  ETIQUETA_ESTADO_GRABACION, datosTextoEntrega, esNombreDeDigitalizacion, esTrabajoDeDigitalizacion, estadoDeGrabacion, registroDeEnvio, textoDeDescargas,
  textoDeEntrega, textoDeSaldo, type DatosTextoEntrega,
} from "./trabajo";

const AHORA = new Date("2026-10-26T15:00:00Z");

describe("esNombreDeDigitalizacion", () => {
  it("reconoce los nombres de video, con o sin tilde ni mayúsculas", () => {
    for (const n of ["Digitalización de VHS", "DIGITALIZACION DE DVD", "Pasar VHS a pendrive", "Digitalizar cassette de video", "Digitalización Hi8", "Digitalización mini DV", "Video 8mm a digital"]) {
      expect(esNombreDeDigitalizacion(n), n).toBe(true);
    }
  });

  it("no confunde audio, CD, fotos ni otros servicios", () => {
    for (const n of ["Digitalización de casete de audio", "Digitalización de CD", "Digitalización de negativos", "Copia 15x21", "Fotolibro 20x30", "", null, undefined, "DVDs vírgenes"]) {
      expect(esNombreDeDigitalizacion(n), String(n)).toBe(false);
    }
  });
});

describe("esTrabajoDeDigitalizacion", () => {
  it("con grabaciones, siempre", () => {
    expect(esTrabajoDeDigitalizacion({ grabaciones: 1, textos: ["Cualquier cosa"] })).toBe(true);
  });

  it("sin grabaciones, por el nombre del trabajo, del producto o de su categoría", () => {
    expect(esTrabajoDeDigitalizacion({ grabaciones: 0, textos: ["Trabajo 12", "Digitalización de VHS", null] })).toBe(true);
    expect(esTrabajoDeDigitalizacion({ grabaciones: 0, textos: ["Cumple de Ana", null, "Digitalización de video"] })).toBe(true);
    expect(esTrabajoDeDigitalizacion({ grabaciones: 0, textos: ["Copias 10x15", "Copia", "Impresiones"] })).toBe(false);
  });
});

describe("estadoDeGrabacion", () => {
  const base = { estado: "COMPLETA", conversionEstado: "LISTA" as string | null, sinImagen: false, ultimoLatidoAt: AHORA, iniciadaAt: AHORA };

  it("traduce la grabación y la conversión a un solo estado", () => {
    expect(estadoDeGrabacion({ ...base, estado: "DESCARTADA" }, AHORA)).toBe("DESCARTADA");
    expect(estadoDeGrabacion({ ...base, estado: "GRABANDO", conversionEstado: null }, AHORA)).toBe("GRABANDO");
    expect(estadoDeGrabacion({ ...base, estado: "GRABANDO", conversionEstado: null, ultimoLatidoAt: new Date(AHORA.getTime() - 3_600_000) }, AHORA)).toBe("INTERRUMPIDA");
    expect(estadoDeGrabacion({ ...base, conversionEstado: null }, AHORA)).toBe("EN_COLA");
    expect(estadoDeGrabacion({ ...base, conversionEstado: null, sinImagen: true }, AHORA)).toBe("SIN_IMAGEN");
    expect(estadoDeGrabacion({ ...base, conversionEstado: "PENDIENTE" }, AHORA)).toBe("EN_COLA");
    expect(estadoDeGrabacion({ ...base, conversionEstado: "PROCESANDO" }, AHORA)).toBe("CONVIRTIENDO");
    expect(estadoDeGrabacion(base, AHORA)).toBe("LISTA");
    expect(estadoDeGrabacion({ ...base, conversionEstado: "SIN_IMAGEN" }, AHORA)).toBe("SIN_IMAGEN");
    expect(estadoDeGrabacion({ ...base, conversionEstado: "ERROR" }, AHORA)).toBe("ERROR");
  });

  it("cada estado tiene su texto", () => {
    expect(ETIQUETA_ESTADO_GRABACION.INTERRUMPIDA).toBe("Quedó a medias");
    expect(ETIQUETA_ESTADO_GRABACION.LISTA).toBe("Listo");
    expect(ETIQUETA_ESTADO_GRABACION.EN_COLA).toBe("En cola");
  });
});

describe("registroDeEnvio", () => {
  const nota = (body: string, iso: string) => ({ body, createdAt: new Date(iso) });

  it("lee el primer envío y el último reenvío de las notas del trabajo", () => {
    const r = registroDeEnvio([
      nota("Correo «Tus videos están listos» reenviado a ana@nueva.com.", "2026-10-25T13:00:00Z"),
      nota("Otra nota cualquiera", "2026-10-21T13:00:00Z"),
      nota("Correo «Tus videos están listos» enviado a ana@x.com.", "2026-10-22T13:00:00Z"),
      // La misma nota queda en cada trabajo del pedido: no se cuenta dos veces.
      nota("Correo «Tus videos están listos» enviado a ana@x.com.", "2026-10-22T13:00:00Z"),
    ]);
    expect(r.primero).toEqual({ modo: "CORREO", email: "ana@x.com", at: new Date("2026-10-22T13:00:00Z") });
    expect(r.ultimoReenvio).toEqual({ email: "ana@nueva.com", at: new Date("2026-10-25T13:00:00Z") });
  });

  it("reconoce el envío por enlace", () => {
    const r = registroDeEnvio([nota("Videos digitalizados: se copió el enlace para mandarlo al cliente (no se envió correo).", "2026-10-22T13:00:00Z")]);
    expect(r.primero).toEqual({ modo: "ENLACE", email: null, at: new Date("2026-10-22T13:00:00Z") });
    expect(r.ultimoReenvio).toBeNull();
  });

  it("sin notas, sin registro", () => {
    expect(registroDeEnvio([])).toEqual({ primero: null, ultimoReenvio: null });
  });
});

describe("textoDeEntrega", () => {
  const datos = (extra: Partial<DatosTextoEntrega> = {}): DatosTextoEntrega => ({
    cancelado: false, tieneEmail: true, email: "ana@x.com", enviaSoloDesde: null, automatico: false,
    enviadoAt: new Date("2026-10-22T13:00:00Z"), videosVencenAt: new Date("2026-11-21T02:59:59.999Z"), videosBorradosAt: null,
    registro: { primero: null, ultimoReenvio: null }, cassettes: { esperados: null, faltan: 0 }, ...extra,
  });

  it("pedido 2026-0006: lista con cassettes vendidos sin grabar dice cuántos faltan", () => {
    const d = datos({ enviadoAt: null, automatico: true, cassettes: { esperados: 2, faltan: 1 } });
    expect(textoDeEntrega("LISTA_PARA_ENVIAR", d, AHORA)).toBe("Falta grabar 1 cassette");
    expect(textoDeEntrega("LISTA_PARA_ENVIAR", datos({ enviadoAt: null, cassettes: { esperados: 3, faltan: 2 } }), AHORA)).toBe("Falta grabar 2 cassettes");
  });
  it("con la cantidad conocida y completa no dice «si no grabás otro cassette»", () => {
    const desde = new Date(AHORA.getTime() + 20 * 60 * 1000);
    const conocida = datos({ enviadoAt: null, automatico: true, enviaSoloDesde: desde, cassettes: { esperados: 2, faltan: 0 } });
    expect(textoDeEntrega("LISTA_PARA_ENVIAR", conocida, AHORA)).not.toContain("otro cassette");
    const desconocida = datos({ enviadoAt: null, automatico: true, enviaSoloDesde: desde });
    expect(textoDeEntrega("LISTA_PARA_ENVIAR", desconocida, AHORA)).toContain("si no grabás otro cassette");
  });

  it("enviado por correo: a quién y cuándo vence", () => {
    const registro = { primero: { modo: "CORREO" as const, email: "ana@x.com", at: new Date("2026-10-22T13:00:00Z") }, ultimoReenvio: null };
    expect(textoDeEntrega("ENVIADA", datos({ registro }), AHORA)).toBe("Enviado el 22/10 por correo a ana@x.com · vence 20/11");
  });

  it("con reenvío, también lo dice", () => {
    const registro = {
      primero: { modo: "CORREO" as const, email: "ana@x.com", at: new Date("2026-10-22T13:00:00Z") },
      ultimoReenvio: { email: "ana@nueva.com", at: new Date("2026-10-25T13:00:00Z") },
    };
    expect(textoDeEntrega("ENVIADA", datos({ registro }), AHORA)).toBe("Enviado el 22/10 por correo a ana@x.com · reenviado el 25/10 a ana@nueva.com · vence 20/11");
  });

  it("enviado por enlace", () => {
    const registro = { primero: { modo: "ENLACE" as const, email: null, at: new Date("2026-10-22T13:00:00Z") }, ultimoReenvio: null };
    expect(textoDeEntrega("ENVIADA", datos({ registro }), AHORA)).toBe("Enviado el 22/10 por enlace (sin correo) · vence 20/11");
  });

  it("sin registro: lo dice y muestra el correo que tiene hoy el cliente", () => {
    expect(textoDeEntrega("ENVIADA", datos(), AHORA)).toBe("Enviado el 22/10 · vence 20/11 · no quedó registro de cómo; el correo del cliente es ana@x.com");
    expect(textoDeEntrega("ENVIADA", datos({ tieneEmail: false, email: null }), AHORA)).toBe("Enviado el 22/10 por enlace (sin correo) · vence 20/11");
  });

  it("los demás estados", () => {
    expect(textoDeEntrega("CONVIRTIENDO", datos({ enviadoAt: null }), AHORA)).toBe("Convirtiendo…");
    expect(textoDeEntrega("LISTA_PARA_ENVIAR", datos({ enviadoAt: null }), AHORA)).toBe("Listo para enviar");
    expect(textoDeEntrega("LISTA_PARA_ENVIAR", datos({ enviadoAt: null, tieneEmail: false, email: null }), AHORA)).toMatch(/no tiene correo/);
    expect(textoDeEntrega("BORRADA", datos({ videosBorradosAt: new Date("2026-11-21T13:00:00Z") }), AHORA)).toBe("Videos borrados el 21/11");
    expect(textoDeEntrega("LISTA_PARA_ENVIAR", datos({ cancelado: true }), AHORA)).toBe("Pedido cancelado: no se envían los videos.");
    expect(
      textoDeEntrega("LISTA_PARA_ENVIAR", datos({ enviadoAt: null, automatico: true, enviaSoloDesde: new Date("2026-10-27T01:00:00Z") }), AHORA),
    ).toBe("Listo · se envía solo el 26/10 22:00 si no grabás otro cassette");
  });
});

describe("datosTextoEntrega", () => {
  it("sin fila de entrega usa el envío automático del negocio", () => {
    const registro = { primero: null, ultimoReenvio: null };
    const r = { cancelado: false, tieneEmail: true, email: "a@b.com", enviaSoloDesde: null, entrega: null, envioRegistrado: registro };
    expect(datosTextoEntrega(r, true)).toMatchObject({ automatico: true, enviadoAt: null, registro });
    const conEntrega = { ...r, entrega: { envioAutomatico: false, enviadoAt: AHORA, videosVencenAt: AHORA, videosBorradosAt: null } };
    expect(datosTextoEntrega(conEntrega, true)).toMatchObject({ automatico: false, enviadoAt: AHORA });
  });
});

describe("textoDeSaldo y textoDeDescargas", () => {
  it("el saldo que traba los videos, en pesos", () => {
    expect(textoDeSaldo(1_500_000)).toBe("Le falta pagar 15.000 pesos: los videos están bloqueados hasta que pague.");
    expect(textoDeSaldo(0)).toBeNull();
  });

  it("las descargas usadas de cada video", () => {
    expect(textoDeDescargas({ usadas: 0, descargasExtra: 0 })).toBe("Sin descargas todavía (tiene 3)");
    expect(textoDeDescargas({ usadas: 1, descargasExtra: 0 })).toBe("1 descarga de 3");
    expect(textoDeDescargas({ usadas: 3, descargasExtra: 2 })).toBe("3 descargas de 5");
  });
});
