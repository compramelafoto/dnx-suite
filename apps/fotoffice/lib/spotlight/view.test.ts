import { describe, expect, it } from "vitest";
import { buildSpotlightCard, type SpotlightMemberData } from "./view";
import type { AboutMe } from "./about";

const SOCIO: SpotlightMemberData = {
  id: "m-1",
  firstName: "Juan",
  lastName: "Pérez",
  phone: "0341 15-555-0142",
  avatarUrl: null,
  profilePhotoUrl: "https://r2/juan.jpg",
  city: "Funes",
  province: "Santa Fe",
  studioCity: "Rosario",
  studioProvince: "Santa Fe",
  specialties: ["CASAMIENTOS"],
  businessName: null,
  website: "https://juan.com/",
  instagram: "juanfoto",
  tiktok: null,
  facebook: null,
  youtube: null,
  linkedin: null,
  directoryOptIn: true,
};

const ABOUT: AboutMe = {
  howStarted: null,
  passion: "Las bodas",
  inspiration: null,
  gear: null,
  proudPhotoText: null,
  proudPhotoUrl: null,
  canHelpWith: "Iluminación de estudio",
  wantsToLearn: "Video",
  beyondPhotography: null,
  whatsappOptIn: true,
  spotlightNoticeAt: null,
  featuredPhotoUrls: [],
};

const base = { member: SOCIO, about: ABOUT, portfolioPath: null, institution: "SFPR" };

describe("la tarjeta en el portal", () => {
  it("con permiso y teléfono, ofrece WhatsApp con el mensaje armado", () => {
    const card = buildSpotlightCard({ ...base, audience: "portal", viewerMemberId: "otro" });
    expect(card?.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5493415550142\?text=/);
    expect(decodeURIComponent(card!.whatsappUrl!)).toContain("te vi como Socio de la semana en SFPR");
  });

  it("sin el permiso de WhatsApp, no hay botón aunque tenga teléfono", () => {
    const card = buildSpotlightCard({
      ...base,
      about: { ...ABOUT, whatsappOptIn: false },
      audience: "portal",
    });
    expect(card?.whatsappUrl).toBeNull();
  });

  it("con permiso pero sin un teléfono que sirva, tampoco", () => {
    const card = buildSpotlightCard({ ...base, member: { ...SOCIO, phone: "123" }, audience: "portal" });
    expect(card?.whatsappUrl).toBeNull();
  });

  it("aunque no haya dado permiso para el sitio público, en el portal se muestra", () => {
    const card = buildSpotlightCard({
      ...base,
      member: { ...SOCIO, directoryOptIn: false },
      audience: "portal",
    });
    expect(card).not.toBeNull();
  });

  it("arma la frase para acercarse como colegas y reconoce al destacado", () => {
    const card = buildSpotlightCard({ ...base, audience: "portal", viewerMemberId: "m-1" });
    expect(card?.colleaguePhrase).toBe(
      "Juan puede darte una mano con iluminación de estudio y quiere aprender video.",
    );
    expect(card?.isViewer).toBe(true);
  });

  it("sin «Más sobre mí», muestra lo básico", () => {
    const card = buildSpotlightCard({ ...base, about: null, audience: "portal" });
    expect(card).toMatchObject({
      fullName: "Juan Pérez",
      zone: "Rosario, Santa Fe",
      specialty: "Casamientos",
      aboutEmpty: true,
      whatsappUrl: null,
    });
  });
});

describe("la tarjeta en el sitio público", () => {
  it("sin permiso para aparecer en público, no hay tarjeta", () => {
    expect(
      buildSpotlightCard({ ...base, member: { ...SOCIO, directoryOptIn: false }, audience: "public" }),
    ).toBeNull();
  });

  it("nunca lleva WhatsApp ni el teléfono, aunque lo haya aceptado para el portal", () => {
    const card = buildSpotlightCard({ ...base, audience: "public" });
    expect(card?.whatsappUrl).toBeNull();
    expect(JSON.stringify(card)).not.toContain("555");
  });

  it("muestra sus redes y su web", () => {
    const card = buildSpotlightCard({ ...base, audience: "public" });
    expect(card?.links.map((l) => l.label)).toEqual(["Instagram", "Sitio web"]);
  });
});
