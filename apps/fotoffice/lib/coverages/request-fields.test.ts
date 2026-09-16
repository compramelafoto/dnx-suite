import { describe, expect, it } from "vitest";
import {
  allRequestSections,
  DEFAULT_REQUEST_FORM_CONFIG,
  FIXED_REQUEST_FIELD_KEYS,
  parseRequestFieldStates,
  REQUEST_FIELDS,
  REQUEST_FIELD_SECTIONS,
  requestFieldStateInputName,
  resolveRequestFieldState,
  resolveRequestFieldStates,
  visibleRequestSections,
} from "./request-fields";

const campo = (key: string) => REQUEST_FIELDS.find((f) => f.key === key)!;

describe("el catálogo de campos", () => {
  it("tiene los 23 campos del formulario, cinco de ellos fijos", () => {
    expect(REQUEST_FIELDS).toHaveLength(23);
    expect(FIXED_REQUEST_FIELD_KEYS).toEqual([
      "orgName",
      "contactEmail",
      "eventTitle",
      "startsAt",
      "endsAt",
    ]);
  });

  it("no repite claves: la clave es el contrato con el parseo y con el `name` del formulario", () => {
    const claves = REQUEST_FIELDS.map((f) => f.key);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("cada campo pertenece a una sección declarada", () => {
    const secciones = new Set(REQUEST_FIELD_SECTIONS.map((s) => s.key));
    for (const f of REQUEST_FIELDS) expect(secciones.has(f.section)).toBe(true);
  });

  it("todo campo fijo explica por qué lo es: la pantalla lo muestra en vez de esconderlo", () => {
    for (const f of REQUEST_FIELDS.filter((x) => x.fixed)) {
      expect(f.fixedReason?.trim()).toBeTruthy();
    }
  });
});

describe("resolveRequestFieldState", () => {
  it("un campo fijo es obligatorio aunque las listas digan otra cosa", () => {
    // Las listas se pueden editar a mano en la base; la regla no confía en la pantalla.
    const config = { hidden: ["orgName", "startsAt"], required: [] };
    expect(resolveRequestFieldState(campo("orgName"), config)).toBe("OBLIGATORIO");
    expect(resolveRequestFieldState(campo("startsAt"), config)).toBe("OBLIGATORIO");
  });

  it("oculto gana cuando un campo quedó en las dos listas", () => {
    const config = { hidden: ["contactPhone"], required: ["contactPhone"] };
    expect(resolveRequestFieldState(campo("contactPhone"), config)).toBe("OCULTO");
  });

  it("lo que no está en ninguna lista es opcional", () => {
    expect(resolveRequestFieldState(campo("city"), { hidden: [], required: [] })).toBe("OPCIONAL");
  });

  it("estar en la lista de obligatorios alcanza para exigirlo", () => {
    expect(resolveRequestFieldState(campo("city"), { hidden: [], required: ["city"] })).toBe(
      "OBLIGATORIO",
    );
  });
});

describe("la configuración por omisión", () => {
  it("reproduce el formulario de hoy: todo visible y sólo los fijos más `contactName` obligatorios", () => {
    const estados = resolveRequestFieldStates(DEFAULT_REQUEST_FORM_CONFIG);
    const obligatorios = Object.entries(estados)
      .filter(([, estado]) => estado === "OBLIGATORIO")
      .map(([clave]) => clave)
      .sort();
    expect(obligatorios).toEqual(
      ["orgName", "contactEmail", "eventTitle", "startsAt", "endsAt", "contactName"].sort(),
    );
    expect(Object.values(estados).some((e) => e === "OCULTO")).toBe(false);
  });

  it("no esconde nada: ninguna institución ve un cambio hasta que lo configure", () => {
    expect(DEFAULT_REQUEST_FORM_CONFIG.hidden).toEqual([]);
    const secciones = visibleRequestSections(DEFAULT_REQUEST_FORM_CONFIG);
    expect(secciones).toHaveLength(3);
    expect(secciones.reduce((n, s) => n + s.fields.length, 0)).toBe(23);
  });
});

describe("visibleRequestSections", () => {
  it("saca los campos ocultos", () => {
    const secciones = visibleRequestSections({ hidden: ["orgTaxId", "orgWebsite"], required: [] });
    const claves = secciones.flatMap((s) => s.fields.map((f) => f.key));
    expect(claves).not.toContain("orgTaxId");
    expect(claves).not.toContain("orgWebsite");
  });

  it("una sección sin ningún campo visible no se muestra", () => {
    // "Qué necesitan" son todos configurables: apagados los seis, la sección entera sobra.
    const config = {
      hidden: [
        "purpose",
        "keyMoments",
        "requestedPhotographers",
        "expectedDeliveryAt",
        "documentationLinks",
        "notes",
      ],
      required: [],
    };
    const secciones = visibleRequestSections(config);
    expect(secciones.map((s) => s.key)).toEqual(["ORGANIZACION", "ACTIVIDAD"]);
  });

  it("una sección con campos fijos nunca puede quedar vacía", () => {
    const todos = REQUEST_FIELDS.map((f) => f.key);
    const secciones = visibleRequestSections({ hidden: todos, required: [] });
    expect(secciones.map((s) => s.key)).toEqual(["ORGANIZACION", "ACTIVIDAD"]);
    expect(secciones[0]!.fields.map((f) => f.key)).toEqual(["orgName", "contactEmail"]);
  });

  it("conserva el orden del catálogo", () => {
    const secciones = visibleRequestSections(DEFAULT_REQUEST_FORM_CONFIG);
    expect(secciones[1]!.fields.map((f) => f.key)).toEqual([
      "eventTitle",
      "eventDescription",
      "startsAt",
      "endsAt",
      "addressLine",
      "city",
      "expectedAttendees",
      "onSiteContactName",
      "onSitePhone",
    ]);
  });
});

describe("allRequestSections", () => {
  it("muestra también lo apagado: si no, no hay cómo volver a encenderlo", () => {
    const secciones = allRequestSections({ hidden: ["city"], required: [] });
    const ciudad = secciones
      .flatMap((s) => s.fields)
      .find((f) => f.key === "city");
    expect(ciudad?.state).toBe("OCULTO");
    expect(secciones.reduce((n, s) => n + s.fields.length, 0)).toBe(23);
  });
});

describe("parseRequestFieldStates", () => {
  it("arma las dos listas con lo que eligió quien configura", () => {
    const listas = parseRequestFieldStates({
      [requestFieldStateInputName("city")]: "OBLIGATORIO",
      [requestFieldStateInputName("orgTaxId")]: "OCULTO",
      [requestFieldStateInputName("notes")]: "OPCIONAL",
    });
    expect(listas.required).toEqual(["city"]);
    expect(listas.hidden).toEqual(["orgTaxId"]);
  });

  it("ignora los campos fijos aunque lleguen en el formulario", () => {
    const listas = parseRequestFieldStates({
      [requestFieldStateInputName("orgName")]: "OCULTO",
      [requestFieldStateInputName("contactEmail")]: "OCULTO",
    });
    expect(listas.hidden).toEqual([]);
    expect(listas.required).toEqual([]);
  });

  it("un valor que no es ninguno de los tres estados cae en opcional", () => {
    const listas = parseRequestFieldStates({
      [requestFieldStateInputName("city")]: "cualquier cosa",
    });
    expect(listas.hidden).toEqual([]);
    expect(listas.required).toEqual([]);
  });

  it("nunca deja un campo en las dos listas", () => {
    const form: Record<string, string> = {};
    for (const f of REQUEST_FIELDS) form[requestFieldStateInputName(f.key)] = "OCULTO";
    const listas = parseRequestFieldStates(form);
    expect(listas.required).toEqual([]);
    expect(listas.hidden.some((k) => listas.required.includes(k))).toBe(false);
  });
});
