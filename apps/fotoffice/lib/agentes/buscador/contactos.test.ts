import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const C = await import("./contactos");
import type { Candidato } from "./contactos";

const WS_DNX = "cmv5z6qxwwmmhf0q5gp8qja1j";
const AHORA = new Date("2026-11-08T15:00:00.000Z");

const candidato = (extra: Partial<Candidato> = {}): Candidato => ({
  tipo: "FOTOGRAFO",
  nichos: ["ESCOLAR"],
  nombre: "Luz Estudio",
  ciudad: "Rosario",
  provincia: "Santa Fe",
  region: "CENTRO",
  datos: { web: { valor: "https://www.luzestudio.com.ar/", fuente: "SITIO_PROPIO", fuenteUrl: "https://www.luzestudio.com.ar/" } },
  creadoPor: "BUSCADOR",
  ...extra,
});

const contactos = () => B.datos.dnxContacto;
const datosDe = (id: string) => B.datos.dnxContactoDato.filter((d) => d.contactoId === id);
const eventosDe = (id: string) => B.datos.dnxContactoEvento.filter((e) => e.contactoId === id);

beforeEach(() => B.vaciar());

describe("guardarCandidato", () => {
  it("crea un contacto nuevo con su dato y fuente", async () => {
    const r = await C.guardarCandidato(candidato(), { ahora: () => AHORA });
    expect(r).toMatchObject({ nuevo: true, datosNuevos: 1 });
    expect(contactos()).toHaveLength(1);
    const c = contactos()[0]!;
    expect(c).toMatchObject({
      id: r.contactoId, nombre: "Luz Estudio", web: "https://www.luzestudio.com.ar/", claveDominio: "luzestudio.com.ar",
      plataformas: ["CLF", "FOTOFFICE"], nichos: ["ESCOLAR"], estado: "NUEVO", creadoPor: "BUSCADOR",
      claveNombreCiudad: "luz|rosario",
    });
    const datos = datosDe(r.contactoId);
    expect(datos).toHaveLength(1);
    expect(datos[0]).toMatchObject({ campo: "web", fuente: "SITIO_PROPIO", fuenteUrl: "https://www.luzestudio.com.ar/" });
    const ev = eventosDe(r.contactoId);
    expect(ev.map((e) => e.tipo)).toEqual(["CREADO"]);
    expect(ev[0]).toMatchObject({ datos: { creadoPor: "BUSCADOR" }, autor: "BUSCADOR" });
    expect(B.transacciones.length).toBeGreaterThanOrEqual(1);
  });

  it("el mismo dominio web suma datos en vez de duplicar", async () => {
    const a = await C.guardarCandidato(candidato());
    const b = await C.guardarCandidato(candidato({
      nombre: "Luz Fotografía Escolar",
      ciudad: "Funes",
      nichos: ["DEPORTIVA"],
      datos: {
        web: { valor: "luzestudio.com.ar", fuente: "WEB_SEARCH", fuenteUrl: "https://buscador/1" },
        instagram: { valor: "@luz.estudio", fuente: "WEB_SEARCH", fuenteUrl: "https://buscador/1" },
      },
    }));
    expect(b).toEqual({ contactoId: a.contactoId, nuevo: false, datosNuevos: 1 });
    expect(contactos()).toHaveLength(1);
    const c = contactos()[0]!;
    expect(c).toMatchObject({ nombre: "Luz Estudio", ciudad: "Rosario", instagram: "@luz.estudio", claveInstagram: "luz.estudio" });
    expect(c.nichos).toEqual(["ESCOLAR", "DEPORTIVA"]);
    expect(eventosDe(a.contactoId).map((e) => e.tipo)).toEqual(["CREADO", "DATO_NUEVO"]);
  });

  it("el mismo instagram empareja", async () => {
    const a = await C.guardarCandidato(candidato({ datos: { instagram: { valor: "https://instagram.com/luz.estudio/", fuente: "SITIO_PROPIO", fuenteUrl: null } } }));
    const b = await C.guardarCandidato(candidato({ nombre: "Otra cosa", ciudad: "Córdoba", datos: { instagram: { valor: "@Luz.Estudio", fuente: "WEB_SEARCH", fuenteUrl: null } } }));
    expect(b).toMatchObject({ contactoId: a.contactoId, nuevo: false, datosNuevos: 0 });
    expect(contactos()).toHaveLength(1);
  });

  it("el mismo googlePlaceId empareja aunque cambie el nombre", async () => {
    const a = await C.guardarCandidato(candidato({ googlePlaceId: "ChIJ123", datos: {} }));
    const b = await C.guardarCandidato(candidato({ googlePlaceId: "ChIJ123", nombre: "Nombre nuevo", ciudad: "Funes", datos: {} }));
    expect(b).toMatchObject({ contactoId: a.contactoId, nuevo: false });
    expect(contactos()).toHaveLength(1);
  });

  it("no pisa un email existente distinto; lo guarda como dato adicional", async () => {
    const a = await C.guardarCandidato(candidato({ datos: {
      instagram: { valor: "@luz.estudio", fuente: "SITIO_PROPIO", fuenteUrl: null },
      email: { valor: "luz@luzestudio.com.ar", fuente: "SITIO_PROPIO", fuenteUrl: "https://luzestudio.com.ar/contacto" },
    } }));
    const b = await C.guardarCandidato(candidato({ datos: {
      instagram: { valor: "@luz.estudio", fuente: "WEB_SEARCH", fuenteUrl: null },
      email: { valor: "otra@gmail.com", fuente: "WEB_SEARCH", fuenteUrl: "https://directorio/x" },
    } }));
    expect(b).toMatchObject({ contactoId: a.contactoId, nuevo: false, datosNuevos: 1 });
    expect(contactos()[0]).toMatchObject({ email: "luz@luzestudio.com.ar", claveEmail: "luz@luzestudio.com.ar" });
    const emails = datosDe(a.contactoId).filter((d) => d.campo === "email").map((d) => d.valor);
    expect(emails).toEqual(["luz@luzestudio.com.ar", "otra@gmail.com"]);
  });

  it("un teléfono repetido en 3 ciudades no fusiona", async () => {
    for (const ciudad of ["Rosario", "Córdoba", "Mendoza"]) {
      B.agregar("dnxContacto", { tipo: "CLUB", nombre: `Club ${ciudad}`, ciudad, creadoPor: "BUSCADOR", telefono: "0810 555 1234", claveTelefono: "+548105551234" });
    }
    const r = await C.guardarCandidato(candidato({ ciudad: "Salta", datos: { telefono: { valor: "(0810) 555-1234", fuente: "SITIO_PROPIO", fuenteUrl: null } } }));
    expect(r.nuevo).toBe(true);
    expect(contactos()).toHaveLength(4);
  });

  it("un teléfono repetido en 2 ciudades sí empareja", async () => {
    for (const ciudad of ["Rosario", "Córdoba"]) {
      B.agregar("dnxContacto", { tipo: "CLUB", nombre: `Club ${ciudad}`, ciudad, creadoPor: "BUSCADOR", claveTelefono: "+543415551234" });
    }
    const r = await C.guardarCandidato(candidato({ nombre: "Otro", datos: { telefono: { valor: "341 555 1234", fuente: "SITIO_PROPIO", fuenteUrl: null } } }));
    expect(r.nuevo).toBe(false);
  });

  it("un email repetido en 3 ciudades no fusiona", async () => {
    for (const ciudad of ["Rosario", "Córdoba", "Mendoza"]) {
      B.agregar("dnxContacto", { tipo: "CLUB", nombre: `Club ${ciudad}`, ciudad, creadoPor: "BUSCADOR", claveEmail: "secretaria@federacion.org.ar" });
    }
    const r = await C.guardarCandidato(candidato({ ciudad: "Salta", datos: { email: { valor: "Secretaria@Federacion.org.ar", fuente: "WEB_SEARCH", fuenteUrl: null } } }));
    expect(r.nuevo).toBe(true);
    expect(contactos()).toHaveLength(4);
  });

  it("un contacto NO_CONTACTAR que reaparece sigue NO_CONTACTAR", async () => {
    const a = await C.guardarCandidato(candidato());
    expect(await C.cambiarEstado(a.contactoId, "NO_CONTACTAR", "7")).toEqual({ ok: true });
    const b = await C.guardarCandidato(candidato({ datos: {
      web: { valor: "luzestudio.com.ar", fuente: "WEB_SEARCH", fuenteUrl: null },
      email: { valor: "luz@luzestudio.com.ar", fuente: "WEB_SEARCH", fuenteUrl: null },
    } }));
    expect(b.contactoId).toBe(a.contactoId);
    expect(contactos()[0]!.estado).toBe("NO_CONTACTAR");
  });

  it("rechaza datos con fuente GOOGLE_PLACES", async () => {
    const malo = candidato({ datos: { web: { valor: "x.com.ar", fuente: "GOOGLE_PLACES" as never, fuenteUrl: null } } });
    await expect(C.guardarCandidato(malo)).rejects.toThrow(/GOOGLE_PLACES/);
    expect(contactos()).toHaveLength(0);
  });

  it("vincula con un cliente de DNX Estudio por email", async () => {
    B.agregar("client", { workspaceId: WS_DNX, clientNumber: 1, firstName: "Luz", email: " Luz@LuzEstudio.com.ar ", phone: null });
    const cliente = B.datos.client[0]!;
    const r = await C.guardarCandidato(candidato({ datos: { email: { valor: "luz@luzestudio.com.ar", fuente: "SITIO_PROPIO", fuenteUrl: null } } }));
    expect(contactos()[0]).toMatchObject({ vinculo: "CONOCIDO_DNX_ESTUDIO", vinculoId: cliente.id });
    expect(eventosDe(r.contactoId).map((e) => e.tipo)).toEqual(["CREADO", "VINCULADO"]);
  });

  it("vincula por el celular del perfil y no mira otros workspaces", async () => {
    B.agregar("client", { workspaceId: "otro-ws", clientNumber: 1, email: "luz@luzestudio.com.ar", phone: null });
    B.agregar("client", { workspaceId: WS_DNX, clientNumber: 2, email: null, phone: null });
    const cliente = B.datos.client[1]!;
    B.agregar("fotofficeContactoPerfil", { workspaceId: WS_DNX, clientId: cliente.id, mobile: "+54 9 341 555-1234" });
    await C.guardarCandidato(candidato({ datos: {
      email: { valor: "luz@luzestudio.com.ar", fuente: "SITIO_PROPIO", fuenteUrl: null },
      telefono: { valor: "0341 555-1234", fuente: "SITIO_PROPIO", fuenteUrl: null },
    } }));
    expect(contactos()[0]).toMatchObject({ vinculo: "CONOCIDO_DNX_ESTUDIO", vinculoId: cliente.id });
  });
});

