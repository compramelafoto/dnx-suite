import { describe, expect, it } from "vitest";
import { spotlightWeekEnd, spotlightWeekLabel, spotlightWeekStart } from "./week";
import { pickSpotlight, type SpotlightHistoryRow } from "./pick";
import {
  answeredQuestions,
  colleaguePhrase,
  parseAboutMe,
  placaAboutPhrase,
  spotlightCaption,
} from "./about";

describe("la semana va de viernes 00:00 a jueves 23:59, hora argentina", () => {
  // Viernes 9 de octubre de 2026, 00:00 en Argentina = 03:00 UTC.
  const VIERNES = new Date("2026-10-09T03:00:00.000Z");

  it("un miércoles pertenece a la semana que empezó el viernes anterior", () => {
    expect(spotlightWeekStart(new Date("2026-10-14T15:30:00.000Z"))).toEqual(VIERNES);
  });

  it("el viernes a las 00:00 en punto ya es la semana nueva", () => {
    expect(spotlightWeekStart(VIERNES)).toEqual(VIERNES);
  });

  it("el jueves a las 23:59 de Argentina todavía es la semana vieja, aunque en UTC ya sea viernes", () => {
    const juevesTarde = new Date("2026-10-16T02:59:00.000Z"); // jueves 15, 23:59 AR
    expect(spotlightWeekStart(juevesTarde)).toEqual(VIERNES);
    expect(spotlightWeekStart(new Date("2026-10-16T03:00:00.000Z"))).toEqual(
      new Date("2026-10-16T03:00:00.000Z"),
    );
  });

  it("dos instantes de la misma semana dan exactamente la misma clave, sin segundos", () => {
    const a = spotlightWeekStart(new Date("2026-10-10T12:34:56.789Z"));
    const b = spotlightWeekStart(new Date("2026-10-13T08:00:01.001Z"));
    expect(a.getTime()).toBe(b.getTime());
  });

  it("termina el viernes siguiente y se lee bien", () => {
    expect(spotlightWeekEnd(VIERNES)).toEqual(new Date("2026-10-16T03:00:00.000Z"));
    expect(spotlightWeekLabel(VIERNES)).toBe("del viernes 9 al jueves 15 de octubre");
    expect(spotlightWeekLabel(new Date("2026-10-30T03:00:00.000Z"))).toBe(
      "del viernes 30 de octubre al jueves 5 de noviembre",
    );
  });
});

const fila = (memberId: string, round: number, dia: number, skipped = false): SpotlightHistoryRow => ({
  memberId,
  round,
  weekStart: new Date(Date.UTC(2026, 9, dia, 3)),
  skipped,
});

describe("a quién le toca", () => {
  const primero = () => 0;

  it("sin historia, la vuelta 1 elige entre todos", () => {
    expect(pickSpotlight({ candidates: ["b", "a"], history: [], random: primero })).toEqual({
      memberId: "a",
      round: 1,
    });
  });

  it("nadie se repite dentro de la vuelta", () => {
    const r = pickSpotlight({
      candidates: ["a", "b", "c"],
      history: [fila("a", 1, 2), fila("b", 1, 9)],
      random: () => 0.99,
    });
    expect(r).toEqual({ memberId: "c", round: 1 });
  });

  it("un salteado cuenta como que ya pasó en la vuelta", () => {
    const r = pickSpotlight({
      candidates: ["a", "b"],
      history: [fila("a", 1, 2, true)],
      random: primero,
    });
    expect(r).toEqual({ memberId: "b", round: 1 });
  });

  it("cuando pasaron todos, empieza otra vuelta sin repetir al último", () => {
    const r = pickSpotlight({
      candidates: ["a", "b"],
      history: [fila("a", 1, 2), fila("b", 1, 9)],
      random: primero,
    });
    expect(r).toEqual({ memberId: "a", round: 2 });
    const r2 = pickSpotlight({
      candidates: ["a", "b"],
      history: [fila("b", 1, 2), fila("a", 1, 9)],
      random: primero,
    });
    expect(r2).toEqual({ memberId: "b", round: 2 });
  });

  it("quien se asocia en el medio entra en la vuelta en curso", () => {
    const r = pickSpotlight({
      candidates: ["a", "b", "nuevo"],
      history: [fila("a", 1, 2), fila("b", 1, 9)],
      random: primero,
    });
    expect(r).toEqual({ memberId: "nuevo", round: 1 });
  });

  it("los dados de baja no cuentan aunque estén en la historia", () => {
    const r = pickSpotlight({
      candidates: ["b"],
      history: [fila("a", 1, 2)],
      random: primero,
    });
    expect(r).toEqual({ memberId: "b", round: 1 });
  });

  it("con un solo socio, sale él aunque haya salido la semana pasada", () => {
    expect(
      pickSpotlight({ candidates: ["a"], history: [fila("a", 1, 2)], random: primero }),
    ).toEqual({ memberId: "a", round: 2 });
  });

  it("respeta los excluidos (el que se acaba de saltear) y sin candidatos no elige", () => {
    expect(
      pickSpotlight({ candidates: ["a", "b"], history: [], exclude: ["a"], random: primero }),
    ).toEqual({ memberId: "b", round: 1 });
    expect(pickSpotlight({ candidates: [], history: [], random: primero })).toBeNull();
  });

  it("el resultado no depende del orden en que llegan los candidatos", () => {
    const azar = () => 0.5;
    const a = pickSpotlight({ candidates: ["x", "y", "z"], history: [], random: azar });
    const b = pickSpotlight({ candidates: ["z", "x", "y"], history: [], random: azar });
    expect(a).toEqual(b);
  });
});

