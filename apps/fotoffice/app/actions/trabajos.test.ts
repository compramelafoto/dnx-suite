import { beforeEach, describe, expect, it, vi } from "vitest";

const { guardia, repo, confirmar, revalidar } = vi.hoisted(() => ({
  guardia: vi.fn(),
  repo: {
    agregarFotos: vi.fn(),
    editarTrabajo: vi.fn(),
    publicarTrabajo: vi.fn(),
    borrarTrabajo: vi.fn(),
  },
  confirmar: vi.fn(),
  revalidar: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidar }));
vi.mock("@/lib/blog/access", () => ({ requireBlogEditor: guardia }));
vi.mock("@/lib/trabajos/subida", () => ({ confirmarSubida: confirmar }));
vi.mock("@/lib/trabajos/repositorio", () => repo);

const acciones = await import("./trabajos");

beforeEach(() => {
  for (const f of [guardia, confirmar, revalidar, ...Object.values(repo)]) f.mockReset();
  guardia.mockResolvedValue({ user: { id: 1 }, workspace: { id: "ws-1" } });
});

describe("acciones de Trabajos", () => {
  it("sin permiso no llega al repositorio (el guardián del blog redirige)", async () => {
    guardia.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(acciones.publicarTrabajoAction("t1", true)).rejects.toThrow("NEXT_REDIRECT");
    expect(repo.publicarTrabajo).not.toHaveBeenCalled();
  });

  it("usa la institución de la sesión y refresca el panel", async () => {
    repo.publicarTrabajo.mockResolvedValueOnce({ ok: true, valor: {} });
    expect(await acciones.publicarTrabajoAction("t1", true)).toEqual({ ok: true, valor: true });
    expect(repo.publicarTrabajo).toHaveBeenCalledWith("ws-1", "t1");
    expect(revalidar).toHaveBeenCalledWith("/website/trabajos", "layout");
  });

  it("sin las tablas en la base devuelve el aviso para el administrador", async () => {
    repo.borrarTrabajo.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "P2021" }));
    expect(await acciones.borrarTrabajoAction("t1")).toEqual({
      ok: false,
      error: "Falta crear las tablas de Trabajos en la base. Avisale al administrador.",
    });
  });

  it("un video que no es de YouTube ni Vimeo no se agrega", async () => {
    const r = await acciones.agregarVideoAction("t1", "https://evil.example/v.mp4");
    expect(r.ok).toBe(false);
    expect(repo.agregarFotos).not.toHaveBeenCalled();
  });

  it("el video se guarda con el enlace tal cual", async () => {
    repo.agregarFotos.mockResolvedValueOnce({ ok: true, valor: { agregadas: 1 } });
    await acciones.agregarVideoAction("t1", " https://youtu.be/dQw4w9WgXcQ ");
    expect(repo.agregarFotos).toHaveBeenCalledWith("ws-1", "t1", [{ tipo: "VIDEO_URL", url: "https://youtu.be/dQw4w9WgXcQ" }]);
  });

  it("la fecha del formulario se guarda como día calendario y una inválida se rechaza", async () => {
    repo.editarTrabajo.mockResolvedValue({ ok: true, valor: {} });
    const base = {
      titulo: "Boda",
      slug: "boda",
      categoriaId: "",
      lugar: "",
      descripcionHtml: "",
      destacado: false,
      seoTitle: "",
      seoDescription: "",
    };
    await acciones.guardarTrabajoAction("t1", { ...base, fecha: "2025-03-14" });
    expect(repo.editarTrabajo.mock.calls[0][2].fecha).toEqual(new Date("2025-03-14T00:00:00.000Z"));
    expect(repo.editarTrabajo.mock.calls[0][2].categoriaId).toBeNull();
    const mala = await acciones.guardarTrabajoAction("t1", { ...base, fecha: "2025-02-30" });
    expect(mala).toEqual({ ok: false, error: "La fecha no es válida" });
  });

  it("confirmar la subida pasa las keys a la verificación con la institución de la sesión", async () => {
    confirmar.mockResolvedValueOnce({ ok: true, valor: { agregadas: 1, rechazadas: [] } });
    await acciones.confirmarSubidaAction("t1", ["k1"], { k1: { ancho: 10, alto: 20 } });
    expect(confirmar).toHaveBeenCalledWith("ws-1", "t1", ["k1"], { k1: { ancho: 10, alto: 20 } });
  });
});
