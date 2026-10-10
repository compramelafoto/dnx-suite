import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalExhibitor: { findFirst: vi.fn() },
  culturalExhibitorWork: { findFirst: vi.fn(), count: vi.fn(), aggregate: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
const { borrarObraDeExpositor, enviarObraDeExpositor, guardarObraDeExpositor, retirarObraDeExpositor } = await import("./obras");
const { resetRateLimit } = await import("@/lib/limite");

const DIA = 86_400_000;
const FOTO = "https://pub-test.r2.dev/muestras/7/abc.webp";
let expositor: ReturnType<typeof nuevoExpositor>;
let obra: Record<string, unknown> | null;
function nuevoExpositor() {
  return {
    id: "e1", userId: 7, status: "ACTIVE", activityId: "a1", profile: { bio: "Fotógrafa." },
    activity: {
      id: "a1", type: "MUESTRA", reviewStatus: "DRAFT", isCancelled: false,
      startsAt: new Date(Date.now() + 10 * DIA), endsAt: new Date(Date.now() + 40 * DIA),
      exhibitorLink: { status: "OPEN", closesAt: null as Date | null, maxWorksPerExhibitor: 3 as number | null },
    },
  };
}
const completa = () => ({
  id: "w1", status: "DRAFT", activityId: "a1", activityWorkId: null, exhibitorId: "e1",
  imageUrl: FOTO, title: "Silos", year: 2024, technique: "Giclée", imageWidthCm: 40, imageHeightCm: 60, frameWidthCm: 50,
  frameHeightCm: 70, edition: "UNIQUE", editionNumber: null, editionSize: null, statement: null, forSale: false, priceArs: null,
  hangingNotes: null, exhibitor: expositor,
});
function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "e@x", name: "Ema" };
  expositor = nuevoExpositor();
  obra = completa();
  db.culturalExhibitor.findFirst.mockImplementation(async ({ where }: { where: { id: string; userId: number } }) =>
    where.id === "e1" && where.userId === 7 ? expositor : null);
  db.culturalExhibitorWork.findFirst.mockImplementation(async ({ where }: { where: { id: string; exhibitor: { userId: number } } }) =>
    obra && where.id === obra.id && where.exhibitor.userId === 7 ? { ...obra, exhibitor: expositor } : null);
  db.culturalExhibitorWork.count.mockResolvedValue(0);
  db.culturalExhibitorWork.aggregate.mockResolvedValue({ _max: { sortOrder: 1 } });
  db.culturalExhibitorWork.create.mockResolvedValue({ id: "w9" });
  db.culturalExhibitorWork.updateMany.mockResolvedValue({ count: 1 });
  db.culturalExhibitorWork.deleteMany.mockResolvedValue({ count: 1 });
});

describe("guardarObraDeExpositor", () => {
  it("una obra de otra participación no existe y no se escribe nada", async () => {
    expect(await guardarObraDeExpositor(fd({ id: "w-ajena", title: "x" }))).toEqual({ ok: false, errores: ["La obra no existe."] });
    expect(db.culturalExhibitorWork.updateMany).not.toHaveBeenCalled();
  });

  it("una participación ajena no recibe obras", async () => {
    expect(await guardarObraDeExpositor(fd({ exhibitorId: "e-ajeno", title: "x" }))).toEqual({ ok: false, errores: ["No encontramos tu participación en esa muestra."] });
    expect(db.culturalExhibitorWork.create).not.toHaveBeenCalled();
  });

  it("crea un borrador incompleto, en la muestra de la participación (no la del formulario)", async () => {
    expect(await guardarObraDeExpositor(fd({ exhibitorId: "e1", activityId: "otra", title: "Silos", imageUrl: FOTO }))).toEqual({ ok: true, id: "w9" });
    expect(db.culturalExhibitorWork.create.mock.calls[0]![0].data).toMatchObject({
      exhibitorId: "e1", activityId: "a1", status: "DRAFT", sortOrder: 2, title: "Silos", imageUrl: FOTO,
    });
  });

  it("una aprobada no se edita", async () => {
    obra = { ...completa(), status: "APPROVED" };
    const r = await guardarObraDeExpositor(fd({ id: "w1", title: "Otro" }));
    expect(r).toEqual({ ok: false, errores: ["La obra ya está en la muestra. Si hay que cambiar algo, pedíselo a quien organiza."] });
    expect(db.culturalExhibitorWork.updateMany).not.toHaveBeenCalled();
  });

  it("corrige una con cambios pedidos por id, participación y estado", async () => {
    obra = { ...completa(), status: "CHANGES_REQUESTED" };
    expect(await guardarObraDeExpositor(fd({ id: "w1", title: "Silos II" }))).toEqual({ ok: true, id: "w1" });
    expect(db.culturalExhibitorWork.updateMany.mock.calls[0]![0].where).toEqual({ id: "w1", exhibitorId: "e1", status: "CHANGES_REQUESTED" });
  });

  it("con el tope optativo alcanzado no entra otra; sin tope sí", async () => {
    db.culturalExhibitorWork.count.mockResolvedValue(3);
    expect(await guardarObraDeExpositor(fd({ exhibitorId: "e1", title: "x" }))).toEqual({ ok: false, errores: ["Podés cargar hasta 3 obras en esta muestra."] });
    expositor.activity.exhibitorLink.maxWorksPerExhibitor = null;
    db.culturalExhibitorWork.count.mockResolvedValue(120);
    expect((await guardarObraDeExpositor(fd({ exhibitorId: "e1", title: "x" }))).ok).toBe(true);
  });

  it("una foto ajena no se acepta", async () => {
    expect(await guardarObraDeExpositor(fd({ exhibitorId: "e1", imageUrl: "https://pub-test.r2.dev/muestras/8/abc.webp" }))).toEqual({ ok: false, errores: ["Subí la foto desde acá."] });
  });

  it("quien fue sacado de la muestra no carga obras", async () => {
    expositor.status = "REMOVED";
    expect(await guardarObraDeExpositor(fd({ exhibitorId: "e1", title: "x" }))).toEqual({ ok: false, errores: ["Quien organiza te sacó de esta muestra."] });
  });

  it("con la muestra cancelada no se carga nada", async () => {
    expositor.activity.isCancelled = true;
    expect(await guardarObraDeExpositor(fd({ exhibitorId: "e1", title: "x" }))).toEqual({ ok: false, errores: ["La muestra está cancelada."] });
  });
});

