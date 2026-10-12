import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  outreachFindMany: vi.fn(),
  alcance: vi.fn(),
  token: vi.fn(),
  queue: vi.fn(),
  registrar: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findMany: m.userFindMany }, botOutreach: { findMany: m.outreachFindMany } },
}));
vi.mock("./config", () => ({ BOT_PLATFORM: "CLF", leerAlcancePiloto: () => m.alcance() }));
vi.mock("@/lib/email-marketing/unsubscribe-token", () => ({ ensureUnsubscribeToken: (id: number) => m.token(id) }));
vi.mock("@/lib/email-queue", () => ({ queueEmail: (p: unknown) => m.queue(p) }));
vi.mock("./outreach", () => ({ registrarOutreach: (p: unknown) => m.registrar(p) }));
vi.mock("./saludo", () => ({ saludoPorHora: () => "Buen día" }));
vi.mock("./escolar/progreso", () => ({ computeSchoolSetupProgress: vi.fn() }));

import {
  armarMailOutreach,
  campaniaMail,
  elegirDestinatariosMail,
  enviarMailsOutreach,
  whereCampaniaMail,
  type CampaniaMail,
} from "./outreach-email";
import { elegirCampania, type DatosSegmento } from "./segmentos";

// ---- Evaluador mínimo de `where` de Prisma (sólo los operadores que usa outreach-email) ----
type Obj = Record<string, unknown>;
function cumple(o: Obj, where: Obj): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (k === "AND") return (cond as Obj[]).every((w) => cumple(o, w));
    if (k === "OR") return (cond as Obj[]).some((w) => cumple(o, w));
    if (k === "NOT") return Array.isArray(cond) ? !cond.some((w) => cumple(o, w)) : !cumple(o, cond as Obj);
    const v = o[k];
    if (cond === null) return v === null || v === undefined;
    if (typeof cond !== "object" || cond instanceof Date) return v === cond;
    const c = cond as Obj;
    if ("some" in c) return Array.isArray(v) && (v as Obj[]).some((x) => cumple(x, c.some as Obj));
    return Object.entries(c).every(([op, arg]) => {
      switch (op) {
        case "in": return (arg as unknown[]).includes(v);
        case "notIn": return !(arg as unknown[]).includes(v);
        case "lt": return v != null && (v as number | Date) < (arg as number | Date);
        case "gt": return v != null && (v as number | Date) > (arg as number | Date);
        case "gte": return v != null && (v as number | Date) >= (arg as number | Date);
        case "not": return arg === null ? v !== null && v !== undefined : v !== arg;
        default: throw new Error(`operador no soportado: ${op}`);
      }
    });
  });
}

type Pedido = { status: string; isTest: boolean; totalCents: number };
type Alb = { deletedAt: Date | null; createdAt: Date; schoolId: number | null; mode: string; orders: Pedido[] };
type U = {
  id: number; email: string; name: string | null; role: string; marketingOptIn: boolean;
  unsubscribedAt: Date | null; isBlocked: boolean; lastLoginAt: Date | null; albums: Alb[];
};
const NOW = new Date("2026-10-12T13:00:00Z");
const hace = (dias: number) => new Date(NOW.getTime() - dias * 86_400_000);
const pagado: Pedido = { status: "PAID", isTest: false, totalCents: 5000 };
const alb = (p: Partial<Alb> = {}): Alb => ({ deletedAt: null, createdAt: hace(200), schoolId: null, mode: "NORMAL", orders: [], ...p });
const user = (id: number, p: Partial<U> = {}): U => ({
  id, email: `u${id}@x.com`, name: `Foto ${id}`, role: "PHOTOGRAPHER", marketingOptIn: true, unsubscribedAt: null,
  isBlocked: false, lastLoginAt: hace(60), albums: [alb()], ...p,
});

