import { describe, expect, it } from "vitest";
import { clientToSyncablePerson, type ClientRow } from "./clients-person";

const BASE: ClientRow = {
  id: "c1",
  clientNumber: 7,
  kind: "EMPRESA",
  firstName: null,
  lastName: null,
  businessName: "Foto Club Quilmes",
  email: "quilmesfotoclub@gmail.com",
  phone: "+54 9 11 7107-2401",
  address: null,
  city: "Quilmes",
  updatedAt: new Date("2026-10-13T00:00:00Z"),
  perfil: { category: "CONTACTO", province: "Buenos Aires", postalCode: null },
  etiquetas: ["Asociación fotográfica"],
};

describe("cliente como contacto de Google", () => {
  it("una institución va con su nombre como organización y sin nombre de persona", () => {
    const p = clientToSyncablePerson(BASE);
    expect(p.organization).toBe("Foto Club Quilmes");
    expect(p.values.firstName).toBeNull();
    expect(p.values.province).toBe("Buenos Aires");
  });

  it("la etiqueta de asociación queda en la ficha y en las notas", () => {
    const p = clientToSyncablePerson(BASE);
    expect(p.labels["Etiquetas"]).toBe("Asociación fotográfica");
    expect(p.labels["Categoría"]).toBe("Contacto");
    expect(p.labels["Nº de cliente"]).toBe("7");
    expect(p.note).toBe("Nº de cliente: 7 · Asociación fotográfica");
  });

  it("sin perfil ni etiquetas no inventa nada", () => {
    const p = clientToSyncablePerson({ ...BASE, perfil: null, etiquetas: [] });
    expect(p.labels).toEqual({ "Nº de cliente": "7" });
    expect(p.note).toBe("Nº de cliente: 7");
  });
});
