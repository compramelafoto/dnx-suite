import { describe, expect, it } from "vitest";
import { CONFLICTOS, DUDAS, MOTIVOS, huellasDe } from "../campos";
import { CONTACTO, crudo, mapaDe } from "../ejemplos-alboom";
import { TIPO_CLIENTE, camposDeContacto, compartidos, crearCtxContactos, registrarContacto, traducirContacto, type ClienteExistente } from "./contactos";

const vacio = (over: Record<string, unknown> = {}) => ({
  kind: "PERSONA", firstName: null, lastName: null, businessName: null, docType: null, docNumber: null, email: null, phone: null, address: null, city: null,
  category: null, mobile: null, email2: null, birthday: null, website: null, province: null, country: null, postalCode: null, about: null, ...over,
}) as ClienteExistente["campos"];

describe("contactos → clientes", () => {
  it("normaliza correo, teléfonos con prefijo AR, documento, domicilio, cumpleaños y categoría", () => {
    const { nuevos, etiquetas, dudas } = camposDeContacto(CONTACTO);
    expect(nuevos).toMatchObject({
      kind: "PERSONA",
      firstName: "Lucía",
      lastName: "Fernández",
      email: "lucia.fernandez@correo.test",
      phone: "5493415551234",
      mobile: "5493415551234",
      docType: "DNI",
      docNumber: "30123456",
      address: "San José 1672 Local 5",
      city: "Funes",
      province: "Santa Fe",
      country: "Argentina",
      postalCode: "2132",
      birthday: "1990-05-17",
      category: "CLIENTE",
      about: "Prefiere WhatsApp",
    });
    expect(etiquetas).toEqual(["VIP", "Boda 2026"]);
    expect(dudas).toEqual([]);
    expect(camposDeContacto({ ...CONTACTO, is_company: "1", company: "Salón Las Rosas", cpf: "30-71234567-9" }).nuevos).toMatchObject({ kind: "EMPRESA", businessName: "Salón Las Rosas", docType: "CUIT", docNumber: "30712345679" });
    expect(camposDeContacto({ ...CONTACTO, type_name: "Fornecedor" }).nuevos.category).toBe("PROVEEDOR");
    expect(camposDeContacto({ ...CONTACTO, type_name: "Otra cosa" }).dudas).toEqual([DUDAS.categoriaContacto]);
    expect(camposDeContacto({ ...CONTACTO, email: "lucia@", cellular: "+55 11 98765-4321" }).dudas).toEqual([DUDAS.correoInvalido, DUDAS.telefonoRaro]);
  });

  it("crea el cliente nuevo con sus etiquetas (las que faltan en el catálogo son duda)", () => {
    const ctx = crearCtxContactos({ clientes: [], etiquetas: new Map([["vip", "t1"]]) });
    const d = traducirContacto(crudo("contactos", "7001", CONTACTO), ctx);
    expect(d).toMatchObject({ accion: "CREAR", extra: { etiquetas: ["VIP", "Boda 2026"] }, dudas: [DUDAS.etiquetaNueva] });
  });

  it("descarta datos de prueba y contactos sin nombre", () => {
    const ctx = crearCtxContactos({ clientes: [] });
    expect(traducirContacto(crudo("contactos", "1", { ...CONTACTO, email: "usuario@estudio.test" }), ctx)).toEqual({ accion: "OMITIR", motivo: MOTIVOS.datoDePrueba });
    expect(traducirContacto(crudo("contactos", "2", { ...CONTACTO, lastname: "Prueba" }), ctx)).toEqual({ accion: "OMITIR", motivo: MOTIVOS.datoDePrueba });
    expect(traducirContacto(crudo("contactos", "3", { ...CONTACTO, name: "", lastname: "" }), ctx)).toEqual({ accion: "OMITIR", motivo: MOTIVOS.sinNombre });
  });

  it("duplicados dentro de Alboom (mismo correo): el segundo se fusiona con el primero", () => {
    const ctx = crearCtxContactos({ clientes: [] });
    const primero = crudo("contactos", "7001", CONTACTO);
    const d1 = traducirContacto(primero, ctx);
    registrarContacto(ctx, primero, d1, "sim:contactos/7001");
    const d2 = traducirContacto(crudo("contactos", "7002", { ...CONTACTO, id: "7002", email: "LUCIA.FERNANDEZ@correo.test", name: "Lucia", lastname: "Fernandez" }), ctx);
    expect(d2).toMatchObject({ accion: "OMITIR", motivo: MOTIVOS.duplicadoAlboom, targetId: "sim:contactos/7001", fusionadoCon: "7001" });
  });

  it("empareja con un cliente existente por correo y, si no, por teléfono; sólo completa lo vacío", () => {
    const porCorreo: ClienteExistente = { id: "c1", campos: vacio({ firstName: "Lucía", lastName: "Fernández de Paz", email: "lucia.fernandez@correo.test" }), tagKeys: ["vip"] };
    const d = traducirContacto(crudo("contactos", "7001", CONTACTO), crearCtxContactos({ clientes: [porCorreo], etiquetas: new Map([["vip", "t1"]]) }));
    expect(d).toMatchObject({ accion: "ACTUALIZAR", targetId: "c1", vincula: true, conservados: ["lastName"], extra: { etiquetas: ["Boda 2026"] } });
    expect(d.datos).toMatchObject({ phone: "5493415551234", city: "Funes", docNumber: "30123456" });
    expect(d.datos).not.toHaveProperty("lastName");
    const porTelefono: ClienteExistente = { id: "c2", campos: vacio({ firstName: "Lucía", lastName: "Fernández", phone: "3415551234" }), tagKeys: [] };
    expect(traducirContacto(crudo("contactos", "7001", { ...CONTACTO, email: "" }), crearCtxContactos({ clientes: [porTelefono] }))).toMatchObject({ targetId: "c2", vincula: true });
  });

  it("por teléfono no empareja si los correos se contradicen, ni con otro contacto de Alboom (una pareja comparte teléfono)", () => {
    const conOtroCorreo: ClienteExistente = { id: "c3", campos: vacio({ firstName: "Pablo", phone: "5493415551234", email: "pablo@correo.test" }), tagKeys: [] };
    expect(traducirContacto(crudo("contactos", "7001", CONTACTO), crearCtxContactos({ clientes: [conOtroCorreo] })).accion).toBe("CREAR");
    const ctx = crearCtxContactos({ clientes: [] });
    const lucia = crudo("contactos", "7001", CONTACTO);
    registrarContacto(ctx, lucia, traducirContacto(lucia, ctx), "cli-lucia");
    const pareja = crudo("contactos", "7005", { ...CONTACTO, id: "7005", name: "Pablo", email: "", rg: "" });
    expect(traducirContacto(pareja, ctx).accion).toBe("CREAR");
  });

  it("ya cargado: actualiza lo que Alboom cambió, conserva lo editado y no vuelve a poner etiquetas sacadas", () => {
    const antes = crudo("contactos", "7001", CONTACTO);
    const { nuevos } = camposDeContacto(CONTACTO);
    const editado: ClienteExistente = { id: "c1", campos: vacio({ ...nuevos, city: "Roldán" }), tagKeys: ["boda 2026"] };
    const ctx = crearCtxContactos({ clientes: [editado] });
    const huellas = { ...huellasDe(nuevos) };
    // La carga anterior trajo "VIP" y alguien la sacó en FOTOFFICE.
    const previo = traducirContacto(antes, crearCtxContactos({ clientes: [] }));
    ctx.mapa.set("7001", mapaDe(antes, TIPO_CLIENTE, "c1", { ...huellas, ...previo.huellas }));
    const d = traducirContacto(crudo("contactos", "7001", { ...CONTACTO, city: "Rosario", memo: "Nuevo memo" }), ctx);
    expect(d).toMatchObject({ accion: "ACTUALIZAR", datos: { about: "Nuevo memo" }, conservados: ["city"] });
    expect(d.extra).toBeUndefined();
    expect(traducirContacto(antes, ctx)).toEqual({ accion: "IGUAL", targetId: "c1", escribirMapa: false });
  });

  it("si lo borraron en FOTOFFICE después de cargarlo, no se recrea", () => {
    const c = crudo("contactos", "7001", CONTACTO);
    const ctx = crearCtxContactos({ clientes: [] });
    ctx.mapa.set("7001", mapaDe(c, TIPO_CLIENTE, "c-borrado"));
    expect(traducirContacto(crudo("contactos", "7001", { ...CONTACTO, city: "Rosario" }), ctx)).toEqual({ accion: "OMITIR", motivo: MOTIVOS.borradoEnFotoffice });
  });

  it("tolera payloads raros", () => {
    const ctx = crearCtxContactos({ clientes: [] });
    for (const p of [null, 12, [], { name: 5 }, { name: "Ana", birthday: "0000-00-00", tags: 3, phone: {} }]) {
      expect(() => traducirContacto(crudo("contactos", "x", p), ctx)).not.toThrow();
    }
    expect(traducirContacto(crudo("contactos", "y", { name: "Ana", birthday: "0000-00-00" }), ctx)).toMatchObject({ accion: "CREAR", datos: { firstName: "Ana", birthday: null } });
  });

  describe("un correo o un teléfono solos no alcanzan", () => {
    const juan = { ...CONTACTO, id: "8001", name: "Juan", lastname: "Pérez", rg: "", birthday: "", address1: "", address2: "", tags: "" };
    const maria = { ...CONTACTO, id: "8002", name: "María", lastname: "Gómez", rg: "25111222", birthday: "1985-01-01", tags: "" };

    it("correo de relleno: no se guarda ni se usa para fusionar ni emparejar", () => {
      const ctx = crearCtxContactos({ clientes: [{ id: "c9", campos: vacio({ firstName: "Pedro", lastName: "Sosa", email: "sincorreo@gmail.com" }), tagKeys: [] }] });
      const a = crudo("contactos", "8001", { ...juan, email: "sincorreo@gmail.com" });
      const da = traducirContacto(a, ctx);
      expect(da).toMatchObject({ accion: "CREAR", datos: { email: null }, dudas: [DUDAS.correoDeRelleno] });
      registrarContacto(ctx, a, da, "cli-juan");
      expect(traducirContacto(crudo("contactos", "8002", { ...maria, email: "SinCorreo@gmail.com" }), ctx)).toMatchObject({ accion: "CREAR", datos: { email: null } });
    });

    it("el correo del propio estudio es de relleno", () => {
      const ctx = crearCtxContactos({ clientes: [], delEstudio: ["Hola@DnxEstudio.com"] });
      expect(traducirContacto(crudo("contactos", "8001", { ...juan, email: "hola@dnxestudio.com" }), ctx)).toMatchObject({ accion: "CREAR", datos: { email: null } });
    });

    it("mismo correo con otro nombre: dos clientes y conflicto «correo compartido» (sólo ids)", () => {
      const ctx = crearCtxContactos({ clientes: [] });
      const a = crudo("contactos", "8001", { ...juan, email: "familia@correo.test" });
      registrarContacto(ctx, a, traducirContacto(a, ctx), "cli-juan");
      const d = traducirContacto(crudo("contactos", "8002", { ...maria, email: "familia@correo.test" }), ctx);
      // El correo es de otra persona: a éste no se le guarda.
      expect(d).toMatchObject({ accion: "CREAR", conflictos: [CONFLICTOS.correoCompartido], datos: { email: null } });
    });

    it("mismo correo que un cliente existente con otro nombre: no se le completa nada, se crea aparte", () => {
      const existente: ClienteExistente = { id: "c1", campos: vacio({ firstName: "Juan", lastName: "Pérez", email: "familia@correo.test" }), tagKeys: [] };
      const d = traducirContacto(crudo("contactos", "8002", { ...maria, email: "familia@correo.test" }), crearCtxContactos({ clientes: [existente] }));
      expect(d).toMatchObject({ accion: "CREAR", conflictos: [CONFLICTOS.correoCompartido], datos: { email: null } });
      expect(existente.campos.docNumber).toBeNull();
    });

    it("correo usado por 3 o más contactos de nombres distintos: no se usa para emparejar", () => {
      const lista = [juan, maria, { ...juan, id: "8003", name: "Ana", lastname: "Ruiz" }].map((p) => ({ ...p, email: "oficina@colegio.test" }));
      const { correos } = compartidos(lista);
      expect([...correos]).toEqual(["oficina@colegio.test"]);
      const existente: ClienteExistente = { id: "c1", campos: vacio({ firstName: "Juan", lastName: "Pérez", email: "oficina@colegio.test" }), tagKeys: [] };
      const d = traducirContacto(crudo("contactos", "8001", lista[0]), crearCtxContactos({ clientes: [existente], correosCompartidos: correos }));
      expect(d).toMatchObject({ accion: "CREAR", conflictos: [CONFLICTOS.correoDeVarios], datos: { email: null } });
    });

    it("mismo correo y nombre compatible: se empareja con el existente", () => {
      const existente: ClienteExistente = { id: "c1", campos: vacio({ firstName: "Juan Carlos", lastName: "Pérez", email: "jp@correo.test" }), tagKeys: [] };
      expect(traducirContacto(crudo("contactos", "8001", { ...juan, email: "JP@correo.test" }), crearCtxContactos({ clientes: [existente] }))).toMatchObject({ targetId: "c1", vincula: true });
    });

    it("sólo teléfono con otro nombre: no empareja ni completa correo, DNI ni cumpleaños", () => {
      const existente: ClienteExistente = { id: "c1", campos: vacio({ firstName: "Juan", lastName: "Pérez", phone: "5493415551234" }), tagKeys: [] };
      const d = traducirContacto(crudo("contactos", "8002", { ...maria, email: "maria@correo.test" }), crearCtxContactos({ clientes: [existente] }));
      expect(d.accion).toBe("CREAR");
      expect(existente.campos).toMatchObject({ email: null, docNumber: null, birthday: null });
    });

    it("teléfono compartido por varios contactos de Alboom: no se usa para emparejar", () => {
      const existente: ClienteExistente = { id: "c1", campos: vacio({ firstName: "Juan", lastName: "Pérez", phone: "5493415551234" }), tagKeys: [] };
      const ctx = crearCtxContactos({ clientes: [existente], telefonosCompartidos: new Set(["3415551234"]) });
      expect(traducirContacto(crudo("contactos", "8001", { ...juan, email: "" }), ctx).accion).toBe("CREAR");
      expect(traducirContacto(crudo("contactos", "8001", { ...juan, email: "" }), crearCtxContactos({ clientes: [existente] }))).toMatchObject({ targetId: "c1" });
    });
  });

  it("sólo por teléfono (nombre compatible): no le pasa correo, documento, cumpleaños, domicilio ni etiquetas", () => {
    const existente: ClienteExistente = { id: "c1", campos: vacio({ firstName: "Lucía", lastName: "Fernández", phone: null, mobile: "5493415551234" }), tagKeys: [] };
    const d = traducirContacto(crudo("contactos", "7001", { ...CONTACTO, phone: "341 4000000" }), crearCtxContactos({ clientes: [existente] }));
    expect(d).toMatchObject({ accion: "ACTUALIZAR", targetId: "c1", datos: { phone: "543414000000" } });
    expect(Object.keys(d.datos!)).toEqual(["phone"]);
    expect(d.extra).toBeUndefined();
  });
});
