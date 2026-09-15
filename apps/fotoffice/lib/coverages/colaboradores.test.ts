import { describe, expect, it } from "vitest";
import {
  MAX_TRAVEL_KM_MAX,
  MAX_TRAVEL_KM_MIN,
  parseCollaboratorProfileForm,
  participaDeCoberturas,
  perfilHabilitado,
} from "./colaboradores";

describe("parseCollaboratorProfileForm", () => {
  it("un formulario vacío no inventa nada: todo queda apagado o nulo", () => {
    expect(parseCollaboratorProfileForm({})).toEqual({
      active: false,
      homeCity: null,
      coverageZones: [],
      maxTravelKm: null,
      transport: null,
      equipment: [],
      specialties: [],
      experienceLevel: null,
      acceptsUrgent: false,
      notes: null,
    });
  });

  it("la casilla marcada llega como 'on', como cualquier checkbox de HTML", () => {
    const r = parseCollaboratorProfileForm({ active: "on", acceptsUrgent: "on" });
    expect(r.active).toBe(true);
    expect(r.acceptsUrgent).toBe(true);
  });

  it("cualquier otro valor de la casilla no la enciende", () => {
    expect(parseCollaboratorProfileForm({ active: "true" }).active).toBe(false);
  });

  it("recorta espacios y descarta vacíos en el texto simple", () => {
    expect(parseCollaboratorProfileForm({ homeCity: "  Rosario  " }).homeCity).toBe("Rosario");
    expect(parseCollaboratorProfileForm({ homeCity: "   " }).homeCity).toBeNull();
    expect(parseCollaboratorProfileForm({ notes: "" }).notes).toBeNull();
  });

  it("las zonas se leen una por línea o separadas por coma, sin vacíos", () => {
    expect(parseCollaboratorProfileForm({ coverageZones: "Norte\nSur\n\nCentro" }).coverageZones).toEqual([
      "Norte",
      "Sur",
      "Centro",
    ]);
    expect(parseCollaboratorProfileForm({ coverageZones: "Norte, Sur,  Centro" }).coverageZones).toEqual([
      "Norte",
      "Sur",
      "Centro",
    ]);
  });

  it("el equipo y las especialidades siguen la misma regla que las zonas", () => {
    expect(parseCollaboratorProfileForm({ equipment: "Cámara réflex\nDron" }).equipment).toEqual([
      "Cámara réflex",
      "Dron",
    ]);
    expect(parseCollaboratorProfileForm({ specialties: "Retrato, Eventos" }).specialties).toEqual([
      "Retrato",
      "Eventos",
    ]);
  });

  it("el radio se acota entre el mínimo y el máximo", () => {
    expect(parseCollaboratorProfileForm({ maxTravelKm: "-5" }).maxTravelKm).toBe(MAX_TRAVEL_KM_MIN);
    expect(parseCollaboratorProfileForm({ maxTravelKm: "999999" }).maxTravelKm).toBe(MAX_TRAVEL_KM_MAX);
    expect(parseCollaboratorProfileForm({ maxTravelKm: "35" }).maxTravelKm).toBe(35);
    expect(parseCollaboratorProfileForm({ maxTravelKm: "35.6" }).maxTravelKm).toBe(36);
  });

  it("un radio vacío o que no es un número queda sin definir, no en cero", () => {
    // Cero significa "no viaja nada"; vacío significa "no sabemos". Son cosas distintas y
    // confundirlas mostraría "0 km" en la ficha de alguien que nunca contestó la pregunta.
    expect(parseCollaboratorProfileForm({}).maxTravelKm).toBeNull();
    expect(parseCollaboratorProfileForm({ maxTravelKm: "  " }).maxTravelKm).toBeNull();
    expect(parseCollaboratorProfileForm({ maxTravelKm: "en moto" }).maxTravelKm).toBeNull();
  });

  it("el transporte solo acepta los valores del vocabulario cerrado", () => {
    expect(parseCollaboratorProfileForm({ transport: "MOTO" }).transport).toBe("MOTO");
    expect(parseCollaboratorProfileForm({ transport: "COHETE" }).transport).toBeNull();
  });

  it("el nivel de experiencia solo acepta los valores del vocabulario cerrado", () => {
    expect(parseCollaboratorProfileForm({ experienceLevel: "AVANZADO" }).experienceLevel).toBe(
      "AVANZADO",
    );
    expect(parseCollaboratorProfileForm({ experienceLevel: "EXPERTO" }).experienceLevel).toBeNull();
  });
});

/**
 * `perfilHabilitado` es la puerta de todo el portal de esta etapa: sin ella en verdadero, la
 * persona no ve ninguna convocatoria (ver `puedePostularse` en `elegibilidad.ts`).
 */
describe("perfilHabilitado", () => {
  it("sin perfil, no está habilitado", () => {
    expect(perfilHabilitado(null)).toBe(false);
    expect(perfilHabilitado(undefined)).toBe(false);
  });

  it("con perfil pero apagado, tampoco", () => {
    expect(perfilHabilitado({ active: false })).toBe(false);
  });

  it("con perfil activo, sí", () => {
    expect(perfilHabilitado({ active: true })).toBe(true);
  });
});

/**
 * Del lado del panel hacen falta dos cosas, no una. El portal ya lo resuelve por su lado
 * —`loadPortalContext` solo devuelve socios `ACTIVE`—; esto es la misma regla para quien invita.
 */
describe("participaDeCoberturas", () => {
  it("socio vigente con perfil encendido, sí", () => {
    expect(participaDeCoberturas({ estadoEnElPadron: "ACTIVE", perfil: { active: true } })).toBe(
      true,
    );
  });

  it("dado de baja en el padrón no participa, aunque su perfil siga encendido", () => {
    expect(participaDeCoberturas({ estadoEnElPadron: "INACTIVE", perfil: { active: true } })).toBe(
      false,
    );
  });

  it("socio vigente sin perfil, o con el perfil apagado, tampoco", () => {
    expect(participaDeCoberturas({ estadoEnElPadron: "ACTIVE", perfil: null })).toBe(false);
    expect(participaDeCoberturas({ estadoEnElPadron: "ACTIVE", perfil: { active: false } })).toBe(
      false,
    );
  });

  it("sin dato de padrón no se asume que sigue, se asume que no", () => {
    expect(participaDeCoberturas({ estadoEnElPadron: null, perfil: { active: true } })).toBe(false);
    expect(participaDeCoberturas({ estadoEnElPadron: undefined, perfil: { active: true } })).toBe(
      false,
    );
  });
});
