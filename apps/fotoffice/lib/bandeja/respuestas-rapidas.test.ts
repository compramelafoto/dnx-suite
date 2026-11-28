import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const R = await import("./respuestas-rapidas");
const { aplicarVariables, filtrarRespuestas, validarRespuesta } = await import("./respuestas-rapidas-puro");

const ctxDe = (role: string, levels: Record<string, string>, workspaceId = "w1") => ({ workspaceId, userId: 2, userLabel: "Ana", role, acceso: { role, levels } as never });
const DUENO = ctxDe("WORKSPACE_OWNER", {});
const STAFF = ctxDe("STAFF", { "whatsapp-inbox": "MANAGE" });
const OTRO = ctxDe("WORKSPACE_OWNER", {}, "w2");

beforeEach(() => B.vaciar());

describe("validarRespuesta", () => {
  it("atajo en minúsculas, sin espacios y hasta 30; título hasta 60; texto hasta 4096", () => {
    expect(validarRespuesta({ atajo: " Carnet ", titulo: "Carnet", texto: "Hola {nombre}" })).toEqual({ ok: true, valor: { atajo: "carnet", titulo: "Carnet", texto: "Hola {nombre}" } });
    expect(validarRespuesta({ atajo: "dos palabras", titulo: "x", texto: "x" })).toMatchObject({ ok: false });
    expect(validarRespuesta({ atajo: "a".repeat(31), titulo: "x", texto: "x" })).toMatchObject({ ok: false });
    expect(validarRespuesta({ atajo: "ok", titulo: "", texto: "x" })).toMatchObject({ ok: false });
    expect(validarRespuesta({ atajo: "ok", titulo: "x", texto: "x".repeat(4097) })).toMatchObject({ ok: false });
  });
});

describe("aplicarVariables y filtrar", () => {
  it("{nombre} es el primer nombre; si no hay, vacío y sin espacio doble", () => {
    expect(aplicarVariables("Hola {nombre}, ¿cómo estás?", { nombre: "María López" })).toBe("Hola María, ¿cómo estás?");
    expect(aplicarVariables("Hola {nombre}, ¿cómo estás?", { nombre: null })).toBe("Hola, ¿cómo estás?");
    expect(aplicarVariables("Hola {nombre}", { nombre: "Pérez, Marta Inés" })).toBe("Hola Marta");
  });
  it("filtra por atajo o título sin distinguir mayúsculas", () => {
    const l = [{ id: "1", atajo: "carnet", titulo: "Foto carnet", texto: "" }, { id: "2", atajo: "xv", titulo: "Paquetes de XV", texto: "" }];
    expect(filtrarRespuestas(l, "CAR").map((x) => x.id)).toEqual(["1"]);
    expect(filtrarRespuestas(l, "paquetes").map((x) => x.id)).toEqual(["2"]);
    expect(filtrarRespuestas(l, "").map((x) => x.id)).toEqual(["1", "2"]);
  });
});

describe("guardar, listar y borrar", () => {
  it("el dueño guarda; el personal no; otra institución no las ve", async () => {
    expect(await R.guardarRespuesta(DUENO, { atajo: "carnet", titulo: "Carnet", texto: "Hola" })).toMatchObject({ ok: true });
    expect(await R.guardarRespuesta(STAFF, { atajo: "otra", titulo: "x", texto: "x" })).toEqual({ ok: false, error: "Sólo el dueño o un administrador pueden cambiar las respuestas rápidas." });
    expect((await R.listarRespuestas(STAFF))!.map((r) => r.atajo)).toEqual(["carnet"]);
    expect(await R.listarRespuestas(OTRO)).toEqual([]);
  });
  it("el atajo no se repite en la institución; editar conserva el id", async () => {
    const a = await R.guardarRespuesta(DUENO, { atajo: "carnet", titulo: "Carnet", texto: "Hola" });
    expect(await R.guardarRespuesta(DUENO, { atajo: "carnet", titulo: "Otro", texto: "x" })).toEqual({ ok: false, error: "Ya hay una respuesta con el atajo /carnet." });
    if (!a.ok) throw new Error();
    expect(await R.guardarRespuesta(DUENO, { id: a.id, atajo: "carnet", titulo: "Carnet nuevo", texto: "Hola 2" })).toMatchObject({ ok: true, id: a.id });
    expect((await R.listarRespuestas(DUENO))![0]).toMatchObject({ titulo: "Carnet nuevo", texto: "Hola 2" });
  });
  it("borrar sólo dentro de la institución", async () => {
    const a = await R.guardarRespuesta(DUENO, { atajo: "carnet", titulo: "Carnet", texto: "Hola" });
    if (!a.ok) throw new Error();
    expect(await R.borrarRespuesta(OTRO, a.id)).toEqual({ ok: false, error: "No encontramos esa respuesta." });
    expect(await R.borrarRespuesta(DUENO, a.id)).toEqual({ ok: true });
    expect(await R.listarRespuestas(DUENO)).toEqual([]);
  });
});
