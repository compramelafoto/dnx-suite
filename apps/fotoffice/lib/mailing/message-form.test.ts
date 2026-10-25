import { describe, expect, it } from "vitest";
import { buildCustomEmail } from "./custom-email";
import { parseArgentinaDateTime, parseMessageForm, readyToSend, toArgentinaInputValue } from "./message-form";

function form(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
const cats = new Set(["cat1", "cat2"]);

describe("fecha y hora argentina", () => {
  it("9:30 en Argentina son 12:30 UTC, y vuelve igual", () => {
    const d = parseArgentinaDateTime("2026-10-20T09:30") as Date;
    expect(d.toISOString()).toBe("2026-10-20T12:30:00.000Z");
    expect(toArgentinaInputValue(d)).toBe("2026-10-20T09:30");
  });
  it("vacío, inválido y día inexistente", () => {
    expect(parseArgentinaDateTime("")).toBeNull();
    expect(parseArgentinaDateTime("mañana")).toBe("INVALID");
    expect(parseArgentinaDateTime("2026-02-31T10:00")).toBe("INVALID");
  });
});

describe("formulario de campaña", () => {
  it("guarda lo válido y filtra categorías y especialidades desconocidas", () => {
    const r = parseMessageForm(
      form({ name: "Asamblea", subject: "Asamblea anual", body: "Hola", ctaLabel: "Ver", ctaUrl: "https://x.com", categoryIds: ["cat1", "otra"], specialties: ["VIDEO", "X"], scheduledAt: "2026-10-20T09:30" }),
      cats,
    );
    expect(r.ok && r.fields).toMatchObject({ categoryIds: ["cat1"], specialties: ["VIDEO"], ctaUrl: "https://x.com" });
  });
  it("errores claros", () => {
    expect(parseMessageForm(form({ name: "" }), cats)).toMatchObject({ ok: false });
    expect(parseMessageForm(form({ name: "a", ctaLabel: "Ver" }), cats)).toEqual({ ok: false, error: "El botón necesita el texto y la dirección, o ninguno de los dos." });
    expect(parseMessageForm(form({ name: "a", ctaLabel: "Ver", ctaUrl: "http://x.com" }), cats).ok).toBe(false);
    expect(parseMessageForm(form({ name: "a", scheduledAt: "xx" }), cats).ok).toBe(false);
  });
  it("un borrador puede quedar incompleto, pero no se manda", () => {
    expect(parseMessageForm(form({ name: "a" }), cats).ok).toBe(true);
    expect(readyToSend({ subject: "", body: "x" })).toBe("Falta el asunto.");
    expect(readyToSend({ subject: "s", body: "x" })).toBeNull();
  });
});

describe("correo de campaña", () => {
  it("variables, botón sólo si es https y baja", () => {
    const m = buildCustomEmail({
      brand: { name: "SFPR", logoUrl: null, accentColor: "#112233" },
      content: { subject: "Hola {nombre}", body: "Asamblea de {institucion}", imageUrl: null, ctaLabel: "Confirmar", ctaUrl: "https://sfpr.com.ar/a" },
      vars: { nombre: "Ana", institucion: "SFPR" },
      signature: null,
      footer: { reason: "Sos socio.", unsubscribeUrl: "https://f.com/b" },
    });
    expect(m.subject).toBe("Hola Ana");
    expect(m.html).toContain("Asamblea de SFPR");
    expect(m.html).toContain("https://sfpr.com.ar/a");
    expect(m.text).toContain("Confirmar: https://sfpr.com.ar/a");
    const sinBoton = buildCustomEmail({
      brand: { name: "SFPR", logoUrl: null, accentColor: null },
      content: { subject: "s", body: "b", imageUrl: null, ctaLabel: "Ver", ctaUrl: "javascript:alert(1)" },
      vars: { nombre: null, institucion: "SFPR" },
      signature: null,
      footer: { reason: "r", unsubscribeUrl: "https://f.com/b" },
    });
    expect(sinBoton.html).not.toContain("javascript:");
  });
});
