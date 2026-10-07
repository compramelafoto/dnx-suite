import { describe, expect, it } from "vitest";
import { MARCADOR_FIRMA } from "./constantes";
import { VARIABLES, clavesPermitidas, fechaAR, resolverVariables, variablesPara, type ContextoVariables } from "./variables";

const base = (): ContextoVariables => ({
  persona: { nombreCompleto: "  María José   Pérez Gómez ", email: "maria@example.com", telefono: "+54 341 555-1234" },
  organizacion: {
    nombre: "DNX Estudio", email: "hola@dnx.com", telefono: "341 400-0000", whatsapp: "5493414000000",
    web: "https://dnx.com", instagram: "@dnx", ciudad: "Rosario",
  },
  usuario: { nombre: "Daniel", email: "daniel@dnx.com" },
  // 01/10/2026 02:30 UTC = 30/09/2026 23:30 en Buenos Aires.
  hoy: new Date("2026-10-01T02:30:00Z"),
  consulta: {
    numero: "C-2026-0042", tipo: "Casamiento", fecha: new Date("2026-12-05T00:00:00Z"), lugar: "Quinta Los Álamos",
    mensaje: "Hola, quería saber precios", etapa: "Propuesta enviada",
  },
  socio: { numero: "734" },
  campos: { color_favorito: "Azul", vacio: "  " },
});

describe("catálogo de variables", () => {
  it("tiene exactamente las claves del spec §3.3", () => {
    expect(VARIABLES.map((v) => v.clave)).toEqual([
      "nombre", "nombre_completo", "apellido", "email", "telefono",
      "organizacion", "organizacion_email", "organizacion_telefono", "organizacion_whatsapp", "organizacion_web",
      "organizacion_instagram", "organizacion_ciudad", "firma",
      "usuario_nombre", "usuario_email",
      "hoy",
      "consulta_numero", "consulta_tipo", "consulta_fecha", "consulta_lugar", "consulta_mensaje", "consulta_etapa", "lista_precios",
      "presupuesto_numero", "presupuesto_enlace", "presupuesto_total", "presupuesto_vence",
      "socio_numero",
    ]);
    for (const v of VARIABLES) {
      expect(v.etiqueta.length).toBeGreaterThan(0);
      expect(v.descripcion.length).toBeGreaterThan(0);
    }
  });

  it("obtiene cada variable del contexto", () => {
    const r = resolverVariables(base());
    expect(r("nombre")).toBe("María");
    expect(r("nombre_completo")).toBe("María José Pérez Gómez");
    expect(r("apellido")).toBe("José Pérez Gómez");
    expect(r("email")).toBe("maria@example.com");
    expect(r("telefono")).toBe("+54 341 555-1234");
    expect(r("organizacion")).toBe("DNX Estudio");
    expect(r("organizacion_email")).toBe("hola@dnx.com");
    expect(r("organizacion_telefono")).toBe("341 400-0000");
    expect(r("organizacion_whatsapp")).toBe("5493414000000");
    expect(r("organizacion_web")).toBe("https://dnx.com");
    expect(r("organizacion_instagram")).toBe("@dnx");
    expect(r("organizacion_ciudad")).toBe("Rosario");
    expect(r("firma")).toBe(MARCADOR_FIRMA);
    expect(r("usuario_nombre")).toBe("Daniel");
    expect(r("usuario_email")).toBe("daniel@dnx.com");
    expect(r("hoy")).toBe("30/09/2026");
    expect(r("consulta_numero")).toBe("C-2026-0042");
    expect(r("consulta_tipo")).toBe("Casamiento");
    expect(r("consulta_fecha")).toBe("05/12/2026");
    expect(r("consulta_lugar")).toBe("Quinta Los Álamos");
    expect(r("consulta_mensaje")).toBe("Hola, quería saber precios");
    expect(r("consulta_etapa")).toBe("Propuesta enviada");
    expect(r("socio_numero")).toBe("734");
    expect(r("campo:color_favorito")).toBe("Azul");
  });

  it("nombre de pila es la primera palabra; apellido vacío si hay una sola", () => {
    const ctx = base();
    ctx.persona.nombreCompleto = "Cecilia";
    const r = resolverVariables(ctx);
    expect(r("nombre")).toBe("Cecilia");
    expect(r("apellido")).toBeNull();
  });

  it("los datos vacíos o ausentes dan null", () => {
    const ctx: ContextoVariables = {
      persona: { nombreCompleto: "   ", email: null, telefono: "" },
      organizacion: { nombre: "Org", email: null, telefono: null, whatsapp: null, web: null, instagram: null, ciudad: null },
      usuario: { nombre: null, email: null },
      hoy: new Date("2026-10-01T15:00:00Z"),
      campos: { vacio: "  " },
    };
    const r = resolverVariables(ctx);
    for (const c of ["nombre", "nombre_completo", "apellido", "email", "telefono", "usuario_nombre", "consulta_numero", "consulta_fecha", "socio_numero", "campo:vacio", "campo:no_existe", "inventada"]) {
      expect(r(c), c).toBeNull();
    }
    expect(r("hoy")).toBe("01/10/2026");
  });

  it("fechas en dd/mm/aaaa, hora de Buenos Aires; una fecha sola (medianoche UTC) no cambia de día", () => {
    expect(fechaAR(new Date("2026-01-01T02:59:00Z"))).toBe("31/12/2025");
    expect(fechaAR(new Date("2026-01-01T03:00:00Z"))).toBe("01/01/2026");
    const ctx = base();
    ctx.consulta!.fecha = new Date("2026-12-05T22:00:00-03:00");
    expect(resolverVariables(ctx)("consulta_fecha")).toBe("05/12/2026");
    ctx.consulta!.fecha = new Date("2026-03-01T00:00:00Z"); // lo que guarda un <input type="date">
    expect(resolverVariables(ctx)("consulta_fecha")).toBe("01/03/2026");
  });
});

