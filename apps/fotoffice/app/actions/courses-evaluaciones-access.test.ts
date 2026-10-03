import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cursos y Evaluaciones: quien tiene VIEW mira, quien tiene MANAGE actúa (roles etapa 2b).
 *
 * Dos pruebas: una de comportamiento (una acción real con nivel VIEW no escribe) y una que lee
 * el código, porque la regla vive en ~20 llamadas repartidas en cinco archivos y la falla
 * probable no es una lógica equivocada sino una acción nueva que olvida pedir MANAGE.
 */

const H = vi.hoisted(() => ({
  nivel: "VIEW" as "NONE" | "VIEW" | "MANAGE",
  teacherCreate: vi.fn(),
  contextCreate: vi.fn(),
}));

function puerta(min: "VIEW" | "MANAGE" = "VIEW") {
  const rank = { NONE: 0, VIEW: 1, MANAGE: 2 };
  if (rank[H.nivel] < rank[min]) throw new Error("REDIRECT:/dashboard");
  return Promise.resolve({ user: { id: 7 }, workspace: { id: "ws-1", name: "SFPR" } });
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/workspace", () => ({
  requireCoursesSalesContext: vi.fn(puerta),
  requireEvaluacionesContext: vi.fn(puerta),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    courseSalesTeacher: { create: H.teacherCreate, findFirst: vi.fn().mockResolvedValue(null) },
    evaluationContext: { create: H.contextCreate, findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const teachers = await import("./teachers");
const evaluaciones = await import("./evaluaciones");

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  H.nivel = "VIEW";
  H.teacherCreate.mockReset();
  H.contextCreate.mockReset();
});

describe("una acción con nivel VIEW es rechazada antes de escribir", () => {
  it("cursos: crear docente", async () => {
    await expect(
      teachers.createTeacherAction(undefined, form({ firstName: "Ana", lastName: "Paz" })),
    ).rejects.toThrow("REDIRECT:/dashboard");
    expect(H.teacherCreate).not.toHaveBeenCalled();
  });

  it("evaluaciones: crear contexto", async () => {
    await expect(
      evaluaciones.createEvaluationContextAction(undefined, form({ name: "Salón 2026" })),
    ).rejects.toThrow("REDIRECT:/dashboard");
    expect(H.contextCreate).not.toHaveBeenCalled();
  });

  it("evaluaciones: con VIEW la lista (lectura de la página) sí se ve", async () => {
    await expect(evaluaciones.listEvaluationContextsAction()).resolves.toEqual([]);
  });
});

describe("toda acción que escribe en Cursos o Evaluaciones pide MANAGE", () => {
  // Lecturas que llaman las páginas: con MANAGE, quien sólo tiene VIEW no podría ni ver la lista.
  const LECTURAS = new Set([
    "listWorkspaceCourses",
    "getCourseForEdit",
    "listCourseInstances",
    "listEvaluationContextsAction",
  ]);
  const ARCHIVOS = [
    "presential-courses.ts",
    "courses.ts",
    "teachers.ts",
    "course-lessons.ts",
    "evaluaciones.ts",
  ];

  it.each(ARCHIVOS)("%s", (archivo) => {
    const src = readFileSync(join(import.meta.dirname, archivo), "utf8");
    const funciones = src.split(/\nexport async function /).slice(1);
    let puertas = 0;
    for (const cuerpo of funciones) {
      const nombre = cuerpo.slice(0, cuerpo.search(/[(<]/));
      const llamadas = cuerpo.match(/require(?:CoursesSales|Evaluaciones)Context\(([^)]*)\)/g) ?? [];
      puertas += llamadas.length;
      for (const llamada of llamadas) {
        if (LECTURAS.has(nombre)) {
          expect(llamada, `${nombre} es lectura`).toMatch(/Context\(\)$/);
        } else {
          expect(llamada, `${nombre} escribe y tiene que pedir MANAGE`).toMatch(/Context\("MANAGE"\)$/);
        }
      }
    }
    expect(puertas).toBeGreaterThan(0);
  });
});
