import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Los wrappers legacy (FormData) envuelven todo en try/catch. Antes, el `redirect` de la guarda
 * (`requireCoursesSalesContext` sin nivel o con el módulo apagado) caía en ese catch y volvía
 * como `{ error: "NEXT_REDIRECT" }`: la persona veía un error críptico en lugar de ir al panel.
 * Se usa el `redirect` real de Next para que el error sea el de verdad, no una imitación.
 */

const H = vi.hoisted(() => ({ require: vi.fn(), create: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db", () => ({ Prisma: {}, prisma: { course: { create: H.create } } }));
vi.mock("@/lib/workspace", () => ({ requireCoursesSalesContext: H.require }));
vi.mock("@/lib/presential-courses/log", () => ({ logCourseEvent: vi.fn() }));

const { createPresentialCourseAction, duplicatePresentialCourseAction } = await import("./presential-courses");
const { redirect } = await import("next/navigation");

function form(): FormData {
  const fd = new FormData();
  fd.set("title", "Iluminación de estudio");
  return fd;
}

beforeEach(() => {
  H.require.mockReset();
  H.create.mockReset();
});

describe("wrappers legacy de cursos: el redirect de la guarda no se traga", () => {
  it("sin nivel, createPresentialCourseAction deja pasar el redirect y no toca la base", async () => {
    H.require.mockImplementation(async () => redirect("/dashboard?courses=off"));
    await expect(createPresentialCourseAction(undefined, form())).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    expect(H.create).not.toHaveBeenCalled();
  });

  it("al crear bien, el redirect al curso nuevo también llega (antes volvía como error)", async () => {
    H.require.mockResolvedValue({ workspace: { id: "ws-1" } });
    H.create.mockResolvedValue({ id: "c-1", slug: "iluminacion-de-estudio", status: "DRAFT" });
    await expect(createPresentialCourseAction(undefined, form())).rejects.toMatchObject({
      digest: expect.stringContaining("/dashboard/courses/c-1"),
    });
  });

  it("un error común sigue volviendo como mensaje", async () => {
    H.require.mockResolvedValue({ workspace: { id: "ws-1" } });
    H.create.mockRejectedValue(new Error("se cayó la base"));
    await expect(createPresentialCourseAction(undefined, form())).resolves.toEqual({
      error: "se cayó la base",
    });
  });

  it("duplicatePresentialCourseAction también deja pasar el redirect", async () => {
    H.require.mockImplementation(async () => redirect("/dashboard"));
    await expect(duplicatePresentialCourseAction("c-1")).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
