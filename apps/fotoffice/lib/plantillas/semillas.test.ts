import { beforeEach, describe, expect, it, vi } from "vitest";
import { analizar, tieneMarcadorSinCompletar } from "./motor";
import { clavesPermitidas } from "./variables";
import { MAX_ASUNTO, MAX_CUERPO, MAX_NOMBRE_PLANTILLA } from "./constantes";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/vocabulario/load", () => ({ loadPersonVocabulary: async () => ({}) }));

const S = await import("./semillas");
const D = await import("./definiciones");

const plantillas = () => B.datos.fotofficeMessageTemplate;
const filas = () => JSON.stringify(plantillas().map(({ createdAt: _c, updatedAt: _u, ...f }) => f));

beforeEach(() => B.vaciar());

describe("textos iniciales", () => {
  const todos = [
    ...S.PLANTILLAS_DNX.map((p) => ({ nombre: p.nombre, canal: p.canal, tipo: p.tipo, asunto: p.asunto, cuerpo: p.cuerpo })),
    { nombre: "Autorespuesta DNX", canal: "EMAIL" as const, tipo: "CONSULTA" as const, ...S.AUTORESPUESTA_DNX },
    { nombre: "Autorespuesta genérica", canal: "EMAIL" as const, tipo: "CONSULTA" as const, ...S.AUTORESPUESTA_GENERICA },
  ];

  it.each(todos)("$nombre valida con las variables de su ficha (sin campos) y respeta los límites", (t) => {
    const permitidas = clavesPermitidas(t.tipo, []);
    expect(analizar(t.cuerpo, permitidas)).toMatchObject({ ok: true });
    expect(t.cuerpo.length).toBeLessThanOrEqual(MAX_CUERPO[t.canal]);
    expect(t.nombre.length).toBeLessThanOrEqual(MAX_NOMBRE_PLANTILLA);
    if (t.canal === "EMAIL") {
      expect(t.asunto).toBeTruthy();
      expect(analizar(t.asunto!, permitidas)).toMatchObject({ ok: true });
      expect(t.asunto!.length).toBeLessThanOrEqual(MAX_ASUNTO);
    } else {
      expect(t.asunto).toBeNull();
    }
  });

  it("la Propuesta pide el enlace a la agenda y no deja un \"o a\" suelto sin WhatsApp", () => {
    const p = S.PLANTILLAS_DNX.find((x) => x.nombre === "Propuesta para tu evento")!;
    expect(p.cuerpo).toContain("[PEGÁ ACÁ EL ENLACE A TU AGENDA]");
    expect(tieneMarcadorSinCompletar(p.cuerpo)).toBe(true);
    expect(p.cuerpo).toContain("[si:organizacion_email] o escribiéndonos a [organizacion_email][/si]");
  });

  it("las autorespuestas iniciales no tienen textos para completar (se pueden encender)", () => {
    for (const a of [S.AUTORESPUESTA_DNX, S.AUTORESPUESTA_GENERICA]) {
      expect(tieneMarcadorSinCompletar(a.asunto) || tieneMarcadorSinCompletar(a.cuerpo)).toBe(false);
    }
  });

  it("las autorespuestas no repiten el mensaje libre de la consulta (el formulario es público)", () => {
    for (const a of [S.AUTORESPUESTA_DNX, S.AUTORESPUESTA_GENERICA]) {
      expect(`${a.asunto}${a.cuerpo}`).not.toContain("consulta_mensaje");
    }
  });

  it("DNX: 5 de correo y 2 de WhatsApp con los nombres del spec", () => {
    expect(S.PLANTILLAS_DNX.map((p) => `${p.canal}:${p.tipo}:${p.nombre}`)).toEqual([
      "EMAIL:CLIENTE:¡Gracias por elegirnos!",
      "EMAIL:CONSULTA:Ya falta poco para tu evento",
      "EMAIL:CLIENTE:Te enviamos tu foto carnet",
      "EMAIL:CONSULTA:Propuesta para tu evento",
      "EMAIL:CONSULTA:Seguimiento de la propuesta",
      "WHATSAPP:CONSULTA:Recibimos tu consulta",
      "WHATSAPP:CONSULTA:Coordinar entrevista",
    ]);
  });
});

describe("asegurarPlantillasIniciales", () => {
  it("DNX: las 7 plantillas y la autorespuesta apagada; dos veces deja lo mismo y la segunda no abre transacción", async () => {
    await S.asegurarPlantillasIniciales("ws-1", "dnx-estudio");
    expect(plantillas()).toHaveLength(8);
    expect(B.transacciones).toHaveLength(1);
    const auto = await D.leerAutomatico("ws-1", "CONSULTA_AUTORESPUESTA");
    expect(auto).toMatchObject({ enabled: false, channel: "EMAIL", entityType: "CONSULTA", subject: S.AUTORESPUESTA_DNX.asunto });
    expect((await D.listarPlantillas("ws-1", { canal: "EMAIL" })).map((p) => [p.name, p.order])).toEqual([
      ["¡Gracias por elegirnos!", 0],
      ["Ya falta poco para tu evento", 1],
      ["Te enviamos tu foto carnet", 2],
      ["Propuesta para tu evento", 3],
      ["Seguimiento de la propuesta", 4],
    ]);
    expect((await D.listarPlantillas("ws-1", { canal: "WHATSAPP" })).map((p) => [p.name, p.order])).toEqual([
      ["Recibimos tu consulta", 0],
      ["Coordinar entrevista", 1],
    ]);
    const antes = filas();
    await S.asegurarPlantillasIniciales("ws-1", "dnx-estudio");
    expect(filas()).toBe(antes);
    expect(B.transacciones).toHaveLength(1);
  });

  it("otras organizaciones: sólo la autorespuesta genérica, apagada", async () => {
    await S.asegurarPlantillasIniciales("ws-2", "otra");
    await S.asegurarPlantillasIniciales("ws-2", "otra");
    expect(plantillas()).toHaveLength(1);
    expect(plantillas()[0]).toMatchObject({
      workspaceId: "ws-2", systemKey: "CONSULTA_AUTORESPUESTA", enabled: false, body: S.AUTORESPUESTA_GENERICA.cuerpo,
    });
  });

  it("si ya tiene la automática, no vuelve a sembrar aunque haya borrado las plantillas", async () => {
    await S.asegurarPlantillasIniciales("ws-1", "dnx-estudio");
    B.datos.fotofficeMessageTemplate = plantillas().filter((p) => p.systemKey !== null);
    await S.asegurarPlantillasIniciales("ws-1", "dnx-estudio");
    expect(plantillas()).toHaveLength(1);
  });

  it("si otra pestaña la crea en el mismo instante, no falla ni duplica", async () => {
    const original = B.tablas.fotofficeMessageTemplate.count;
    let primera = true;
    B.tablas.fotofficeMessageTemplate.count = async (a) => {
      // Afuera dice que no hay; adentro, la otra pestaña ya la creó.
      if (primera) {
        primera = false;
        return 0;
      }
      return original(a);
    };
    B.agregar("fotofficeMessageTemplate", {
      workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", name: "x", subject: "a", body: "b", systemKey: "CONSULTA_AUTORESPUESTA",
    });
    await S.asegurarPlantillasIniciales("ws-1", "dnx-estudio");
    B.tablas.fotofficeMessageTemplate.count = original;
    expect(plantillas()).toHaveLength(1);
  });
});
