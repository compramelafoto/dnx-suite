import { describe, expect, it } from "vitest";
import { CLIENT_DATA_KEY } from "./constants";
import {
  readFieldValues,
  readRemoteUpdatedAt,
  readSourceMarker,
  toGooglePersonBody,
  type GooglePerson,
  type SyncablePerson,
} from "./person";

const socio = (over: Partial<SyncablePerson> = {}): SyncablePerson => ({
  sourceId: "m-1",
  values: {
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@ejemplo.com",
    phone: "+54 9 342 5550000",
    address: "San Martín 1234",
    city: "Rosario",
    province: "Santa Fe",
    postalCode: "3000",
    birthDate: "1985-04-12",
  },
  organization: "Estudio Pérez",
  labels: { "Nº de socio": "124", Categoría: "Activo", Estado: "Al día" },
  updatedAt: new Date("2026-09-16T10:00:00Z"),
  ...over,
});

describe("armar el contacto que se le manda a Google", () => {
  it("manda nombre, apellido, mail, teléfono, dirección y cumpleaños", () => {
    const body = toGooglePersonBody(socio(), { moduleKey: "members", groupResourceName: null });
    expect(body).toMatchObject({
      names: [{ givenName: "Ana", familyName: "Pérez" }],
      emailAddresses: [{ value: "ana@ejemplo.com", type: "work" }],
      phoneNumbers: [{ value: "+54 9 342 5550000", type: "mobile" }],
      birthdays: [{ date: { year: 1985, month: 4, day: 12 } }],
    });
  });

  it("la dirección se mapea sin cruzar city ↔ region: cada subcampo va al lugar correcto", () => {
    // Si alguien invierte city ↔ region, la sincronización reescribe el padrón en cada corrida.
    const body = toGooglePersonBody(socio(), { moduleKey: "members", groupResourceName: null });
    expect(body.addresses).toEqual([
      {
        streetAddress: "San Martín 1234",
        city: "Rosario",
        region: "Santa Fe",
        postalCode: "3000",
        type: "home",
      },
    ]);
  });

  it("firma el contacto para poder reconocerlo después", () => {
    // Sin esta marca, la corrida siguiente lo ve como un contacto ajeno de la cuenta.
    const body = toGooglePersonBody(socio(), { moduleKey: "members", groupResourceName: null });
    expect(body.clientData).toEqual([{ key: CLIENT_DATA_KEY, value: "members:m-1" }]);
  });

  it("el número de socio y la categoría van a la vista, para que sirvan cuando llama", () => {
    const body = toGooglePersonBody(socio(), { moduleKey: "members", groupResourceName: null });
    expect(body.userDefined).toEqual([
      { key: "Nº de socio", value: "124" },
      { key: "Categoría", value: "Activo" },
      { key: "Estado", value: "Al día" },
    ]);
  });

  it("lo mete en el grupo del módulo cuando el grupo ya existe", () => {
    const body = toGooglePersonBody(socio(), {
      moduleKey: "members",
      groupResourceName: "contactGroups/abc",
    });
    expect(body.memberships).toEqual([
      { contactGroupMembership: { contactGroupResourceName: "contactGroups/abc" } },
    ]);
  });

  it("un campo vacío no se manda vacío: se omite", () => {
    // Mandar `emailAddresses: [{value: ""}]` crea un mail en blanco en la agenda.
    const sinMail = socio({ values: { ...socio().values, email: null, phone: null } });
    const body = toGooglePersonBody(sinMail, { moduleKey: "members", groupResourceName: null });
    expect(body.emailAddresses).toBeUndefined();
    expect(body.phoneNumbers).toBeUndefined();
  });

  it("un socio sin apellido se manda igual, con el apellido en blanco", () => {
    // Pasa de verdad en el padrón. Omitir `names` entero dejaría el contacto sin nombre.
    const sinApellido = socio({ values: { ...socio().values, lastName: null } });
    const body = toGooglePersonBody(sinApellido, { moduleKey: "members", groupResourceName: null });
    expect(body.names).toEqual([{ givenName: "Ana", familyName: "" }]);
  });

  it("un cumpleaños sin año se manda igual: hay socios que solo dan día y mes", () => {
    const sinAnio = socio({ values: { ...socio().values, birthDate: "--04-12" } });
    const body = toGooglePersonBody(sinAnio, { moduleKey: "members", groupResourceName: null });
    expect(body.birthdays).toEqual([{ date: { month: 4, day: 12 } }]);
  });
});

describe("leer lo que Google devuelve", () => {
  const deGoogle: GooglePerson = {
    resourceName: "people/c1",
    etag: "%eTag1",
    names: [{ givenName: "Ana", familyName: "Pérez" }],
    emailAddresses: [{ value: "otro@ejemplo.com" }],
    phoneNumbers: [{ value: "342 5551111" }],
    addresses: [
      { streetAddress: "San Martín 1234", city: "Rosario", region: "Santa Fe", postalCode: "3000" },
    ],
    birthdays: [{ date: { year: 1985, month: 4, day: 12 } }],
    clientData: [{ key: CLIENT_DATA_KEY, value: "members:m-1" }],
    metadata: { sources: [{ updateTime: "2026-09-16T11:30:00Z" }] },
  };

  it("reconoce un contacto propio y de qué registro salió", () => {
    expect(readSourceMarker(deGoogle)).toEqual({ moduleKey: "members", sourceId: "m-1" });
  });

  it("un contacto ajeno no tiene marca, y eso lo deja afuera de la sincronización", () => {
    expect(readSourceMarker({ resourceName: "people/c9", names: [{ givenName: "Plomero" }] })).toBeNull();
  });

  it("una marca con formato raro no se interpreta a medias: se descarta", () => {
    const rota: GooglePerson = { clientData: [{ key: CLIENT_DATA_KEY, value: "members" }] };
    expect(readSourceMarker(rota)).toBeNull();
  });

  it("lee los campos que después se comparan con el padrón", () => {
    expect(readFieldValues(deGoogle)).toEqual({
      firstName: "Ana",
      lastName: "Pérez",
      email: "otro@ejemplo.com",
      phone: "342 5551111",
      address: "San Martín 1234",
      city: "Rosario",
      province: "Santa Fe",
      postalCode: "3000",
      birthDate: "1985-04-12",
    });
  });

  it("un contacto sin nada devuelve todos los campos en null, no rompe", () => {
    expect(readFieldValues({}).email).toBeNull();
  });

  it("lee cuándo se tocó por última vez del lado de Google", () => {
    expect(readRemoteUpdatedAt(deGoogle)?.toISOString()).toBe("2026-09-16T11:30:00.000Z");
  });

  it("si Google no dice cuándo, no se inventa una fecha", () => {
    // Devolver `new Date()` acá haría que Google gane TODOS los conflictos.
    expect(readRemoteUpdatedAt({})).toBeNull();
  });

  it("de varias fechas de modificación se queda con la más reciente", () => {
    const varias: GooglePerson = {
      metadata: {
        sources: [{ updateTime: "2026-09-10T10:00:00Z" }, { updateTime: "2026-09-16T11:30:00Z" }],
      },
    };
    expect(readRemoteUpdatedAt(varias)?.toISOString()).toBe("2026-09-16T11:30:00.000Z");
  });
});