let usuarios: U[] = [];
let filasEmail: Array<{ userId: number; campaign: string }> = [];
type FilaPanel = { userId: number; campaign: string; status: string; updatedAt: Date };
let filasPanel: FilaPanel[] = [];
function fakeOutreach(args: { where: Obj }) {
  if (args.where.channel === "EMAIL") return Promise.resolve(filasEmail);
  return Promise.resolve(filasPanel.filter((f) => cumple({ ...f, platform: "CLF", channel: "PANEL" } as Obj, args.where)));
}
function fakeFindMany(args: { where: Obj; take: number; orderBy: unknown }) {
  const r = usuarios
    .filter((u) => cumple(u as unknown as Obj, args.where))
    .sort((a, b) => {
      if (a.lastLoginAt === null && b.lastLoginAt !== null) return -1;
      if (a.lastLoginAt !== null && b.lastLoginAt === null) return 1;
      const t = (a.lastLoginAt?.getTime() ?? 0) - (b.lastLoginAt?.getTime() ?? 0);
      return t || a.id - b.id;
    })
    .slice(0, args.take);
  return Promise.resolve(r.map((u) => ({ id: u.id, email: u.email, name: u.name, lastLoginAt: u.lastLoginAt })));
}

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  usuarios = [];
  filasEmail = [];
  filasPanel = [];
  m.alcance.mockResolvedValue("todos");
  m.outreachFindMany.mockImplementation(fakeOutreach);
  m.userFindMany.mockImplementation(fakeFindMany);
  m.token.mockImplementation((id: number) => Promise.resolve(`tok${id}`));
  m.queue.mockResolvedValue({ id: 1, queued: true });
  m.registrar.mockResolvedValue(undefined);
});

describe("campaniaMail coincide con elegirCampania (segmentos.ts)", () => {
  const combos = [false, true].flatMap((tieneAlbum) =>
    [false, true].flatMap((vendio) => [false, true].map((tuvoEscolar) => ({ tieneAlbum, vendio, tuvoEscolar }))),
  );
  it.each(combos)("%o", (f) => {
    const d: DatosSegmento = { nombre: "Ana", registradoHace: 400, ...f, progreso: null, outreach: [] };
    const panel = elegirCampania(d, NOW)?.campaign ?? null;
    const esperado = panel === "sin_ventas" || panel === "sin_escolar" ? panel : null;
    expect(campaniaMail(f)).toBe(esperado);
  });

  it("el where de Prisma clasifica igual que campaniaMail sobre los mismos datos", () => {
    const casos: Alb[][] = [
      [],
      [alb()],
      [alb({ deletedAt: hace(5) })],
      [alb({ orders: [pagado] })],
      [alb({ deletedAt: hace(5), orders: [pagado] })],
      [alb({ orders: [{ ...pagado, isTest: true }] })],
      [alb({ orders: [{ ...pagado, totalCents: 0 }] })],
      [alb({ orders: [{ ...pagado, status: "PENDING" }] })],
      [alb({ orders: [pagado], schoolId: 3 })],
      [alb({ orders: [pagado], mode: "SCHOOL" })],
      [alb({ orders: [pagado] }), alb({ mode: "SCHOOL", deletedAt: hace(1) })],
      [alb({ schoolId: 9 })],
    ];
    for (const albums of casos) {
      const tieneAlbum = albums.some((a) => !a.deletedAt);
      const vendio = albums.some((a) => a.orders.some((o) => o.status === "PAID" && !o.isTest && o.totalCents > 0));
      const tuvoEscolar = albums.some((a) => !a.deletedAt && (a.schoolId !== null || a.mode === "SCHOOL"));
      const porWhere = (["sin_ventas", "sin_escolar"] as CampaniaMail[]).filter((c) =>
        cumple({ albums } as Obj, whereCampaniaMail(c) as Obj),
      );
      const esperado = campaniaMail({ tieneAlbum, vendio, tuvoEscolar });
      expect(porWhere).toEqual(esperado ? [esperado] : []);
    }
  });
});

