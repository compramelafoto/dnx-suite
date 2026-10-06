import { describe, expect, it } from "vitest";
import {
  buildUrgentActivationEmail,
  buildUrgentDebtEmail,
  cargoLine,
  cuotasPendientesText,
  formatPesos,
} from "./urgent-notice-email";

const SIGNATURE = { html: "<p>Firma SFPR</p>", text: "Firma SFPR" };
const PROHIBIDAS = /workspace|token|membership/i;

const base = {
  memberFirstName: "Ana",
  institution: "SFPR",
  officeName: "Tesorería",
  roleNames: ["Tesorería", "Vocal"],
  signature: SIGNATURE,
};

describe("formatPesos", () => {
  it("formatea en pesos argentinos sin decimales cuando son enteros", () => {
    expect(formatPesos(1_200_000)).toBe("$ 12.000");
    expect(formatPesos(500)).toBe("$ 5");
  });
  it("muestra los centavos si los hay", () => {
    expect(formatPesos(1_234_550)).toBe("$ 12.345,50");
  });
});

describe("cuotasPendientesText", () => {
  it("singular y plural", () => {
    expect(cuotasPendientesText(1, 1_200_000)).toBe("Tenés 1 cuota pendiente por $ 12.000.");
    expect(cuotasPendientesText(3, 3_600_000)).toBe("Tenés 3 cuotas pendientes por $ 36.000.");
  });
});

describe("cargoLine", () => {
  it("cargo y roles", () => {
    expect(cargoLine("Tesorería", ["Tesorería", "Vocal"])).toBe(
      "Integrás la Comisión Directiva como Tesorería (roles: Tesorería, Vocal).",
    );
    expect(cargoLine("Presidencia", ["Presidencia"])).toBe(
      "Integrás la Comisión Directiva como Presidencia (rol: Presidencia).",
    );
  });
  it("sin cargo o sin roles", () => {
    expect(cargoLine(null, ["Prensa"])).toBe("Integrás la Comisión Directiva (rol: Prensa).");
    expect(cargoLine("Vocal", [])).toBe("Integrás la Comisión Directiva como Vocal.");
  });
});

describe("buildUrgentActivationEmail", () => {
  const input = { ...base, invitationUrl: "https://app.test/invitacion/abc", debt: null };

  it("asunto urgente con la institución", () => {
    expect(buildUrgentActivationEmail(input).subject).toBe(
      "URGENTE: activá tu cuenta para gestionar la Comisión Directiva de SFPR",
    );
  });

  it("saluda, nombra cargo y rol, pide activar y trae el enlace con su vencimiento", () => {
    const { text, html } = buildUrgentActivationEmail(input);
    expect(text).toContain("Hola Ana,");
    expect(text).toContain("Integrás la Comisión Directiva como Tesorería (roles: Tesorería, Vocal).");
    expect(text).toMatch(/urgente/i);
    expect(text).toContain("activ");
    expect(text).toContain("https://app.test/invitacion/abc");
    expect(text).toContain("14 días");
    expect(text).toContain("Firma SFPR");
    expect(html).toContain("Activar mi cuenta");
    expect(html).toContain('href="https://app.test/invitacion/abc"');
    expect(html).toContain("<p>Firma SFPR</p>");
    expect(text).not.toContain("cuota");
  });

  it("si además debe, agrega el párrafo de la deuda", () => {
    const { text, html } = buildUrgentActivationEmail({
      ...input,
      debt: { count: 2, totalMinor: 2_400_000 },
    });
    expect(text).toContain("Tenés 2 cuotas pendientes por $ 24.000.");
    expect(html).toContain("$ 24.000");
  });

  it("escapa lo que viene de la base en el HTML", () => {
    const { html, subject } = buildUrgentActivationEmail({
      ...input,
      memberFirstName: "<b>Ana</b>",
      institution: "A & B",
      officeName: '"Cargo"',
    });
    expect(html).not.toContain("<b>Ana</b>");
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("&quot;Cargo&quot;");
    // El asunto es un header: no se escapa.
    expect(subject).toContain("A & B");
  });

  it("no usa vocabulario interno", () => {
    const { subject, text, html } = buildUrgentActivationEmail({ ...input, debt: { count: 1, totalMinor: 100 } });
    for (const s of [subject, text, html]) expect(s).not.toMatch(PROHIBIDAS);
  });

  it("sin firma, sale igual", () => {
    const { text } = buildUrgentActivationEmail({ ...input, signature: null });
    expect(text).not.toContain("Firma SFPR");
  });
});

describe("buildUrgentDebtEmail", () => {
  const input = {
    ...base,
    duesUrl: "https://app.test/portal/cuotas",
    debt: { count: 1, totalMinor: 1_200_000 },
  };

  it("asunto urgente con la institución", () => {
    expect(buildUrgentDebtEmail(input).subject).toBe(
      "URGENTE: regularizá tu situación para gestionar la Comisión Directiva de SFPR",
    );
  });

  it("cargo, deuda, urgencia, botón al portal y firma", () => {
    const { text, html } = buildUrgentDebtEmail(input);
    expect(text).toContain("Hola Ana,");
    expect(text).toContain("Integrás la Comisión Directiva como Tesorería (roles: Tesorería, Vocal).");
    expect(text).toContain("Tenés 1 cuota pendiente por $ 12.000.");
    expect(text).toMatch(/urgente/i);
    expect(text).toContain("https://app.test/portal/cuotas");
    expect(text).toContain("Firma SFPR");
    expect(html).toContain("Pagar mis cuotas");
    expect(html).toContain('href="https://app.test/portal/cuotas"');
  });

  it("no usa vocabulario interno y escapa", () => {
    const out = buildUrgentDebtEmail({ ...input, memberFirstName: "<i>x</i>" });
    for (const s of [out.subject, out.text, out.html]) expect(s).not.toMatch(PROHIBIDAS);
    expect(out.html).not.toContain("<i>x</i>");
  });
});
