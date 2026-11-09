import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedWebhookEvent } from "@/lib/mailing/webhook-events";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const telegram = vi.hoisted(() => ({ mensajes: [] as string[], destino: { token: "tok", chatId: "chat" } as { token: string; chatId: string } | null }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("../canal", () => ({ destinoAgentes: async () => telegram.destino }));
vi.mock("@/lib/telegram/api", () => ({
  mandarMensaje: async (_t: string, _c: string, html: string) => {
    telegram.mensajes.push(html);
    return { ok: true, resultado: { messageId: "1" } };
  },
}));

const { aplicarAvisoVendedor, revisarSalud, VENTANA_SALUD, MAX_REBOTES_SALUD } = await import("./avisos");
const { leerAjustesVendedor, guardarAjustesVendedor } = await import("./ajustes");
const { mensajePausa } = await import("./mensajes");

const AHORA = new Date("2026-11-20T15:00:00.000Z");
let n = 0;

function hiloConCorreo(extra: { estadoHilo?: string; correo?: Record<string, unknown> } = {}) {
  n++;
  const c = B.agregar("dnxContacto", { tipo: "FOTOGRAFO", nombre: `C${n}`, creadoPor: "BUSCADOR", email: `c${n}@x.com`, claveEmail: `c${n}@x.com`, estado: "CONTACTADO" }) as { id: string };
  const h = B.agregar("dnxVendedorHilo", { contactoId: c.id, grupo: "FOTOGRAFO:GENERAL", token: `tok${n}`, estado: extra.estadoHilo ?? "ENVIADO" }) as { id: string };
  const correo = B.agregar("dnxVendedorCorreo", {
    hiloId: h.id, contactoId: c.id, direccion: "SALIDA", paso: "PRIMERO", resendId: `re_${n}`, de: "Daniel", para: `c${n}@x.com`,
    asunto: "a", texto: "t", creadoEn: new Date(AHORA.getTime() - (1000 - n) * 60_000), ...extra.correo,
  }) as { id: string; resendId: string };
  return { contactoId: c.id, hiloId: h.id, correo };
}

const aviso = (emailId: string, field: ParsedWebhookEvent["field"], at = AHORA): ParsedWebhookEvent => ({
  emailId, field, at, optOut: field === "bouncedAt" || field === "complainedAt",
});

const fila = (tabla: "dnxVendedorCorreo" | "dnxVendedorHilo" | "dnxContacto", id: string) => B.datos[tabla].find((f) => f.id === id)!;

beforeEach(async () => {
  B.vaciar();
  telegram.mensajes = [];
  telegram.destino = { token: "tok", chatId: "chat" };
  await guardarAjustesVendedor({ pausado: false });
});

describe("avisos de Resend para el Vendedor", () => {
  it("un rebote o una queja de un REENVIO a Daniel no tocan el hilo ni el contacto del prospecto", async () => {
    const r = hiloConCorreo({ correo: { paso: "REENVIO", para: "dnxfotografia@gmail.com", asunto: "Reenviado: Consulta de precios" } });
    expect(await aplicarAvisoVendedor(aviso(r.correo.resendId, "bouncedAt"), AHORA)).toBe("APLICADO");
    expect(await aplicarAvisoVendedor(aviso(r.correo.resendId, "complainedAt"), AHORA)).toBe("APLICADO");
    expect(fila("dnxVendedorHilo", r.hiloId)).toMatchObject({ estado: "ENVIADO", cierre: null });
    expect(fila("dnxContacto", r.contactoId).estado).toBe("CONTACTADO");
    expect(B.datos.dnxContactoEvento).toHaveLength(0);
    expect(B.datos.dnxVendedorBaja).toHaveLength(0);
    expect(fila("dnxVendedorCorreo", r.correo.id)).toMatchObject({ reboteEn: AHORA, quejaEn: AHORA });
    expect((await leerAjustesVendedor()).pausado).toBe(false);
    // Avisa una sola vez que el reenvío no llegó.
    expect(telegram.mensajes).toHaveLength(1);
    expect(telegram.mensajes[0]).toMatch(/No te llegó el reenvío de «Consulta de precios»/);
    expect(await aplicarAvisoVendedor(aviso(r.correo.resendId, "bouncedAt"), AHORA)).toBe("DUPLICADO");
    expect(telegram.mensajes).toHaveLength(1);
  });

  it("una queja anota la casilla como dada de baja", async () => {
    const r = hiloConCorreo();
    await aplicarAvisoVendedor(aviso(r.correo.resendId, "complainedAt"), AHORA);
    expect(B.datos.dnxVendedorBaja.map((b) => b.email)).toEqual([fila("dnxVendedorCorreo", r.correo.id).para]);
  });

  it("el primer aviso de cada tipo gana", async () => {
    const { correo } = hiloConCorreo();
    const t1 = new Date("2026-11-20T15:01:00.000Z");
    const t2 = new Date("2026-11-20T15:09:00.000Z");
    expect(await aplicarAvisoVendedor(aviso(correo.resendId, "deliveredAt", t1), AHORA)).toBe("APLICADO");
    expect(await aplicarAvisoVendedor(aviso(correo.resendId, "openedAt", t1), AHORA)).toBe("APLICADO");
    expect(await aplicarAvisoVendedor(aviso(correo.resendId, "clickedAt", t1), AHORA)).toBe("APLICADO");
    expect(await aplicarAvisoVendedor(aviso(correo.resendId, "openedAt", t2), AHORA)).toBe("DUPLICADO");
    expect(fila("dnxVendedorCorreo", correo.id)).toMatchObject({ entregadoEn: t1, abiertoEn: t1, clicEn: t1 });
  });

  it("un rebote cierra el hilo y deja la nota", async () => {
    const { correo, hiloId, contactoId } = hiloConCorreo();
    expect(await aplicarAvisoVendedor(aviso(correo.resendId, "bouncedAt"), AHORA)).toBe("APLICADO");
    expect(fila("dnxVendedorCorreo", correo.id).reboteEn).toEqual(AHORA);
    expect(fila("dnxVendedorHilo", hiloId)).toMatchObject({ estado: "CERRADO", cierre: "REBOTE" });
    const notas = B.datos.dnxContactoEvento.filter((e) => e.contactoId === contactoId && e.tipo === "NOTA");
    expect(notas).toHaveLength(1);
    expect(notas[0]).toMatchObject({ autor: "VENDEDOR", datos: { texto: `El email ${correo.resendId.replace("re_", "c")}@x.com rebotó: no es válido.` } });
    // Un reintento de Resend no repite la nota.
    expect(await aplicarAvisoVendedor(aviso(correo.resendId, "bouncedAt"), AHORA)).toBe("DUPLICADO");
    expect(B.datos.dnxContactoEvento.filter((e) => e.tipo === "NOTA")).toHaveLength(1);
  });

  it("una queja pasa a NO_CONTACTAR", async () => {
    const { correo, hiloId, contactoId } = hiloConCorreo();
    expect(await aplicarAvisoVendedor(aviso(correo.resendId, "complainedAt"), AHORA)).toBe("APLICADO");
    expect(fila("dnxContacto", contactoId).estado).toBe("NO_CONTACTAR");
    expect(fila("dnxVendedorHilo", hiloId)).toMatchObject({ estado: "BAJA", cierre: "QUEJA" });
    expect(fila("dnxVendedorCorreo", correo.id).quejaEn).toEqual(AHORA);
  });

  it("3 rebotes en los últimos 50 pausan y avisan una vez; 2 no", async () => {
    expect(VENTANA_SALUD).toBe(50);
    expect(MAX_REBOTES_SALUD).toBe(2);
    const correos = [hiloConCorreo(), hiloConCorreo(), hiloConCorreo(), hiloConCorreo()].map((x) => x.correo);
    await aplicarAvisoVendedor(aviso(correos[0]!.resendId, "bouncedAt"), AHORA);
    await aplicarAvisoVendedor(aviso(correos[1]!.resendId, "bouncedAt"), AHORA);
    expect((await leerAjustesVendedor()).pausado).toBe(false);
    expect(telegram.mensajes).toHaveLength(0);
    expect(await revisarSalud(AHORA)).toEqual({ frenado: false });

    await aplicarAvisoVendedor(aviso(correos[2]!.resendId, "bouncedAt"), AHORA);
    const a = await leerAjustesVendedor();
    expect(a).toMatchObject({ pausado: true, pausadoPor: "SALUD" });
    expect(telegram.mensajes).toHaveLength(1);
    expect(telegram.mensajes[0]!.startsWith("⏸️ Pausé el Vendedor")).toBe(true);

    await aplicarAvisoVendedor(aviso(correos[3]!.resendId, "bouncedAt"), AHORA);
    expect(await revisarSalud(AHORA)).toEqual({ frenado: true });
    expect(telegram.mensajes).toHaveLength(1);
  });

  it("los rebotes viejos fuera de los últimos 50 envíos no cuentan, ni los reenvíos a Daniel", async () => {
    // 3 rebotes, pero 50 envíos más nuevos los dejan afuera de la ventana.
    for (let i = 0; i < 3; i++) hiloConCorreo({ correo: { reboteEn: AHORA, creadoEn: new Date("2026-10-01T12:00:00.000Z") } });
    for (let i = 0; i < 50; i++) hiloConCorreo();
    // Y un rebote de un REENVIO no habla de la salud de la dirección hacia afuera.
    for (let i = 0; i < 3; i++) hiloConCorreo({ correo: { paso: "REENVIO", reboteEn: AHORA } });
    expect(await revisarSalud(AHORA)).toEqual({ frenado: false });
  });

  it("una queja pausa", async () => {
    const { correo } = hiloConCorreo();
    await aplicarAvisoVendedor(aviso(correo.resendId, "complainedAt"), AHORA);
    expect(await leerAjustesVendedor()).toMatchObject({ pausado: true, pausadoPor: "SALUD" });
    expect(telegram.mensajes).toHaveLength(1);
  });

  it("si ya estaba pausado a mano, no avisa ni cambia quién pausó", async () => {
    await guardarAjustesVendedor({ pausado: true, pausadoPor: "MANUAL" });
    const { correo } = hiloConCorreo();
    await aplicarAvisoVendedor(aviso(correo.resendId, "complainedAt"), AHORA);
    expect(await leerAjustesVendedor()).toMatchObject({ pausado: true, pausadoPor: "MANUAL" });
    expect(telegram.mensajes).toHaveLength(0);
  });

  it("después de reanudar no vuelve a frenar por la misma queja", async () => {
    const { correo } = hiloConCorreo({ correo: { quejaEn: AHORA } });
    const despues = new Date(AHORA.getTime() + 60_000).toISOString();
    expect(new Date(despues) > (fila("dnxVendedorCorreo", correo.id).creadoEn as Date)).toBe(true);
    await guardarAjustesVendedor({ pausado: false, pausadoPor: null, saludDesde: despues });
    expect(await revisarSalud(AHORA)).toEqual({ frenado: false });
    expect((await leerAjustesVendedor()).pausado).toBe(false);
    expect(telegram.mensajes).toHaveLength(0);
  });

  it("un aviso de un correo que no es del Vendedor es DESCONOCIDO", async () => {
    hiloConCorreo();
    expect(await aplicarAvisoVendedor(aviso("re_de_otra_app", "bouncedAt"), AHORA)).toBe("DESCONOCIDO");
    expect(telegram.mensajes).toHaveLength(0);
  });
});

describe("mensajePausa", () => {
  it("empieza igual por salud y por tope, y escapa el detalle", () => {
    expect(mensajePausa("SALUD", "3 rebotes <de> 50").startsWith("⏸️ Pausé el Vendedor")).toBe(true);
    expect(mensajePausa("SALUD", "3 rebotes <de> 50")).toContain("3 rebotes &lt;de&gt; 50");
    expect(mensajePausa("TOPE", "USD 28")).toMatch(/^⏸️ Pausé el Vendedor/);
    expect(mensajePausa("TOPE", "USD 28")).not.toBe(mensajePausa("SALUD", "USD 28"));
  });
});
