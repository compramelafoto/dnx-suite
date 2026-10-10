import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import { openingAtFrom } from "./opening";
import {
  SOCIAL_FORMATS, STORY_SAFE_PX, availableSocialVariants, cleanSocialText, isFormatAllowed, recommendedVariant,
  socialFileName, socialLayout, socialTexts,
} from "./social";

const a = {
  reviewStatus: "APPROVED", type: "MUESTRA", isCancelled: false, isVirtualOnly: false,
  startsAt: dayStartAr("2026-11-14"), endsAt: dayEndAr("2026-11-30"),
  openingAt: openingAtFrom("2026-11-14", "19:00"), openingEndsAt: null, worksCount: 12,
  title: "Rosario en blanco y negro", venueName: "Centro Cultural Parque España", city: "Rosario", province: "Santa Fe",
};

describe("qué variantes hay", () => {
  it("antes de inaugurar, todas", () => {
    expect(availableSocialVariants(a, new Date("2026-11-10T12:00:00Z"), 12)).toEqual(["OPENING", "LAST_DAYS", "WORK", "INVITATION"]);
  });
  it("ya inaugurada: sin Inaugura ni Invitación; cerrada: sólo Obra", () => {
    expect(availableSocialVariants(a, new Date("2026-11-20T12:00:00Z"), 12)).toEqual(["LAST_DAYS", "WORK"]);
    expect(availableSocialVariants(a, new Date("2026-12-05T12:00:00Z"), 12)).toEqual(["WORK"]);
  });
  it("sin publicar o cancelada: nada; sin obras: sin Obra; sin hora: sin Invitación", () => {
    expect(availableSocialVariants({ ...a, reviewStatus: "IN_REVIEW" }, new Date("2026-11-10T12:00:00Z"), 12)).toEqual([]);
    expect(availableSocialVariants({ ...a, isCancelled: true }, new Date("2026-11-10T12:00:00Z"), 12)).toEqual([]);
    expect(availableSocialVariants({ ...a, worksCount: 0 }, new Date("2026-11-10T12:00:00Z"), 0)).not.toContain("WORK");
    // Con obras en la sala pero ninguna visible online (sorpresa), tampoco hay "Obra destacada".
    expect(availableSocialVariants(a, new Date("2026-11-10T12:00:00Z"), 0)).not.toContain("WORK");
    expect(availableSocialVariants(a, new Date("2026-11-10T12:00:00Z"), 3)).toContain("WORK");
    expect(recommendedVariant(a, new Date("2026-11-18T12:00:00Z"), 0)).toBe("LAST_DAYS");
    expect(availableSocialVariants({ ...a, openingAt: dayStartAr("2026-11-14") }, new Date("2026-11-10T12:00:00Z"), 12)).toEqual(["OPENING", "LAST_DAYS", "WORK"]);
  });
  it("la recomendada según la fecha", () => {
    expect(recommendedVariant(a, new Date("2026-11-10T12:00:00Z"), 12)).toBe("OPENING");
    expect(recommendedVariant(a, new Date("2026-11-26T12:00:00Z"), 12)).toBe("LAST_DAYS");
    expect(recommendedVariant(a, new Date("2026-11-18T12:00:00Z"), 12)).toBe("WORK");
  });
  it("A6 y A5 sólo para la invitación", () => {
    expect(isFormatAllowed("INVITATION", "A6")).toBe(true);
    expect(isFormatAllowed("OPENING", "A5")).toBe(false);
    expect(isFormatAllowed("OPENING", "STORY")).toBe(true);
  });
});

describe("diagramación", () => {
  it("cada formato llena su lienzo: foto arriba, banda abajo", () => {
    for (const f of Object.keys(SOCIAL_FORMATS) as (keyof typeof SOCIAL_FORMATS)[]) {
      const l = socialLayout(f, "OPENING");
      expect(l.photo.y).toBe(0);
      expect(l.photo.height + l.band.height).toBe(l.height);
      expect(l.textBottom).toBeLessThanOrEqual(l.height - l.padding);
      expect(l.titleSizes).toEqual([...l.titleSizes].sort((x, y) => y - x));
    }
  });
  it("historia: nada de texto en las zonas de Instagram", () => {
    const l = socialLayout("STORY", "OPENING");
    expect(l.textTop).toBeGreaterThanOrEqual(STORY_SAFE_PX);
    expect(l.textBottom).toBeLessThanOrEqual(1920 - STORY_SAFE_PX);
  });
  it("la invitación reserva lugar para el QR y achica el texto", () => {
    const l = socialLayout("POST", "INVITATION");
    expect(l.qr).not.toBeNull();
    expect(l.textWidth).toBeLessThan(socialLayout("POST", "OPENING").textWidth);
    expect(l.qr!.x + l.qr!.width).toBeLessThanOrEqual(1080 - l.padding);
  });
  it("A5 escala proporcional", () => {
    expect(socialLayout("A5", "INVITATION").scale).toBeCloseTo(1748 / 1080);
  });
});

describe("textos", () => {
  it("Inaugura, Últimos días, Obra e Invitación", () => {
    expect(socialTexts("OPENING", a, null)).toEqual({
      kicker: "Inaugura", title: "Rosario en blanco y negro",
      details: ["Sábado 14 de noviembre, 19 h", "Centro Cultural Parque España, Rosario"], footer: "muestrasfotograficas.com",
    });
    expect(socialTexts("LAST_DAYS", a, null).details[0]).toBe("Hasta el 30 de noviembre de 2026");
    expect(socialTexts("WORK", a, { title: "Silos", authorName: "Ana Pérez", year: 2024 })).toEqual({
      kicker: "Obra destacada", title: "Silos",
      details: ["Ana Pérez, 2024", "En «Rosario en blanco y negro»", "Del 14 al 30 de noviembre de 2026, Centro Cultural Parque España, Rosario"],
      footer: "muestrasfotograficas.com",
    });
    expect(socialTexts("INVITATION", a, null).kicker).toBe("Te invitamos a la inauguración");
    expect(socialTexts("INVITATION", a, null).details.at(-1)).toBe("Confirmá tu asistencia con el QR");
  });
  it("limpia lo que la fuente no tiene", () => {
    expect(cleanSocialText("Rosario 📷  en\u0007 B&N — ñandú", 80)).toBe("Rosario en B&N — ñandú");
    expect(cleanSocialText("x".repeat(200), 120)).toHaveLength(120);
  });
  it("nombre de archivo", () => {
    expect(socialFileName("rosario-bn", "OPENING", "POST")).toBe("muestra-rosario-bn-inaugura-posteo.jpg");
    expect(socialFileName("rosario-bn", "INVITATION", "A6")).toBe("muestra-rosario-bn-invitacion-a6.pdf");
  });
});
