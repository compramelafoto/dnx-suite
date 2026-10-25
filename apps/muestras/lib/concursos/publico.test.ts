import { beforeEach, describe, expect, it, vi } from "vitest";
import { visibilityFromPreset } from "@repo/muestras";

const db = vi.hoisted(() => ({
  culturalContestWork: { findMany: vi.fn() },
  culturalContestImport: { findUnique: vi.fn() },
  fotorankContest: { findUnique: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: vi.fn() }));

const { concursoDeMuestra, distinctionsForWorks, obrasSoloOnline, premioVisible } = await import("./publico");

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("distinctionsForWorks", () => {
  it("sólo las obras incluidas que están en la muestra, con el nombre del concurso", async () => {
    db.culturalContestWork.findMany.mockResolvedValue([
      { activityWorkId: "aw1", distinction: "1.er premio · Paisaje", import: { contestTitle: "Concurso X" } },
    ]);
    const m = await distinctionsForWorks("a1", ["aw1", "aw2"]);
    expect(db.culturalContestWork.findMany.mock.calls[0][0].where).toEqual({ activityId: "a1", include: true, activityWorkId: { in: ["aw1", "aw2"] } });
    expect(m.get("aw1")).toBe("1.er premio · Paisaje — Concurso X");
    expect(m.has("aw2")).toBe(false);
  });
  it("sin obras no consulta; con error, vacío", async () => {
    expect((await distinctionsForWorks("a1", [])).size).toBe(0);
    expect(db.culturalContestWork.findMany).not.toHaveBeenCalled();
    db.culturalContestWork.findMany.mockRejectedValue(new Error("relation does not exist"));
    expect((await distinctionsForWorks("a1", ["aw1"])).size).toBe(0);
  });
});

describe("obrasSoloOnline", () => {
  it("las que están en la muestra y no se imprimen", async () => {
    db.culturalContestWork.findMany.mockResolvedValue([{ activityWorkId: "aw3" }]);
    expect([...(await obrasSoloOnline("a1"))]).toEqual(["aw3"]);
    expect(db.culturalContestWork.findMany.mock.calls[0][0].where).toEqual({ activityId: "a1", toPrint: false, activityWorkId: { not: null } });
  });
});

describe("concursoDeMuestra", () => {
  it("una muestra sin concurso: null, sin leer FotoRank", async () => {
    db.culturalContestImport.findUnique.mockResolvedValue(null);
    expect(await concursoDeMuestra("a1")).toBeNull();
    expect(db.fotorankContest.findUnique).not.toHaveBeenCalled();
  });
  it("con la página del concurso abierta: enlace a FotoRank", async () => {
    vi.stubEnv("FOTORANK_PUBLIC_BASE_URL", "https://fr.test/");
    db.culturalContestImport.findUnique.mockResolvedValue({ contestId: "c1", contestTitle: "Paisajes 2026" });
    db.fotorankContest.findUnique.mockResolvedValue({ slug: "paisajes-2026", visibility: "PUBLIC", status: "ACTIVE" });
    expect(await concursoDeMuestra("a1")).toEqual({ title: "Paisajes 2026", url: "https://fr.test/concursos/paisajes-2026" });
  });
  it("terminado, privado o borrado: el texto sin enlace", async () => {
    db.culturalContestImport.findUnique.mockResolvedValue({ contestId: "c1", contestTitle: "Paisajes 2026" });
    for (const c of [{ slug: "p", visibility: "PUBLIC", status: "COMPLETED" }, { slug: "p", visibility: "PRIVATE", status: "ACTIVE" }, null]) {
      db.fotorankContest.findUnique.mockResolvedValue(c);
      expect(await concursoDeMuestra("a1")).toEqual({ title: "Paisajes 2026", url: null });
    }
  });
  it("si la tabla no existe todavía: null, la página sigue", async () => {
    db.culturalContestImport.findUnique.mockRejectedValue(new Error("relation does not exist"));
    expect(await concursoDeMuestra("a1")).toBeNull();
  });
});

describe("premioVisible (página de la obra)", () => {
  const works = [{ id: "aw1", isHighlight: true, sortOrder: 0 }, { id: "aw2", isHighlight: false, sortOrder: 1 }];
  const premios = new Map([["aw1", "1.er premio · Paisaje — Concurso X"]]);
  const durante = new Date("2026-11-15T15:00:00Z");
  const muestra = (visibility: unknown) => ({ galleryMode: "FULL", visibility, startsAt: new Date("2026-11-01"), endsAt: new Date("2026-12-01") });

  it("con todas las obras a la vista: la línea del premio", () => {
    expect(premioVisible(muestra(visibilityFromPreset("OPEN", "s")), works, "aw1", durante, premios)).toBe("1.er premio · Paisaje — Concurso X");
  });
  it("Sorpresa total: la obra oculta no muestra el premio", () => {
    expect(premioVisible(muestra(visibilityFromPreset("SURPRISE", "s")), works, "aw1", durante, premios)).toBeNull();
  });
});
