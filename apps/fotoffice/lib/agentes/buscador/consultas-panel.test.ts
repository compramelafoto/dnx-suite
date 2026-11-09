import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const P = await import("./consultas-panel");

// La base en memoria expone sus tablas sin tipos: lo mínimo que usan estos tests.
type Crear = { create: (a: { data: Record<string, unknown> }) => Promise<{ id: string }> };
const db = B.prisma as unknown as { dnxContacto: Crear; dnxContactoDato: Crear; dnxContactoEvento: Crear };

let n = 0;
async function contacto(extra: Record<string, unknown> = {}) {
  n++;
  return db.dnxContacto.create({
    data: {
      tipo: "FOTOGRAFO", nichos: ["ESCOLAR"], plataformas: ["CLF"], nombre: `Contacto ${n}`, ciudad: "Rosario",
      provincia: "Santa Fe", region: "CENTRO", creadoPor: "BUSCADOR", creadoEn: new Date(Date.UTC(2026, 10, 1, 12, n)),
      ...extra,
    },
  });
}

beforeEach(() => {
  B.vaciar();
  n = 0;
});

describe("listarContactos", () => {
  it("filtra por tipo, región y conEmail", async () => {
    const buena = await contacto({ nombre: "Luz", email: "luz@estudio.com" });
    await contacto({ nombre: "Sin correo" });
    await contacto({ nombre: "Escuela", tipo: "ESCUELA", email: "info@escuela.edu.ar" });
    await contacto({ nombre: "Patagónico", region: "PATAGONIA", email: "sur@foto.com" });

    const r = await P.listarContactos({ tipo: "FOTOGRAFO", region: "CENTRO", conEmail: true });
    expect(r.total).toBe(1);
    expect(r.filas.map((f) => f.id)).toEqual([buena.id]);
    expect(r.filas[0]).toMatchObject({ nombre: "Luz", tipo: "FOTOGRAFO", region: "CENTRO", email: "luz@estudio.com" });
  });

  it("busca por texto en nombre e instagram", async () => {
    const a = await contacto({ nombre: "Estudio Bruma" });
    const b = await contacto({ nombre: "Otra", instagram: "@brumafotos" });
    await contacto({ nombre: "Nada que ver", instagram: "@luz" });

    const r = await P.listarContactos({ texto: "  BRUMA " });
    expect(r.total).toBe(2);
    // Orden: los más nuevos primero.
    expect(r.filas.map((f) => f.id)).toEqual([b.id, a.id]);
  });

  it("filtra por nicho y por vínculo (incluido «sin vínculo»)", async () => {
    const dep = await contacto({ nichos: ["DEPORTIVA", "ESCOLAR"], vinculo: "CONOCIDO_DNX_ESTUDIO" });
    const sin = await contacto({ nichos: ["SOCIAL"] });
    expect((await P.listarContactos({ nicho: "DEPORTIVA" })).filas.map((f) => f.id)).toEqual([dep.id]);
    expect((await P.listarContactos({ vinculo: "CONOCIDO_DNX_ESTUDIO" })).filas.map((f) => f.id)).toEqual([dep.id]);
    expect((await P.listarContactos({ vinculo: "NINGUNO" })).filas.map((f) => f.id)).toEqual([sin.id]);
  });

  it("no lista los fusionados", async () => {
    const queda = await contacto();
    await contacto({ fusionadoEnId: queda.id, estado: "DESCARTADO" });
    const r = await P.listarContactos({});
    expect(r.total).toBe(1);
    expect(r.filas.map((f) => f.id)).toEqual([queda.id]);
  });

  it("pagina de a 50", async () => {
    for (let i = 0; i < 53; i++) await contacto();
    const p1 = await P.listarContactos({});
    const p2 = await P.listarContactos({ pagina: 2 });
    expect(p1).toMatchObject({ total: 53 });
    expect(p1.filas).toHaveLength(50);
    expect(p2.filas).toHaveLength(3);
  });
});

describe("filtrosDesdeQuery", () => {
  it("toma sólo valores conocidos", () => {
    const q = new URLSearchParams("tipo=ESCUELA&region=MARTE&conEmail=1&texto=luz&pagina=3&vinculo=NINGUNO");
    expect(P.filtrosDesdeQuery((k) => q.get(k) ?? undefined)).toEqual({
      tipo: "ESCUELA", conEmail: true, texto: "luz", pagina: 3, vinculo: "NINGUNO",
    });
  });
});

describe("fichaContacto", () => {
  it("trae el contacto con sus datos y eventos, y null si no existe", async () => {
    const c = await contacto();
    await db.dnxContactoDato.create({ data: { contactoId: c.id, campo: "web", valor: "luz.com", fuente: "SITIO_PROPIO", fuenteUrl: "https://luz.com" } });
    await db.dnxContactoEvento.create({ data: { contactoId: c.id, tipo: "CREADO", autor: "BUSCADOR" } });
    const f = await P.fichaContacto(c.id);
    expect(f?.contacto.id).toBe(c.id);
    expect(f?.datos).toHaveLength(1);
    expect(f?.eventos.map((e) => e.tipo)).toEqual(["CREADO"]);
    expect(await P.fichaContacto("no-existe")).toBeNull();
  });
});

describe("csvContactos", () => {
  it("el CSV escapa ; y comillas y lleva BOM", async () => {
    await contacto({ nombre: 'Luz; "Estudio"', estado: "NO_CONTACTAR", region: "BUENOS_AIRES_AMBA", nichos: ["MASCOTAS_NEWBORN_FAMILIA"] });
    const csv = await P.csvContactos({});
    expect(csv.startsWith("﻿")).toBe(true);
    const lineas = csv.slice(1).split("\r\n");
    expect(lineas[0]!.split(";")[0]).toBe("Nombre");
    expect(lineas[1]).toContain('"Luz; ""Estudio"""');
    expect(lineas[1]).toContain("No contactar");
    expect(lineas[1]).toContain("Buenos Aires y AMBA");
    expect(lineas[1]).toContain("Mascotas, newborn y familia");
  });

  it("el CSV neutraliza fórmulas: =, +, -, @ al principio llevan una comilla simple", async () => {
    await contacto({ nombre: '=HYPERLINK("x")', telefono: "+54 9 341 555 1234", web: "@evil", instagram: "-1+1" });
    const csv = await P.csvContactos({});
    const fila = csv.slice(1).split("\r\n")[1]!;
    expect(fila.startsWith(`"'=HYPERLINK(""x"")";`)).toBe(true);
    expect(fila).toContain(";'+54 9 341 555 1234;");
    expect(fila).toContain(";'@evil;");
    expect(fila).toContain(";'-1+1;");
  });
});
