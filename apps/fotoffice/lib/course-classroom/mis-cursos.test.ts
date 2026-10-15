import { describe, expect, it } from "vitest";
import { agruparMisCursos, type AccesoParaMisCursos } from "./mis-cursos";

const ahora = new Date(Date.UTC(2026, 9, 4));
const sfpr = { id: "ws-1", name: "SFPR" };
const otra = { id: "ws-2", name: "Otra" };

function acceso(p: Partial<AccesoParaMisCursos> & { id: string }): AccesoParaMisCursos {
  return {
    origin: "PURCHASE",
    expiresAt: new Date(Date.UTC(2027, 9, 4)),
    revokedAt: null,
    course: {
      id: `curso-${p.id}`,
      title: `Curso ${p.id}`,
      workspace: sfpr,
      lessons: [
        { id: "c1", title: "Uno", durationSeconds: 60, videoStatus: "READY", sortOrder: 1 },
        { id: "c2", title: "Dos", durationSeconds: 60, videoStatus: "READY", sortOrder: 2 },
      ],
    },
    progress: [],
    ...p,
  };
}

describe("Mis cursos", () => {
  it("agrupa por institución y calcula el avance y la clase que sigue", () => {
    const grupos = agruparMisCursos(
      [
        acceso({ id: "a", progress: [{ lessonId: "c1", completedAt: ahora, lastPositionSeconds: 60 }] }),
        acceso({ id: "b", course: { ...acceso({ id: "b" }).course, workspace: otra } }),
      ],
      new Set(),
      ahora,
    );
    expect(grupos.map((g) => g.workspace.name)).toEqual(["SFPR", "Otra"]);
    expect(grupos[0].cursos[0]).toMatchObject({ porcentaje: 50, siguienteClaseId: "c2" });
    expect(grupos[1].cursos[0]).toMatchObject({ porcentaje: 0, siguienteClaseId: "c1" });
  });

  it("no muestra lo vencido, lo revocado ni el beneficio sin socio activo", () => {
    const grupos = agruparMisCursos(
      [
        acceso({ id: "vencido", expiresAt: ahora }),
        acceso({ id: "revocado", revokedAt: ahora }),
        acceso({ id: "gratis", origin: "MEMBER_BENEFIT", expiresAt: null }),
      ],
      new Set(),
      ahora,
    );
    expect(grupos).toEqual([]);
  });

  it("el beneficio se ve si es socia activa de esa institución", () => {
    const grupos = agruparMisCursos(
      [acceso({ id: "gratis", origin: "MEMBER_BENEFIT", expiresAt: null })],
      new Set(["ws-1"]),
      ahora,
    );
    expect(grupos[0].cursos[0].origin).toBe("MEMBER_BENEFIT");
  });

  it("con todo visto, la clase que sigue es la primera (para volver a ver)", () => {
    const grupos = agruparMisCursos(
      [
        acceso({
          id: "a",
          progress: [
            { lessonId: "c1", completedAt: ahora, lastPositionSeconds: 60 },
            { lessonId: "c2", completedAt: ahora, lastPositionSeconds: 60 },
          ],
        }),
      ],
      new Set(),
      ahora,
    );
    expect(grupos[0].cursos[0]).toMatchObject({ porcentaje: 100, siguienteClaseId: "c1" });
  });
});
