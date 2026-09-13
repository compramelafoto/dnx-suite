import { describe, expect, it } from "vitest";
import { parseClientForm } from "./client-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const persona = { kind: "PERSONA", firstName: "Juan", lastName: "Pérez" };

describe("parseClientForm", () => {
  it("una persona con nombre y apellido alcanza", () => {
    const r = parseClientForm(form(persona));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.firstName).toBe("Juan");
    expect(r.values.lastName).toBe("Pérez");
    expect(r.values.businessName).toBeNull();
  });

  it("por omisión es consumidor final: es el caso del mostrador", () => {
    const r = parseClientForm(form(persona));
    expect(r.ok && r.values.ivaCondition).toBe("CONSUMIDOR_FINAL");
  });

  it("una empresa sin razón social se rechaza", () => {
    const r = parseClientForm(form({ kind: "EMPRESA", businessName: "  " }));
    expect(r).toEqual({ ok: false, error: "Poné la razón social de la empresa." });
  });

  it("una persona sin nombre ni apellido se rechaza", () => {
    const r = parseClientForm(form({ kind: "PERSONA", firstName: "", lastName: "" }));
    expect(r).toEqual({ ok: false, error: "Poné al menos el nombre o el apellido." });
  });

  it("un correo que no es correo se rechaza", () => {
    const r = parseClientForm(form({ ...persona, email: "juan arroba casa" }));
    expect(r).toEqual({ ok: false, error: "Ese correo no se entiende." });
  });

  it("el correo vacío es válido: no todo cliente deja mail", () => {
    const r = parseClientForm(form({ ...persona, email: "  " }));
    expect(r.ok && r.values.email).toBeNull();
  });

  it("el correo se guarda en minúsculas y sin espacios", () => {
    const r = parseClientForm(form({ ...persona, email: "  Juan@Casa.COM " }));
    expect(r.ok && r.values.email).toBe("juan@casa.com");
  });

  it("un CUIT se limpia de guiones y puntos", () => {
    const r = parseClientForm(form({ ...persona, docType: "CUIT", docNumber: "20-12.345.678-9" }));
    expect(r.ok && r.values.docNumber).toBe("20123456789");
  });

  it("un CUIT que no tiene once dígitos se rechaza", () => {
    const r = parseClientForm(form({ ...persona, docType: "CUIT", docNumber: "2012345" }));
    expect(r).toEqual({ ok: false, error: "El CUIT tiene que tener once dígitos." });
  });

  it("un DNI que no tiene entre siete y ocho dígitos se rechaza", () => {
    const r = parseClientForm(form({ ...persona, docType: "DNI", docNumber: "123" }));
    expect(r).toEqual({ ok: false, error: "El DNI tiene que tener siete u ocho dígitos." });
  });

  it("un número de documento sin tipo se rechaza: no se sabe qué validar", () => {
    const r = parseClientForm(form({ ...persona, docNumber: "12345678" }));
    expect(r).toEqual({ ok: false, error: "Elegí el tipo de documento." });
  });

  it("una condición de IVA que no existe se rechaza en vez de guardarse", () => {
    const r = parseClientForm(form({ ...persona, ivaCondition: "INVENTADA" }));
    expect(r).toEqual({ ok: false, error: "Esa condición frente al IVA no existe." });
  });

  it("un responsable inscripto sin CUIT se rechaza: sin eso no se le puede facturar", () => {
    const r = parseClientForm(form({ ...persona, ivaCondition: "RESPONSABLE_INSCRIPTO" }));
    expect(r).toEqual({
      ok: false,
      error: "Un responsable inscripto necesita CUIT para poder facturarle.",
    });
  });

  it("los espacios sobrantes se recortan en todos los campos de texto", () => {
    const r = parseClientForm(form({ kind: "PERSONA", firstName: "  Juan  ", lastName: " Pérez " }));
    expect(r.ok && r.values.firstName).toBe("Juan");
    expect(r.ok && r.values.lastName).toBe("Pérez");
  });
});