const vacias = {
  howStarted: null,
  passion: null,
  inspiration: null,
  gear: null,
  proudPhotoText: null,
  canHelpWith: null,
  wantsToLearn: null,
  beyondPhotography: null,
};

describe("«Más sobre mí»", () => {
  const base = {
    proudPhotoUrl: "",
    whatsappOptIn: false,
    spotlightNotice: true,
    featuredPhotoUrls: [] as unknown[],
    allowedPhotoUrls: new Set(["https://r2/a.jpg", "https://r2/b.jpg", "https://r2/c.jpg", "https://r2/d.jpg"]),
  };

  it("todo es opcional: vacío también se guarda", () => {
    const r = parseAboutMe({ ...base, answers: {} });
    expect(r.ok).toBe(true);
  });

  it("recorta espacios y rechaza respuestas demasiado largas", () => {
    const ok = parseAboutMe({ ...base, answers: { passion: "  Retratos  " } });
    expect(ok.ok && ok.value.passion).toBe("Retratos");
    const largo = parseAboutMe({ ...base, answers: { inspiration: "x".repeat(201) } });
    expect(largo).toMatchObject({ ok: false, field: "inspiration" });
  });

  it("sólo acepta fotos de su portfolio o subidas para esto, hasta tres y sin repetir", () => {
    const ajena = parseAboutMe({ ...base, answers: {}, featuredPhotoUrls: ["https://otro/x.jpg"] });
    expect(ajena).toMatchObject({ ok: false, field: "featuredPhotoUrls" });
    const cuatro = parseAboutMe({
      ...base,
      answers: {},
      featuredPhotoUrls: ["https://r2/a.jpg", "https://r2/b.jpg", "https://r2/c.jpg", "https://r2/d.jpg"],
    });
    expect(cuatro).toMatchObject({ ok: false, field: "featuredPhotoUrls" });
    const repetidas = parseAboutMe({
      ...base,
      answers: {},
      featuredPhotoUrls: ["https://r2/a.jpg", "https://r2/a.jpg"],
    });
    expect(repetidas.ok && repetidas.value.featuredPhotoUrls).toEqual(["https://r2/a.jpg"]);
  });

  it("el link de la foto de la que está orgulloso se normaliza y rechaza lo que no es web", () => {
    const ok = parseAboutMe({ ...base, answers: {}, proudPhotoUrl: "instagram.com/p/abc" });
    expect(ok.ok && ok.value.proudPhotoUrl).toBe("https://instagram.com/p/abc");
    const mal = parseAboutMe({ ...base, answers: {}, proudPhotoUrl: "javascript:alert(1)" });
    expect(mal).toMatchObject({ ok: false, field: "proudPhotoUrl" });
  });

  it("muestra sólo lo contestado, en el orden de las preguntas", () => {
    const r = answeredQuestions({ ...vacias, gear: "Una Nikon", howStarted: "Con mi abuelo" });
    expect(r.map((x) => x.key)).toEqual(["howStarted", "gear"]);
  });
});

describe("la frase para acercarse como colegas", () => {
  it("arma las dos mitades", () => {
    expect(
      colleaguePhrase("Juan", { canHelpWith: "Iluminación de estudio.", wantsToLearn: "Video" }),
    ).toBe("Juan puede darte una mano con iluminación de estudio y quiere aprender video.");
  });

  it("con una sola mitad, o ninguna", () => {
    expect(colleaguePhrase("Ana", { canHelpWith: "Edición", wantsToLearn: null })).toBe(
      "Ana puede darte una mano con edición.",
    );
    expect(colleaguePhrase("Ana", { canHelpWith: null, wantsToLearn: "drones" })).toBe(
      "Ana quiere aprender drones. ¿Le podés dar una mano?",
    );
    expect(colleaguePhrase("Ana", { canHelpWith: null, wantsToLearn: null })).toBeNull();
  });

  it("no le baja la mayúscula a una sigla", () => {
    expect(colleaguePhrase("Leo", { canHelpWith: "RAW y Lightroom", wantsToLearn: null })).toBe(
      "Leo puede darte una mano con RAW y Lightroom.",
    );
  });
});

describe("la frase de la placa y el texto para redes", () => {
  it("la placa usa lo que más le apasiona, o lo primero que contestó", () => {
    expect(placaAboutPhrase({ ...vacias, passion: "Contar historias" })).toBe("Contar historias");
    expect(placaAboutPhrase({ ...vacias, gear: "Una Leica vieja" })).toBe("Una Leica vieja");
    expect(placaAboutPhrase(null)).toBeNull();
    expect(placaAboutPhrase({ ...vacias, passion: "palabra ".repeat(40) })!.length).toBeLessThanOrEqual(150);
  });

  it("el texto sugerido etiqueta, cuenta y invita", () => {
    const t = spotlightCaption({
      firstName: "María",
      lastName: "Gómez",
      instagram: "mariag",
      institutionName: "SFPR",
      specialty: "Casamientos",
      zone: "Rosario, Santa Fe",
      about: { ...vacias, passion: "Las bodas al aire libre", canHelpWith: "Edición" },
    });
    expect(t).toContain("Socio de la semana en SFPR: María Gómez (@mariag).");
    expect(t).toContain("Se dedica a casamientos y trabaja en Rosario, Santa Fe.");
    expect(t).toContain("Lo que más le apasiona: las bodas al aire libre.");
    expect(t).toContain("María puede darte una mano con edición.");
  });
});