describe("elegirDestinatariosMail", () => {
  it("excluye sin opt-in, dados de baja, bloqueados, otros roles y quien entró hace menos de 30 días", async () => {
    usuarios = [
      user(1),
      user(2, { marketingOptIn: false }),
      user(3, { unsubscribedAt: hace(3) }),
      user(4, { isBlocked: true }),
      user(5, { role: "CUSTOMER" }),
      user(6, { lastLoginAt: hace(10) }),
      user(7, { lastLoginAt: null }),
      user(8, { role: "LAB_PHOTOGRAPHER" }),
    ];
    const r = await elegirDestinatariosMail(NOW);
    expect(r.map((d) => d.userId)).toEqual([7, 1, 8]);
  });

  it("no repite: quien ya tiene fila EMAIL de esa campaña no entra (pero sí por otra campaña)", async () => {
    usuarios = [user(1), user(2, { albums: [alb({ orders: [pagado] })] })];
    filasEmail = [{ userId: 1, campaign: "sin_ventas" }, { userId: 2, campaign: "sin_ventas" }];
    const r = await elegirDestinatariosMail(NOW);
    expect(r).toEqual([expect.objectContaining({ userId: 2, campaign: "sin_escolar" })]);
    const llamadaEmail = m.outreachFindMany.mock.calls.find((c) => c[0].where.channel === "EMAIL")!;
    expect(llamadaEmail[0].where).toEqual({
      platform: "CLF", channel: "EMAIL", campaign: { in: ["sin_ventas", "sin_escolar"] },
    });
  });

  it("actividad reciente cuenta aunque lastLoginAt sea viejo: globito tocado o álbum creado en 30 días", async () => {
    usuarios = [
      user(1),
      user(2), // tocó el globito (otra campaña) hace 5 días
      user(3, { albums: [alb(), alb({ createdAt: hace(4) })] }), // creó un álbum hace 4 días
      user(4), // tocó el globito hace 40 días: no cuenta
    ];
    filasPanel = [
      { userId: 2, campaign: "nuevo", status: "SHOWN", updatedAt: hace(5) },
      { userId: 4, campaign: "nuevo", status: "SHOWN", updatedAt: hace(40) },
    ];
    expect((await elegirDestinatariosMail(NOW)).map((d) => d.userId)).toEqual([1, 4]);
  });

  it("«No, gracias» en el panel para esa campaña en los últimos 90 días frena el mail", async () => {
    usuarios = [user(1), user(2), user(3), user(4)];
    filasPanel = [
      { userId: 1, campaign: "sin_ventas", status: "DECLINED", updatedAt: hace(60) },
      { userId: 2, campaign: "sin_ventas", status: "DECLINED", updatedAt: hace(100) }, // venció
      { userId: 3, campaign: "sin_escolar", status: "DECLINED", updatedAt: hace(60) }, // otra campaña
      { userId: 4, campaign: "sin_ventas", status: "DISMISSED", updatedAt: hace(60) },
    ];
    expect((await elegirDestinatariosMail(NOW)).map((d) => d.userId)).toEqual([2, 3, 4]);
  });

  it("asigna la campaña según ventas y escuela", async () => {
    usuarios = [
      user(1), // álbum sin ventas
      user(2, { albums: [alb({ orders: [pagado] })] }), // vendió, nunca escolar
      user(3, { albums: [alb({ orders: [pagado], schoolId: 1 })] }), // vendió y ya hace escolar
      user(4, { albums: [] }), // sin álbum
    ];
    const r = await elegirDestinatariosMail(NOW);
    expect(r.map((d) => [d.userId, d.campaign])).toEqual([[1, "sin_ventas"], [2, "sin_escolar"]]);
  });

  it("máximo 50, primero los que nunca entraron y después los que hace más que no entran", async () => {
    usuarios = Array.from({ length: 70 }, (_, i) =>
      user(i + 1, {
        lastLoginAt: i % 10 === 0 ? null : hace(31 + i),
        albums: i % 2 ? [alb()] : [alb({ orders: [pagado] })],
      }),
    );
    const r = await elegirDestinatariosMail(NOW);
    expect(r).toHaveLength(50);
    for (const c of m.userFindMany.mock.calls) expect(c[0].take).toBe(50);
    expect(r.slice(0, 7).every((d) => d.lastLoginAt === null)).toBe(true);
    const fechas = r.slice(7).map((d) => d.lastLoginAt!.getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => a - b));
    expect(r[7]!.userId).toBe(70); // el que hace más días que no entra
  });

  it("modo piloto: sólo los de la lista; sin piloto no consulta usuarios", async () => {
    usuarios = [user(1), user(2)];
    m.alcance.mockResolvedValue([2, "1", 1.5, null]);
    expect((await elegirDestinatariosMail(NOW)).map((d) => d.userId)).toEqual([2]);
    const ids = (m.userFindMany.mock.calls[0]![0].where.AND as Obj[]).find((w) => (w.id as Obj | undefined)?.in);
    expect(ids).toEqual({ id: { in: [2] } });
    m.userFindMany.mockClear();
    m.alcance.mockResolvedValue(["x"]);
    expect(await elegirDestinatariosMail(NOW)).toEqual([]);
    expect(m.userFindMany).not.toHaveBeenCalled();
    m.userFindMany.mockClear();
    m.alcance.mockResolvedValue(null);
    expect(await elegirDestinatariosMail(NOW)).toEqual([]);
    expect(m.userFindMany).not.toHaveBeenCalled();
  });
});

