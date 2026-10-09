import { describe, expect, it } from "vitest";
import { MUESTRA_NEEDS_VENUE, missingForSubmission, type DraftInput } from "./validation";

const ok: DraftInput = {
  type: "MUESTRA",
  title: "Miradas del litoral",
  description: "Una muestra colectiva sobre el río.",
  coverImageUrl: "https://img/x.webp",
  organizersText: "Fotoclub Paraná",
  startDay: "2026-11-05",
  endDay: "2026-11-20",
  scheduleText: "Mar a dom de 16 a 20",
  isVirtualOnly: false,
  address: "Calle 1 123",
  latitude: -31.7,
  longitude: -60.5,
  rightsConfirmed: true,
  worksCount: 10,
  highlightsCount: 8,
};

describe("missingForSubmission", () => {
  it("una ficha completa no tiene faltantes", () => expect(missingForSubmission(ok)).toEqual([]));
  it("pide título, descripción, portada y organizadores", () => {
    const m = missingForSubmission({ ...ok, title: " ", description: "", coverImageUrl: null, organizersText: "" });
    expect(m).toEqual(expect.arrayContaining(["Falta el título.", "Falta la descripción.", "Falta la foto de portada.", "Faltan los organizadores."]));
  });
  it("el fin no puede ser antes del inicio", () => {
    expect(missingForSubmission({ ...ok, endDay: "2026-11-01" })).toContain("La fecha de cierre es anterior a la de inicio.");
  });
  it("una actividad presencial necesita punto en el mapa", () => {
    expect(missingForSubmission({ ...ok, latitude: null, longitude: null })).toContain("Falta ubicar el lugar en el mapa.");
  });
  it("una charla online no necesita lugar", () => {
    expect(missingForSubmission({ ...ok, type: "CHARLA", isVirtualOnly: true, address: null, latitude: null, longitude: null })).toEqual([]);
  });
  it("una muestra no puede ser sólo online: necesita sede", () => {
    const m = missingForSubmission({ ...ok, isVirtualOnly: true, address: null, latitude: null, longitude: null });
    expect(m).toEqual([MUESTRA_NEEDS_VENUE]);
    expect(MUESTRA_NEEDS_VENUE).toBe("Una muestra necesita una sede: cargá la dirección donde se puede visitar.");
  });
  it("una muestra sin dirección pide la dirección y el punto", () => {
    const m = missingForSubmission({ ...ok, address: "", latitude: null, longitude: null });
    expect(m).toEqual(["Falta la dirección.", "Falta ubicar el lugar en el mapa."]);
  });
  it("una muestra necesita al menos una obra y la confirmación de derechos", () => {
    const m = missingForSubmission({ ...ok, worksCount: 0, rightsConfirmed: false });
    expect(m).toContain("Una muestra necesita al menos una obra en la galería.");
    expect(m).toContain("Falta confirmar que tenés autorización de los autores.");
  });
  it("una charla no necesita obras", () => {
    expect(missingForSubmission({ ...ok, type: "CHARLA", worksCount: 0, highlightsCount: 0, rightsConfirmed: false })).toEqual([]);
  });
  it("respeta los topes de la galería", () => {
    const m = missingForSubmission({ ...ok, worksCount: 41, highlightsCount: 13 });
    expect(m).toContain("La galería admite hasta 40 obras.");
    expect(m).toContain("Podés destacar hasta 12 obras.");
  });
});
