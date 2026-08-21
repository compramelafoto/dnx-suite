import { expect, it, describe } from "vitest";
import { toEmailSignatureData, type SignatureBrandingInput } from "./workspace-signature";

const base: SignatureBrandingInput = {
  commercialName: "SFPR",
  logoUrl: null,
  contactEmail: null,
  phone: null,
  whatsapp: null,
  instagram: null,
  website: null,
  city: null,
  accentColor: null,
  emailSignatureNote: null,
};

describe("organizationName nunca queda vacío", () => {
  it("usa el nombre comercial del branding", () => {
    expect(toEmailSignatureData(base, "Workspace X").organizationName).toBe("SFPR");
  });

  it("cae al nombre del workspace si el comercial está en blanco", () => {
    expect(toEmailSignatureData({ ...base, commercialName: "   " }, "Mi WS").organizationName).toBe(
      "Mi WS",
    );
  });

  it("cae a FotoOffice si no hay ninguno", () => {
    expect(toEmailSignatureData({ ...base, commercialName: "" }, "").organizationName).toBe(
      "FotoOffice",
    );
  });

  it("nunca devuelve undefined, null ni cadena vacía", () => {
    const d = toEmailSignatureData({ ...base, commercialName: "  " }, "  ");
    expect(d.organizationName).toBeTruthy();
    expect(d.organizationName.trim()).not.toBe("");
  });
});

describe("logo", () => {
  it("descarta rutas relativas: en un email no resuelven nunca", () => {
    expect(
      toEmailSignatureData({ ...base, logoUrl: "/uploads/l.png" }, "WS").organizationLogoUrl,
    ).toBeUndefined();
  });

  it("descarta http: y javascript:", () => {
    expect(
      toEmailSignatureData({ ...base, logoUrl: "http://x.com/l.png" }, "WS").organizationLogoUrl,
    ).toBeUndefined();
    expect(
      toEmailSignatureData({ ...base, logoUrl: "javascript:alert(1)" }, "WS").organizationLogoUrl,
    ).toBeUndefined();
  });

  it("acepta https absoluto", () => {
    expect(
      toEmailSignatureData({ ...base, logoUrl: "https://cdn.x/l.png" }, "WS").organizationLogoUrl,
    ).toBe("https://cdn.x/l.png");
  });
});

describe("alcance de esta etapa", () => {
  it("no completa closingText: el template ya cierra y se duplicaría", () => {
    expect(toEmailSignatureData(base, "WS").closingText).toBeUndefined();
  });

  it("no completa campos de firmante personal", () => {
    const d = toEmailSignatureData(base, "WS");
    expect(d.signerName).toBeUndefined();
    expect(d.signerRole).toBeUndefined();
    expect(d.signerPhotoUrl).toBeUndefined();
  });
});

describe("campos institucionales", () => {
  it("mapea contacto, redes y nota", () => {
    const d = toEmailSignatureData(
      {
        ...base,
        contactEmail: "info@sfpr.test",
        phone: "+54 341 555",
        website: "https://sfpr.org",
        instagram: "https://instagram.com/sfpr",
        city: "Rosario",
        accentColor: "#c27b3d",
        emailSignatureNote: "Asociación Civil\nCUIT 30-11111111-1",
      },
      "WS",
    );
    expect(d.email).toBe("info@sfpr.test");
    expect(d.phone).toBe("+54 341 555");
    expect(d.website).toBe("https://sfpr.org");
    expect(d.instagram).toBe("https://instagram.com/sfpr");
    expect(d.city).toBe("Rosario");
    expect(d.accentColor).toBe("#c27b3d");
    expect(d.institutionalNote).toBe("Asociación Civil\nCUIT 30-11111111-1");
  });

  it("los campos vacíos quedan undefined, no cadenas vacías", () => {
    const d = toEmailSignatureData(base, "WS");
    expect(d.email).toBeUndefined();
    expect(d.phone).toBeUndefined();
    expect(d.institutionalNote).toBeUndefined();
  });
});
