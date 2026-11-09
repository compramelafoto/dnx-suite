import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const campana = vi.hoisted(() => ({ valor: new Set<string>() as Set<string> | null }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("./clf", () => ({ leerCampanaEscolar: async () => campana.valor }));

const { motivoNoApto, puntajeDatos, colaDelDia, sigueApto } = await import("./aptos");

const base = { email: "a@b.com", claveEmail: "a@b.com", estado: "NUEVO", vinculo: null, fusionadoEnId: null, tipo: "FOTOGRAFO", nichos: [] as string[] };
const ctx = { campanaEscolar: new Set<string>(), emailsConHilo: new Set<string>(), tieneHilo: false };

describe("motivoNoApto", () => {
  it("un contacto sano es apto", () => expect(motivoNoApto(base, ctx)).toBeNull());
  it("SIN_EMAIL", () => expect(motivoNoApto({ ...base, email: null, claveEmail: null }, ctx)).toBe("SIN_EMAIL"));
  it("EMAIL_GENERICO", () => expect(motivoNoApto({ ...base, claveEmail: null }, ctx)).toBe("EMAIL_GENERICO"));
  it("ESTADO", () => {
    expect(motivoNoApto({ ...base, estado: "NO_CONTACTAR" }, ctx)).toBe("ESTADO");
    expect(motivoNoApto({ ...base, estado: "REVISADO" }, ctx)).toBeNull();
  });
  it("USUARIO_CLF y conocido", () => {
    expect(motivoNoApto({ ...base, vinculo: "USUARIO_CLF" }, ctx)).toBe("USUARIO_CLF");
    expect(motivoNoApto({ ...base, vinculo: "CONOCIDO_DNX_ESTUDIO" }, ctx)).toBe("CONOCIDO");
  });
  it("un colegio de la campaña de octubre no es apto", () => {
    expect(motivoNoApto({ ...base, tipo: "ESCUELA" }, { ...ctx, campanaEscolar: new Set(["a@b.com"]) })).toBe("CAMPANA_ESCOLAR");
  });
  it("YA_TIENE_HILO", () => expect(motivoNoApto(base, { ...ctx, tieneHilo: true })).toBe("YA_TIENE_HILO"));
  it("EMAIL_YA_ESCRITO", () => expect(motivoNoApto(base, { ...ctx, emailsConHilo: new Set(["a@b.com"]) })).toBe("EMAIL_YA_ESCRITO"));
  it("SIN_GRUPO", () => expect(motivoNoApto({ ...base, tipo: "OTRO" }, ctx)).toBe("SIN_GRUPO"));
  it("FUSIONADO", () => expect(motivoNoApto({ ...base, fusionadoEnId: "x" }, ctx)).toBe("FUSIONADO"));
});

describe("puntajeDatos", () => {
  it("cuenta los datos presentes", () => {
    expect(puntajeDatos({ ciudad: null, web: null, instagram: null, telefono: null, nichos: [] })).toBe(0);
    expect(puntajeDatos({ ciudad: "Rafaela", web: "x.com", instagram: "x", telefono: "1", nichos: ["SOCIAL"] })).toBe(5);
  });
});

let n = 0;
const contacto = (extra: Record<string, unknown> = {}) => {
  n++;
  const email = (extra.email as string | undefined) ?? `c${n}@x.com`;
  return B.agregar("dnxContacto", {
    tipo: "FOTOGRAFO", nombre: `C${n}`, creadoPor: "BUSCADOR", email, claveEmail: email.toLowerCase(),
    creadoEn: new Date(2026, 0, n), ...extra,
  }) as { id: string };
};
const modelo = (grupo: string) =>
  B.agregar("dnxVendedorModelo", { grupo, estado: "APROBADO", asunto: "a", cuerpo: "c", indicaciones: "i", landing: "/land" });

beforeEach(() => {
  B.vaciar();
  campana.valor = new Set();
});

describe("colaDelDia", () => {
  it("el mismo email en dos contactos: si uno ya tiene hilo, el otro no es apto", async () => {
    modelo("FOTOGRAFO:GENERAL");
    const a = contacto({ email: "dup@x.com", estado: "CONTACTADO" });
    const b = contacto({ email: "dup@x.com" });
    B.agregar("dnxVendedorHilo", { contactoId: a.id, grupo: "FOTOGRAFO:GENERAL", token: "t_aaaaaaaaaaaa" });
    const r = await colaDelDia(10, {});
    expect(r.cola).toEqual([]);
    expect(await sigueApto(b.id)).toBe("EMAIL_YA_ESCRITO");
  });

  it("prioridad: los grupos con landing propia primero y, dentro, los datos más completos", async () => {
    modelo("FOTOGRAFO:GENERAL");
    modelo("ESCUELA");
    const g = contacto({ ciudad: "X", web: "w", instagram: "i", telefono: "t" });
    const e1 = contacto({ tipo: "ESCUELA" });
    const e2 = contacto({ tipo: "ESCUELA", ciudad: "Y", web: "w" });
    const r = await colaDelDia(10, {});
    expect(r.cola.map((x) => x.contactoId)).toEqual([e2.id, e1.id, g.id]);
    expect(r.cola[0].grupo).toBe("ESCUELA");
  });

  it("un grupo sin modelo se saltea, no consume el cupo y aparece una vez en gruposSinModelo", async () => {
    modelo("ESCUELA");
    const f1 = contacto({ nichos: ["SOCIAL"] });
    contacto({ nichos: ["SOCIAL"] });
    const e1 = contacto({ tipo: "ESCUELA" });
    const e2 = contacto({ tipo: "ESCUELA" });
    const r = await colaDelDia(2, {});
    expect(r.cola.map((x) => x.contactoId)).toEqual([e1.id, e2.id]);
    expect(r.gruposSinModelo).toEqual([{ grupo: "FOTOGRAFO:SOCIAL", contactoId: f1.id }]);
  });

  it("un modelo reemplazado o sin aprobar no cuenta como vigente", async () => {
    B.agregar("dnxVendedorModelo", { grupo: "FOTOGRAFO:GENERAL", estado: "APROBADO", asunto: "a", cuerpo: "c", indicaciones: "i", landing: "/land", reemplazadoEn: new Date() });
    B.agregar("dnxVendedorModelo", { grupo: "FOTOGRAFO:GENERAL", estado: "PROPUESTO", asunto: "a", cuerpo: "c", indicaciones: "i", landing: "/land" });
    const c = contacto();
    const r = await colaDelDia(5, {});
    expect(r.cola).toEqual([]);
    expect(r.gruposSinModelo).toEqual([{ grupo: "FOTOGRAFO:GENERAL", contactoId: c.id }]);
  });

  it("sin la lista de la campaña escolar no entra ninguna escuela", async () => {
    modelo("ESCUELA");
    modelo("FOTOGRAFO:GENERAL");
    const e = contacto({ tipo: "ESCUELA" });
    const f = contacto();
    campana.valor = null;
    const r = await colaDelDia(10, {});
    expect(r.cola.map((x) => x.contactoId)).toEqual([f.id]);
    expect(await sigueApto(e.id)).toBe("CAMPANA_ESCOLAR");
  });

  it("una escuela de la campaña de octubre queda afuera", async () => {
    modelo("ESCUELA");
    const e = contacto({ tipo: "ESCUELA", email: "Cole@X.com" });
    campana.valor = new Set([(B.datos.dnxContacto.find((c) => c.id === e.id)!.claveEmail as string)]);
    expect((await colaDelDia(10, {})).cola).toEqual([]);
  });

  it("un NO_CONTACTAR que aparece después de armar la cola no sigue apto", async () => {
    modelo("FOTOGRAFO:GENERAL");
    const c = contacto();
    const r = await colaDelDia(10, {});
    expect(r.cola).toHaveLength(1);
    expect(await sigueApto(c.id)).toBeNull();
    B.datos.dnxContacto.find((x) => x.id === c.id)!.estado = "NO_CONTACTAR";
    expect(await sigueApto(c.id)).toBe("ESTADO");
  });

  it("con soloContactoPrueba, la cola es sólo ese contacto", async () => {
    modelo("FOTOGRAFO:GENERAL");
    contacto();
    const b = contacto();
    const r = await colaDelDia(10, { soloContactoId: b.id });
    expect(r.cola).toEqual([{ contactoId: b.id, grupo: "FOTOGRAFO:GENERAL" }]);
  });

  it("respeta el límite", async () => {
    modelo("FOTOGRAFO:GENERAL");
    contacto(); contacto(); contacto();
    expect((await colaDelDia(2, {})).cola).toHaveLength(2);
  });
});