describe("cambiarEstado", () => {
  it("cambiarEstado no saca de NO_CONTACTAR sin forzar", async () => {
    const { contactoId } = await C.guardarCandidato(candidato());
    await C.cambiarEstado(contactoId, "NO_CONTACTAR", "7");
    const r = await C.cambiarEstado(contactoId, "CONTACTADO", "7");
    expect(r.ok).toBe(false);
    expect(r.motivo).toBeTruthy();
    // Un agente no puede ni forzando.
    expect((await C.cambiarEstado(contactoId, "CONTACTADO", "BUSCADOR", { forzar: true })).ok).toBe(false);
    expect(contactos()[0]!.estado).toBe("NO_CONTACTAR");
    // Una persona, forzando, sí.
    expect(await C.cambiarEstado(contactoId, "REVISADO", "7", { forzar: true })).toEqual({ ok: true });
    expect(contactos()[0]!.estado).toBe("REVISADO");
    const estados = eventosDe(contactoId).filter((e) => e.tipo === "ESTADO").map((e) => e.datos);
    expect(estados).toEqual([{ de: "NUEVO", a: "NO_CONTACTAR" }, { de: "NO_CONTACTAR", a: "REVISADO", forzado: true }]);
  });
});

describe("notas y edición", () => {
  it("agrega una nota y edita un dato con fuente MANUAL", async () => {
    const { contactoId } = await C.guardarCandidato(candidato());
    await C.agregarNota(contactoId, "Lo conocí en la expo", "7");
    await C.editarDato(contactoId, "email", "luz@luzestudio.com.ar", "7");
    expect(contactos()[0]).toMatchObject({ email: "luz@luzestudio.com.ar", claveEmail: "luz@luzestudio.com.ar" });
    expect(datosDe(contactoId).at(-1)).toMatchObject({ campo: "email", fuente: "MANUAL", valor: "luz@luzestudio.com.ar" });
    await C.editarDato(contactoId, "email", null, "7");
    expect(contactos()[0]).toMatchObject({ email: null, claveEmail: null });
    expect(eventosDe(contactoId).map((e) => e.tipo)).toEqual(["CREADO", "NOTA", "DATO_NUEVO", "DATO_NUEVO"]);
  });
});

