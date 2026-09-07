import { describe, expect, it } from "vitest";
import { buildRecommendationEarnedEmail } from "./recommendation-emails";

const base = {
  firstName: "Juan",
  recommendedName: "Ana Gómez",
  institution: "SFPR",
  percent: 100,
  duesUrl: "https://fotoffice.test/portal/cuotas",
  signature: null,
};

describe("buildRecommendationEarnedEmail", () => {
  it("nombra a quien se asoció", () => {
    expect(buildRecommendationEarnedEmail(base).text).toContain("Ana Gómez");
  });

  it("con el 100% dice que la próxima cuota va sin cargo", () => {
    expect(buildRecommendationEarnedEmail(base).text).toContain("sin cargo");
  });

  it("con un porcentaje parcial lo dice tal cual", () => {
    expect(buildRecommendationEarnedEmail({ ...base, percent: 50 }).text).toContain("50%");
  });

  it("nunca usa la palabra referido", () => {
    const email = buildRecommendationEarnedEmail(base);
    expect(`${email.subject} ${email.text} ${email.html}`.toLowerCase()).not.toContain("referid");
  });

  it("no promete dinero", () => {
    const texto = buildRecommendationEarnedEmail(base).text.toLowerCase();
    expect(texto).not.toContain("cobrar");
    expect(texto).not.toContain("retirar");
    expect(texto).not.toContain("saldo a favor");
  });

  it("el asunto no menciona plata: el beneficio es una cuota, no un premio", () => {
    expect(buildRecommendationEarnedEmail(base).subject).toContain("recomendaste");
  });
});
