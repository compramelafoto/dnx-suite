import { describe, expect, it } from "vitest";
import { parseOccasionForm } from "./occasion-form";
import { OCCASION_CATALOG } from "./occasions-catalog";

const base = (k: string) => OCCASION_CATALOG.find((o) => o.key === k)!;

function form(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}

describe("formulario de una fecha", () => {
  it("guarda una efeméride con fecha, especialidades válidas e imagen https", () => {
    const r = parseOccasionForm(
      base("dia-camarografo"),
      form({ enabled: "on", month: "11", day: "6", subject: " Asunto ", message: "Texto\r\nlínea", imageUrl: "https://x.com/a.jpg", specialties: ["VIDEO", "NO-EXISTE", "VIDEO"] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row).toMatchObject({ enabled: true, month: 11, day: 6, subject: "Asunto", message: "Texto\nlínea", specialties: ["VIDEO"] });
  });

  it("no deja encender sin fecha", () => {
    const r = parseOccasionForm(base("dia-fotografo"), form({ enabled: "on", subject: "s", message: "m" }));
    expect(r).toEqual({ ok: false, error: "Cargá la fecha antes de encender este saludo." });
  });

  it("apagada sin fecha se puede guardar", () => {
    const r = parseOccasionForm(base("dia-fotografo"), form({ subject: "s", message: "m" }));
    expect(r.ok && r.row.month === null && !r.row.enabled).toBe(true);
  });

  it("rechaza fecha inválida, imagen no https y vacíos", () => {
    expect(parseOccasionForm(base("navidad"), form({ month: "2", day: "30", subject: "s", message: "m" })).ok).toBe(false);
    expect(parseOccasionForm(base("navidad"), form({ month: "12", day: "24", subject: "s", message: "m", imageUrl: "http://x.com/a.jpg" })).ok).toBe(false);
    expect(parseOccasionForm(base("navidad"), form({ month: "12", day: "24", subject: "", message: "m" })).ok).toBe(false);
  });

  it("personales: sin fecha ni especialidades; hitos sólo en aniversario", () => {
    const a = parseOccasionForm(base("anniversary"), form({ enabled: "on", subject: "s", message: "m", milestonesOnly: "on", month: "3", day: "3" }));
    expect(a.ok && a.row).toMatchObject({ enabled: true, month: null, day: null, milestonesOnly: true, specialties: [] });
    const b = parseOccasionForm(base("birthday"), form({ enabled: "on", subject: "s", message: "m", milestonesOnly: "on" }));
    expect(b.ok && b.row.milestonesOnly).toBe(false);
  });
});