describe("variablesPara", () => {
  const claves = (tipo: Parameters<typeof variablesPara>[0], campos: Parameters<typeof variablesPara>[1] = []) =>
    variablesPara(tipo, campos).map((v) => v.clave);

  it("GENERAL: sólo las de todas, sin consulta, socio ni campos", () => {
    const c = claves("GENERAL", ["color_favorito"]);
    expect(c).toContain("nombre");
    expect(c).toContain("firma");
    expect(c).toContain("hoy");
    expect(c).not.toContain("consulta_fecha");
    expect(c).not.toContain("socio_numero");
    expect(c).not.toContain("campo:color_favorito");
  });
  it("CONSULTA: suma las de consulta y sus campos", () => {
    const c = claves("CONSULTA", ["color_favorito", { clave: "presupuesto", nombre: "Presupuesto" }]);
    expect(c).toContain("consulta_fecha");
    expect(c).not.toContain("socio_numero");
    expect(c).toContain("campo:color_favorito");
    expect(c).toContain("campo:presupuesto");
    const p = variablesPara("CONSULTA", [{ clave: "presupuesto", nombre: "Presupuesto" }]).find((v) => v.clave === "campo:presupuesto")!;
    expect(p.etiqueta).toBe("Presupuesto");
    expect(p.grupo).toBe("Campos");
  });
  it("SOCIO: número de socio, sin consulta; CLIENTE: ni socio ni consulta", () => {
    expect(claves("SOCIO")).toContain("socio_numero");
    expect(claves("SOCIO")).not.toContain("consulta_numero");
    expect(claves("CLIENTE")).not.toContain("socio_numero");
    expect(claves("CLIENTE")).not.toContain("consulta_numero");
    expect(claves("CLIENTE", ["dni"])).toContain("campo:dni");
  });
  it("clavesPermitidas devuelve un Set para el motor", () => {
    const s = clavesPermitidas("CONSULTA", ["dni"]);
    expect(s.has("consulta_lugar")).toBe(true);
    expect(s.has("campo:dni")).toBe(true);
    expect(s.has("socio_numero")).toBe(false);
  });
});
