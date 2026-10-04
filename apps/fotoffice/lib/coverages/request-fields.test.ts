import { describe, expect, it } from "vitest";
import {
  allRequestSections,
  choiceOptionValue,
  choiceOtherText,
  choiceValueLabel,
  DEFAULT_REQUEST_FORM_CONFIG,
  FIXED_REQUEST_FIELD_KEYS,
  formatChoiceValue,
  isRequestFieldVisible,
  OTHER_OPTION_VALUE,
  OTHER_TEXT_MAX_LENGTH,
  parseRequestFieldStates,
  REQUEST_FIELDS,
  REQUEST_FIELD_SECTIONS,
  requestFieldByKey,
  requestFieldOptions,
  requestFieldOtherInputName,
  requestFieldStateInputName,
  resolveRequestFieldState,
  resolveRequestFieldStates,
  visibleRequestSections,
} from "./request-fields";

const campo = (key: string) => REQUEST_FIELDS.find((f) => f.key === key)!;

describe("el catálogo de campos", () => {
  it("tiene los 26 campos del formulario, cinco de ellos fijos", () => {
    expect(REQUEST_FIELDS).toHaveLength(26);
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
    expect(secciones.reduce((n, s) => n + s.fields.length, 0)).toBe(26);
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
    // "Qué necesitan" son todos configurables: apagados los ocho, la sección entera sobra.
    const config = {
      hidden: [
        "purpose",
        "keyMoments",
        "requestedPhotographers",
        "expectedDeliveryAt",
        "documentationLinks",
        "otherCoverage",
        "showcaseScope",
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
      "venueKind",
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
    expect(secciones.reduce((n, s) => n + s.fields.length, 0)).toBe(26);
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

describe("los campos de elección", () => {
  const elecciones = REQUEST_FIELDS.filter((f) => f.input === "choice");

  it("son tres: dónde es, si hay otra cobertura y hasta dónde autorizan a difundir", () => {
    expect(elecciones.map((f) => f.key)).toEqual(["venueKind", "otherCoverage", "showcaseScope"]);
  });

  it("ninguno es fijo: se configuran como cualquier otro campo", () => {
    for (const f of elecciones) expect(f.fixed).toBe(false);
  });

  it("todos ofrecen al menos dos respuestas", () => {
    for (const f of elecciones) expect((f.options ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("ningún campo que no sea de elección tiene opciones", () => {
    for (const f of REQUEST_FIELDS.filter((x) => x.input !== "choice")) {
      expect(f.options).toBeUndefined();
      expect(f.allowsOther).toBeUndefined();
    }
  });

  it("no repite valores dentro de un mismo campo", () => {
    for (const f of elecciones) {
      const valores = requestFieldOptions(f).map((o) => o.value);
      expect(new Set(valores).size).toBe(valores.length);
    }
  });

  it("ningún valor tiene dos puntos: es lo que separa la opción del texto libre", () => {
    for (const f of elecciones) {
      for (const o of requestFieldOptions(f)) expect(o.value).not.toContain(":");
    }
  });

  it("«Otros» no se escribe a mano en ningún campo: lo agrega `requestFieldOptions`", () => {
    for (const f of elecciones) {
      expect((f.options ?? []).some((o) => o.value === OTHER_OPTION_VALUE)).toBe(false);
      if (f.allowsOther) {
        expect(requestFieldOptions(f).at(-1)?.value).toBe(OTHER_OPTION_VALUE);
      }
    }
  });

  it("la pregunta por otra cobertura explica para qué se pregunta", () => {
    // Sin la ayuda, contestar "sí, ya hay otro fotógrafo" parece inofensivo, y es la respuesta
    // que puede dejar el pedido sin cobertura.
    expect(campo("otherCoverage").hint?.trim()).toBeTruthy();
  });

  it("las cuatro respuestas de difusión son las del formulario de papel", () => {
    expect((campo("showcaseScope").options ?? []).map((o) => o.value)).toEqual([
      "TODO",
      "CON_RESTRICCIONES",
      "SIN_PERSONAS",
      "NADA",
    ]);
  });

  it("el texto libre viaja en un `name` que no es el del campo", () => {
    expect(requestFieldOtherInputName("venueKind")).toBe("venueKind__otro");
    expect(REQUEST_FIELDS.some((f) => f.key === requestFieldOtherInputName("venueKind"))).toBe(
      false,
    );
  });
});

describe("cómo se guarda una elección", () => {
  it("una respuesta del catálogo se guarda tal cual", () => {
    expect(formatChoiceValue("INTERIOR", null)).toBe("INTERIOR");
    // El texto libre de una respuesta que no es "Otros" se descarta: nadie lo escribió.
    expect(formatChoiceValue("INTERIOR", "con carpa")).toBe("INTERIOR");
  });

  it("«Otros» guarda la opción adelante y el texto libre detrás", () => {
    expect(formatChoiceValue("OTROS", "con carpa")).toBe("OTROS: con carpa");
  });

  it("«Otros» sin texto queda igual como una respuesta válida", () => {
    expect(formatChoiceValue("OTROS", "   ")).toBe("OTROS");
    expect(formatChoiceValue("OTROS", null)).toBe("OTROS");
  });

  it("el texto libre es un renglón: sin saltos de línea y con un tope", () => {
    expect(formatChoiceValue("OTROS", "una\nlínea\n\notra")).toBe("OTROS: una línea otra");
    const largo = formatChoiceValue("OTROS", "x".repeat(OTHER_TEXT_MAX_LENGTH + 50));
    expect(largo.length).toBe("OTROS: ".length + OTHER_TEXT_MAX_LENGTH);
  });

  it("se puede volver a leer la opción y el texto por separado", () => {
    const guardado = formatChoiceValue("OTROS", "sólo la entrega de diplomas");
    expect(choiceOptionValue(guardado)).toBe("OTROS");
    expect(choiceOtherText(guardado)).toBe("sólo la entrega de diplomas");
    expect(choiceOptionValue("INTERIOR")).toBe("INTERIOR");
    expect(choiceOtherText("INTERIOR")).toBe(null);
    expect(choiceOptionValue(null)).toBe(null);
    expect(choiceOptionValue("  ")).toBe(null);
  });

  it("un texto libre con dos puntos no confunde la lectura de la opción", () => {
    const guardado = formatChoiceValue("OTROS", "sí: pero sólo el cierre");
    expect(choiceOptionValue(guardado)).toBe("OTROS");
    expect(choiceOtherText(guardado)).toBe("sí: pero sólo el cierre");
  });

  it("se lee con la etiqueta que vio quien contestó, no con el valor de la base", () => {
    const f = campo("showcaseScope");
    expect(choiceValueLabel(f, "SIN_PERSONAS")).toBe(
      "Pueden subir fotos que refieran al evento, pero no de personas",
    );
    expect(choiceValueLabel(f, "OTROS: sólo las del taller")).toBe("Otros: sólo las del taller");
    expect(choiceValueLabel(f, null)).toBe(null);
  });

  it("una respuesta que ya no está en el catálogo se muestra igual, sin desaparecer", () => {
    // La respuesta que dio esa organización sigue siendo su respuesta, aunque después se haya
    // sacado la opción.
    expect(choiceValueLabel(campo("venueKind"), "UNA_QUE_YA_NO_ESTA")).toBe("UNA_QUE_YA_NO_ESTA");
  });
});

describe("isRequestFieldVisible", () => {
  it("un campo oculto no es visible", () => {
    expect(isRequestFieldVisible("showcaseScope", { hidden: ["showcaseScope"], required: [] })).toBe(
      false,
    );
  });

  it("opcional y obligatorio son visibles: los dos se preguntan", () => {
    expect(isRequestFieldVisible("showcaseScope", { hidden: [], required: [] })).toBe(true);
    expect(
      isRequestFieldVisible("showcaseScope", { hidden: [], required: ["showcaseScope"] }),
    ).toBe(true);
  });

  it("una clave que no está en el catálogo nunca es visible: nunca se dibujó", () => {
    expect(isRequestFieldVisible("inventado", DEFAULT_REQUEST_FORM_CONFIG)).toBe(false);
    expect(requestFieldByKey("inventado")).toBe(null);
  });
});