describe("fusionar", () => {
  it("fusionar mueve datos y deja el origen DESCARTADO", async () => {
    const a = await C.guardarCandidato(candidato());
    const b = await C.guardarCandidato(candidato({ nombre: "Otra", ciudad: "Córdoba", datos: {
      instagram: { valor: "@otra", fuente: "WEB_SEARCH", fuenteUrl: null },
    } }));
    await C.fusionar(b.contactoId, a.contactoId, "7");
    const origen = contactos().find((c) => c.id === b.contactoId)!;
    const destino = contactos().find((c) => c.id === a.contactoId)!;
    expect(origen).toMatchObject({ estado: "DESCARTADO", fusionadoEnId: a.contactoId });
    expect(destino).toMatchObject({ instagram: "@otra" });
    expect(datosDe(b.contactoId)).toHaveLength(0);
    expect(datosDe(a.contactoId).map((d) => d.campo).sort()).toEqual(["instagram", "web"]);
    expect(eventosDe(b.contactoId).map((e) => e.tipo)).toEqual(["FUSIONADO"]);
    expect(eventosDe(a.contactoId).filter((e) => e.tipo === "FUSIONADO")).toHaveLength(1);
    expect(eventosDe(a.contactoId).filter((e) => e.tipo === "CREADO")).toHaveLength(2);
    // Lo que vuelva con las claves del origen cae en el destino.
    const c = await C.guardarCandidato(candidato({ nombre: "X", ciudad: "Y", datos: { instagram: { valor: "@otra", fuente: "WEB_SEARCH", fuenteUrl: null } } }));
    expect(c.contactoId).toBe(a.contactoId);
  });

  it("si el origen era NO_CONTACTAR, el destino queda NO_CONTACTAR", async () => {
    const a = await C.guardarCandidato(candidato());
    const b = await C.guardarCandidato(candidato({ nombre: "Otra", ciudad: "Córdoba", datos: {} }));
    await C.cambiarEstado(b.contactoId, "NO_CONTACTAR", "7");
    await C.fusionar(b.contactoId, a.contactoId, "7");
    expect(contactos().find((c) => c.id === a.contactoId)!.estado).toBe("NO_CONTACTAR");
  });
});