describe("armarMailOutreach", () => {
  it("sin_ventas: asunto, nombre, botón al panel y enlace de baja", () => {
    const r = armarMailOutreach({ campaign: "sin_ventas", nombre: "Ana <b>Pérez", unsubscribeToken: "abc" });
    expect(r.subject).toBe("Te ayudo a vender tus fotos en CompraMeLaFoto");
    expect(r.body).toContain("Hola Ana: vimos que todavía no vendiste fotos en CompraMeLaFoto.");
    expect(r.body).toContain("https://compramelafoto.com/fotografo/dashboard?dnxbot=sin_ventas");
    expect(r.body).toContain("https://compramelafoto.com/unsubscribe?token=abc");
    expect(r.htmlBody).toContain('href="https://compramelafoto.com/unsubscribe?token=abc"');
    expect(r.htmlBody).toContain("Entrar y que DNX Bot me ayude");
    expect(r.htmlBody).not.toContain("<b>");
  });
  it("sin_escolar: asunto y texto de escolar; sin nombre saluda igual", () => {
    const r = armarMailOutreach({ campaign: "sin_escolar", nombre: null, unsubscribeToken: "t" });
    expect(r.subject).toBe("¿Hacés fotografía escolar? Te ayudamos a automatizarla");
    expect(r.body.startsWith("Hola: en CompraMeLaFoto podés vender fotografía escolar con preventa")).toBe(true);
    expect(r.htmlBody).toContain("/fotografo/dashboard?dnxbot=sin_escolar");
  });
});

describe("enviarMailsOutreach", () => {
  it("asegura el token, encola con clave idempotente y registra SENT", async () => {
    usuarios = [user(4)];
    const r = await enviarMailsOutreach(NOW);
    expect(r).toEqual({ candidatos: 1, enviados: 1, fallidos: 0 });
    expect(m.token).toHaveBeenCalledWith(4);
    const q = m.queue.mock.calls[0]![0];
    expect(q.to).toBe("u4@x.com");
    expect(q.idempotencyKey).toBe("dnx-bot-outreach-sin_ventas-4");
    expect(q.body).toContain("/unsubscribe?token=tok4");
    expect(q.htmlBody).toContain("/unsubscribe?token=tok4");
    expect(m.registrar).toHaveBeenCalledWith({ userId: 4, campaign: "sin_ventas", channel: "EMAIL", status: "SENT" });
  });
  it("si encolar falla registra FAILED y sigue con el resto", async () => {
    usuarios = [user(1, { lastLoginAt: null }), user(2)];
    m.queue.mockRejectedValueOnce(new Error("db caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await enviarMailsOutreach(NOW);
    expect(r).toEqual({ candidatos: 2, enviados: 1, fallidos: 1 });
    expect(m.registrar).toHaveBeenCalledWith({ userId: 1, campaign: "sin_ventas", channel: "EMAIL", status: "FAILED" });
    expect(m.registrar).toHaveBeenCalledWith({ userId: 2, campaign: "sin_ventas", channel: "EMAIL", status: "SENT" });
  });
  it("si el mail se encoló pero falla registrar SENT, no marca FAILED: sólo lo loguea", async () => {
    usuarios = [user(1)];
    m.registrar.mockRejectedValueOnce(new Error("upsert caído"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await enviarMailsOutreach(NOW);
    expect(r).toEqual({ candidatos: 1, enviados: 1, fallidos: 0 });
    expect(m.registrar).toHaveBeenCalledTimes(1);
    expect(m.registrar).not.toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED" }));
    expect(err).toHaveBeenCalled();
  });
});