describe("enviarObraDeExpositor", () => {
  it("una incompleta no se envía: dice qué falta", async () => {
    obra = { ...completa(), imageUrl: null, technique: null };
    const r = await enviarObraDeExpositor("w1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toEqual(expect.arrayContaining(["Subí la foto de la obra.", "Indicá la técnica y el soporte."]));
    expect(db.culturalExhibitorWork.updateMany).not.toHaveBeenCalled();
  });

  it("completa y con el enlace abierto: queda enviada", async () => {
    expect(await enviarObraDeExpositor("w1")).toEqual({ ok: true });
    expect(db.culturalExhibitorWork.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: "w1", exhibitorId: "e1", status: "DRAFT" }, data: { status: "SUBMITTED", submittedAt: expect.any(Date) },
    });
  });

  it("con el enlace cerrado: un borrador no se envía, una con cambios pedidos sí", async () => {
    expositor.activity.exhibitorLink.status = "CLOSED";
    expect(await enviarObraDeExpositor("w1")).toEqual({ ok: false, errores: ["El enlace de expositores está cerrado: ya no se reciben obras nuevas."] });
    obra = { ...completa(), status: "CHANGES_REQUESTED" };
    expect(await enviarObraDeExpositor("w1")).toEqual({ ok: true });
  });

  it("sin biografía no se envía", async () => {
    expositor.profile = { bio: "  " };
    expect(await enviarObraDeExpositor("w1")).toEqual({ ok: false, errores: ["Antes de enviar, completá tu biografía: es lo que el público lee de vos."] });
  });

  it("la muestra cancelada frena el envío", async () => {
    expositor.activity.isCancelled = true;
    expect(await enviarObraDeExpositor("w1")).toEqual({ ok: false, errores: ["La muestra está cancelada."] });
  });
});

describe("borrar y retirar", () => {
  it("borra un borrador; una que ya entró a la muestra no", async () => {
    expect(await borrarObraDeExpositor("w1")).toEqual({ ok: true });
    obra = { ...completa(), status: "CHANGES_REQUESTED", activityWorkId: "aw1" };
    expect(await borrarObraDeExpositor("w1")).toEqual({ ok: false, errores: ["Esta obra ya no se puede borrar."] });
  });

  it("retira una enviada (vuelve a borrador); una aprobada no", async () => {
    obra = { ...completa(), status: "SUBMITTED" };
    expect(await retirarObraDeExpositor("w1")).toEqual({ ok: true });
    expect(db.culturalExhibitorWork.updateMany.mock.calls[0]![0].data).toEqual({ status: "DRAFT", submittedAt: null });
    obra = { ...completa(), status: "APPROVED" };
    expect((await retirarObraDeExpositor("w1")).ok).toBe(false);
  });
});
