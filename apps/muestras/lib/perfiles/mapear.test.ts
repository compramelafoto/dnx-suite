import { describe, expect, it } from "vitest";
import { perfilDesdeFormData } from "./mapear";

const BASE = "https://pub-test.r2.dev";
function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const leer = (o: Record<string, string>) => perfilDesdeFormData(fd(o), { baseImagenes: BASE });

describe("perfilDesdeFormData", () => {
  it("normaliza slug, web e Instagram y vacía lo opcional", () => {
    const r = leer({ displayName: " Ana Pérez ", slug: "Ana Pérez", website: "ana.com", instagram: "@Ana.Foto", bio: " ", avatarUrl: `${BASE}/muestras/7/a.webp` });
    expect(r).toEqual({ ok: true, perfil: {
      displayName: "Ana Pérez", slug: "ana-perez", bio: null, city: null, province: null,
      website: "https://ana.com/", instagram: "ana.foto", avatarUrl: `${BASE}/muestras/7/a.webp`,
    } });
  });
  it("sin slug escrito queda vacío (lo arma la acción)", () => {
    const r = leer({ displayName: "Ana" });
    expect(r.ok && r.perfil.slug).toBe("");
  });
  it("junta todos los errores en palabras de la persona", () => {
    const r = leer({ displayName: "", slug: "ab", website: "javascript:alert(1)", instagram: "no vale" });
    expect(r).toEqual({ ok: false, errores: [
      "Poné tu nombre como querés que aparezca.",
      "La dirección tiene que tener entre 3 y 40 caracteres.",
      "La dirección del sitio web no es válida.",
      "El usuario de Instagram no es válido.",
    ] });
  });
  it("un avatar que no subimos nosotros se descarta", () => {
    const r = leer({ displayName: "Ana", avatarUrl: "https://malo.com/espia.png" });
    expect(r.ok && r.perfil.avatarUrl).toBeNull();
  });
  it("una dirección reservada escrita con mayúsculas igual se rechaza", () => {
    const r = leer({ displayName: "Ana", slug: "PANEL" });
    expect(r).toEqual({ ok: false, errores: ["Esa dirección está reservada. Elegí otra."] });
  });
  it("una web con usuario y clave se rechaza", () => {
    const r = leer({ displayName: "Ana", website: "https://a:b@ana.com" });
    expect(r.ok).toBe(false);
  });
  it("Instagram como dirección sin esquema", () => {
    const r = leer({ displayName: "Ana", instagram: "m.instagram.com/Ana" });
    expect(r.ok && r.perfil.instagram).toBe("ana");
  });
});
