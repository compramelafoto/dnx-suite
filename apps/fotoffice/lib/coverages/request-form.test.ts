import { describe, expect, it } from "vitest";
import { parseCoverageRequest } from "./request-form";

/** Un formulario válido mínimo, para no repetirlo en cada caso. */
function base(extra: Record<string, string> = {}): Record<string, string> {
  return {
    orgName: "Asociación Manos Abiertas",
    contactName: "María Pérez",
    contactEmail: "contacto@manosabiertas.org",
    contactPhone: "3415551234",
    eventTitle: "Jornada solidaria para familias",
    startsAt: "2026-09-26T14:00",
    endsAt: "2026-09-26T18:30",
    city: "Rosario",
    ...extra,
  };
}

/**
 * El formulario público.
 *
 * Lo completa alguien que no conoce el sistema, desde el teléfono, probablemente apurado. Se
 * pide lo mínimo indispensable y se valida en el servidor: el navegador puede mandar cualquier
 * cosa y el `required` del HTML no es una validación.
 */
describe("parseCoverageRequest", () => {
  it("un formulario completo pasa", () => {
    const r = parseCoverageRequest(base());
    expect(r.ok).toBe(true);
  });

  it("sin nombre de organización no se puede tomar el pedido", () => {
    const r = parseCoverageRequest(base({ orgName: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("organización");
  });

  it("sin correo no hay forma de contestar", () => {
    const r = parseCoverageRequest(base({ contactEmail: "" }));
    expect(r.ok).toBe(false);
  });

  it("un correo mal escrito se rechaza", () => {
    expect(parseCoverageRequest(base({ contactEmail: "no-es-un-mail" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ contactEmail: "a@b" })).ok).toBe(false);
  });

  it("el correo se normaliza a minúsculas y sin espacios", () => {
    const r = parseCoverageRequest(base({ contactEmail: "  Contacto@Manos.ORG " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.contactEmail).toBe("contacto@manos.org");
  });

  it("sin fechas no se puede evaluar nada", () => {
    expect(parseCoverageRequest(base({ startsAt: "" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ endsAt: "" })).ok).toBe(false);
  });

  it("el final no puede ser anterior al inicio", () => {
    const r = parseCoverageRequest(
      base({ startsAt: "2026-09-26T18:00", endsAt: "2026-09-26T14:00" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("termina");
  });

  it("calcula la duración, que es lo que alimenta la regla del refuerzo", () => {
    const r = parseCoverageRequest(base());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.durationMinutes).toBe(270); // 14:00 a 18:30
  });

  it("una fecha inventada se rechaza en vez de guardarse como inválida", () => {
    expect(parseCoverageRequest(base({ startsAt: "cuando sea" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ startsAt: "2026-13-45T99:99" })).ok).toBe(false);
  });

  it("la cantidad de fotógrafos, si viene, tiene que ser un número sensato", () => {
    expect(parseCoverageRequest(base({ requestedPhotographers: "2" })).ok).toBe(true);
    expect(parseCoverageRequest(base({ requestedPhotographers: "0" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ requestedPhotographers: "-1" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ requestedPhotographers: "muchos" })).ok).toBe(false);
  });

  it("la cantidad de asistentes, si viene, tiene que ser un número sensato", () => {
    // Comparte la validación `entero()` con requestedPhotographers: mismos casos.
    expect(parseCoverageRequest(base({ expectedAttendees: "2" })).ok).toBe(true);
    expect(parseCoverageRequest(base({ expectedAttendees: "0" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ expectedAttendees: "-1" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ expectedAttendees: "muchos" })).ok).toBe(false);
  });

  it("los campos opcionales pueden faltar sin drama", () => {
    const r = parseCoverageRequest(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.eventDescription).toBe(null);
      expect(r.data.requestedPhotographers).toBe(null);
    }
  });

  it("los enlaces de documentación se separan y se limpian", () => {
    const r = parseCoverageRequest(
      base({ documentationLinks: "https://a.org\n\n  https://b.org  \n" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.documentationLinks).toEqual(["https://a.org", "https://b.org"]);
  });

  it("un enlace que no es http no entra", () => {
    // Un `javascript:` guardado y después mostrado como enlace en el panel sería un agujero.
    const r = parseCoverageRequest(
      base({ documentationLinks: "javascript:alert(1)\nhttps://ok.org" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.documentationLinks).toEqual(["https://ok.org"]);
  });
});

/**
 * La validación sale de la configuración del workspace.
 *
 * Es el punto que sostiene todo lo demás: si la obligatoriedad viviera escrita acá, apagar un
 * campo en la pantalla de configuración sería puro maquillaje y el servidor seguiría exigiendo
 * lo mismo.
 */
describe("parseCoverageRequest con la configuración del workspace", () => {
  it("sin configuración se comporta igual que hoy", () => {
    // `contactName` es obligatorio desde el primer día. Que las listas por omisión lo digan es
    // lo que garantiza que ninguna institución vea cambiar su formulario sin haberlo tocado.
    expect(parseCoverageRequest(base({ contactName: "" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ city: "" })).ok).toBe(true);
  });

  it("un campo puesto como obligatorio se exige, y lo dice con la etiqueta que la persona vio", () => {
    const r = parseCoverageRequest(base({ contactPhone: "" }), {
      hidden: [],
      required: ["contactPhone"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Teléfono o WhatsApp");
  });

  it("el mismo campo, si no es obligatorio, puede faltar", () => {
    expect(parseCoverageRequest(base({ contactPhone: "" }), { hidden: [], required: [] }).ok).toBe(
      true,
    );
  });

  it("un campo oculto se descarta aunque llegue: esconderlo no era el control", () => {
    // Una pestaña vieja, un formulario copiado o un `curl` pueden mandar lo que quieran.
    const r = parseCoverageRequest(base({ city: "Rosario", orgTaxId: "30-12345678-9" }), {
      hidden: ["city", "orgTaxId"],
      required: [],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.city).toBe(null);
      expect(r.data.orgTaxId).toBe(null);
    }
  });

  it("un campo oculto con un valor inválido no frena el envío", () => {
    // Si no se mira, no se valida: rechazar por un dato que la institución decidió no pedir
    // dejaría a la ONG con un error que no puede arreglar, porque el campo ni se ve.
    const r = parseCoverageRequest(base({ expectedAttendees: "muchísimos" }), {
      hidden: ["expectedAttendees"],
      required: [],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.expectedAttendees).toBe(null);
  });

  it("oculto gana sobre obligatorio: no se exige lo que no se muestra", () => {
    const r = parseCoverageRequest(base({ contactPhone: "" }), {
      hidden: ["contactPhone"],
      required: ["contactPhone"],
    });
    expect(r.ok).toBe(true);
  });

  it("un campo fijo no se puede esconder ni dejar de exigir", () => {
    const r = parseCoverageRequest(base({ orgName: "" }), {
      hidden: ["orgName", "contactEmail", "startsAt"],
      required: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("organización");

    const conFecha = parseCoverageRequest(base(), {
      hidden: ["startsAt", "endsAt"],
      required: [],
    });
    expect(conFecha.ok).toBe(true);
    if (conFecha.ok) expect(conFecha.data.durationMinutes).toBe(270);
  });

  it("una fecha obligatoria e ilegible cuenta como campo sin completar", () => {
    const r = parseCoverageRequest(base({ expectedDeliveryAt: "el mes que viene" }), {
      hidden: [],
      required: ["expectedDeliveryAt"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Para cuándo las necesitan");
  });

  it("enlaces obligatorios que no son http lo dicen con claridad", () => {
    const r = parseCoverageRequest(base({ documentationLinks: "instagram.com/ong" }), {
      hidden: [],
      required: ["documentationLinks"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("http");
  });

  it("sin nombre de contacto la solicitud sigue siendo válida si la institución no lo pide", () => {
    const r = parseCoverageRequest(base({ contactName: "" }), { hidden: ["contactName"], required: [] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.contactName).toBe("");
  });
});
