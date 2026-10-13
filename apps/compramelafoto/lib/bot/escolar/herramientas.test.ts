import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  progreso: vi.fn(),
  createSchool: vi.fn(),
  ownedSchool: vi.fn(),
  createCourses: vi.fn(),
  updateSchool: vi.fn(),
  invite: vi.fn(),
  status: vi.fn(),
  recipients: vi.fn(),
  notify: vi.fn(),
  album: vi.fn(),
  photoCount: vi.fn(),
  userFind: vi.fn(),
  schoolFindMany: vi.fn(),
}));
vi.mock("@/lib/bot/escolar/progreso", () => ({ computeSchoolSetupProgress: (...a: unknown[]) => m.progreso(...a) }));
vi.mock("@/lib/schools/school-setup", () => ({
  createSchoolForOwner: (...a: unknown[]) => m.createSchool(...a),
  findOwnedSchool: (...a: unknown[]) => m.ownedSchool(...a),
  createSchoolCoursesForOwner: (...a: unknown[]) => m.createCourses(...a),
}));
vi.mock("@/lib/albums/album-school-settings", () => ({ updateAlbumSchoolSettingsForOwner: (...a: unknown[]) => m.updateSchool(...a) }));
vi.mock("@/lib/schools/invite-organizer", () => ({ inviteSchoolOrganizerForOwner: (...a: unknown[]) => m.invite(...a) }));
vi.mock("@/lib/preventa-canjeable/notify-preventa-photos-ready", () => ({
  getPreventaPhotosReadyStatus: (...a: unknown[]) => m.status(...a),
  countPreventaPhotosReadyRecipients: (...a: unknown[]) => m.recipients(...a),
  notifyPreventaPhotosReady: (...a: unknown[]) => m.notify(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: { findFirst: (...a: unknown[]) => m.album(...a) },
    photo: { count: (...a: unknown[]) => m.photoCount(...a) },
    user: { findUnique: (...a: unknown[]) => m.userFind(...a) },
    school: { findMany: (...a: unknown[]) => m.schoolFindMany(...a) },
  },
}));

import { escolarTools } from "./herramientas";

const actor = { userId: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "Fotógrafa" };
const tool = (n: string) => {
  const t = escolarTools.find((x) => x.name === n);
  if (!t) throw new Error(`falta ${n}`);
  return t;
};
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const NO_ALBUM = "No encontré ese álbum en tu cuenta.";
const NO_ESCUELA = "No encontré esa escuela en tu cuenta.";

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.album.mockResolvedValue({ id: 3, title: "Egresados 2026", organizerCommissionPercentage: null, organizerCommissionAppliesTo: ["PREVENTA"] });
  m.ownedSchool.mockResolvedValue({ id: 5, name: "Escuela Norte" });
  m.schoolFindMany.mockResolvedValue([]);
});

describe("herramientas escolares", () => {
  it("son las 8 de la tabla, con el tipo correcto y undo sólo donde corresponde", () => {
    const resumen = Object.fromEntries(escolarTools.map((t) => [t.name, [t.kind, Boolean(t.undo)]]));
    expect(resumen).toEqual({
      ver_progreso_escolar: ["read", false],
      crear_escuela: ["write", false],
      cargar_cursos: ["write", false],
      invitar_admin_escuela: ["write", false],
      vincular_album_a_escuela: ["write", true],
      elegir_identificacion_alumnos: ["write", true],
      configurar_comision_escuela: ["write", true],
      avisar_familias_fotos_listas: ["write", false],
    });
  });

  it("los ids tienen que ser enteros positivos (un id raro no desvincula la escuela)", () => {
    const v = tool("vincular_album_a_escuela").input;
    expect(v.safeParse({ albumId: 3, schoolId: 5 }).success).toBe(true);
    for (const schoolId of ["5", "abc", 0, -1, 1.5, null]) expect(v.safeParse({ albumId: 3, schoolId }).success).toBe(false);
    expect(tool("cargar_cursos").input.safeParse({ schoolId: "x", cursos: [{ nombre: "5°" }] }).success).toBe(false);
    expect(tool("avisar_familias_fotos_listas").input.safeParse({ albumId: 0 }).success).toBe(false);
  });

  describe("ver_progreso_escolar", () => {
    it("devuelve el progreso del fotógrafo", async () => {
      const progreso = { albumId: 3, albumTitulo: "Egresados 2026", schoolId: 5, pasos: [], hechos: 4, total: 11, siguiente: { titulo: "Cargar los cursos" }, aMedias: false };
      m.progreso.mockResolvedValue(progreso);
      const r = await tool("ver_progreso_escolar").run({ albumId: 3 }, actor);
      expect(m.progreso).toHaveBeenCalledWith(7, 3);
      expect(r).toMatchObject({ ok: true, data: progreso });
      expect((r as { message: string }).message).toContain("4 de 11");
    });
    it("álbum ajeno (el progreso cae en otro álbum) → no encontrado, sin datos", async () => {
      m.progreso.mockResolvedValue({ albumId: 9, pasos: [], hechos: 2, total: 11, siguiente: null, aMedias: false });
      const r = await tool("ver_progreso_escolar").run({ albumId: 3 }, actor);
      expect(r).toEqual({ ok: false, code: "NOT_FOUND", message: NO_ALBUM });
    });
  });

  describe("crear_escuela", () => {
    it("describe y run con el fotógrafo como dueño", async () => {
      const d = await tool("crear_escuela").describe!({ nombre: "Escuela Norte", localidad: "Rosario", provincia: "Santa Fe" }, actor);
      expect(d).toContain("«Escuela Norte»");
      expect(d).toContain("Rosario, Santa Fe");
      m.createSchool.mockResolvedValue({ ok: true, school: { id: 5, name: "Escuela Norte" } });
      const r = await tool("crear_escuela").run({ nombre: "Escuela Norte", localidad: "Rosario" }, actor);
      expect(m.createSchool).toHaveBeenCalledWith(7, { name: "Escuela Norte", city: "Rosario", province: undefined });
      expect(r).toMatchObject({ ok: true, data: { schoolId: 5 } });
      expect(m.schoolFindMany.mock.calls[0][0].where).toEqual({ ownerId: 7 });
    });
    it("ya tiene una escuela con el mismo nombre (sin importar mayúsculas ni espacios) → describe lanza y run no crea", async () => {
      m.schoolFindMany.mockResolvedValue([{ id: 2, name: "Otra" }, { id: 9, name: "Escuela  NORTE " }]);
      await expect(tool("crear_escuela").describe!({ nombre: "escuela norte" }, actor)).rejects.toThrow(
        "Ya tenés una escuela llamada «Escuela  NORTE ». Usá esa"
      );
      const r = await tool("crear_escuela").run({ nombre: "  Escuela   Norte" }, actor);
      expect(r).toMatchObject({ ok: false, code: "DUPLICATE", data: { schoolId: 9 } });
      expect(m.createSchool).not.toHaveBeenCalled();
    });
  });

  describe("cargar_cursos", () => {
    const cursos = [{ nombre: "5°", division: "A" }, { nombre: "5°", division: "B" }, { nombre: "6°" }];
    it("describe lista los cursos; escuela ajena → lanza sin tarjeta", async () => {
      const d = await tool("cargar_cursos").describe!({ schoolId: 5, cursos }, actor);
      expect(d).toContain("Escuela Norte");
      expect(d).toContain("5° A, 5° B, 6°");
      m.ownedSchool.mockResolvedValue(null);
      await expect(tool("cargar_cursos").describe!({ schoolId: 5, cursos }, actor)).rejects.toThrow(NO_ESCUELA);
      expect(m.ownedSchool).toHaveBeenLastCalledWith(7, 5);
      expect(m.createCourses).not.toHaveBeenCalled();
    });
    it("run saltea repetidos y lo dice", async () => {
      m.createCourses.mockResolvedValue({ ok: true, created: 1, skipped: 2, courses: [] });
      const r = await tool("cargar_cursos").run({ schoolId: 5, cursos }, actor);
      expect(m.createCourses).toHaveBeenCalledWith(
        7,
        5,
        [{ name: "5°", division: "A" }, { name: "5°", division: "B" }, { name: "6°", division: undefined }],
        { skipExisting: true }
      );
      expect(r).toMatchObject({ ok: true, data: { creados: 1, salteados: 2 } });
      expect((r as { message: string }).message).toContain("2 ya estaban");
    });
    it("run con escuela ajena → no encontrada", async () => {
      m.createCourses.mockResolvedValue({ ok: false, status: 404, error: "Escuela no encontrada" });
      expect(await tool("cargar_cursos").run({ schoolId: 5, cursos }, actor)).toMatchObject({ ok: false, message: NO_ESCUELA });
    });
    it("entre 1 y 40 cursos", () => {
      const i = tool("cargar_cursos").input;
      expect(i.safeParse({ schoolId: 5, cursos: [] }).success).toBe(false);
      expect(i.safeParse({ schoolId: 5, cursos: Array.from({ length: 41 }, (_, n) => ({ nombre: `${n}` })) }).success).toBe(false);
    });
  });

  describe("invitar_admin_escuela", () => {
    const input = { schoolId: 5, nombre: "Ana Pérez", email: "Ana@Escuela.com" };
    it("describe dice a quién le llega el mail y que no se puede deshacer", async () => {
      m.userFind.mockResolvedValue(null);
      const d = await tool("invitar_admin_escuela").describe!(input, actor);
      expect(d).toContain("Ana Pérez");
      expect(d).toContain("ana@escuela.com");
      expect(d).toContain("Escuela Norte");
      expect(d).toContain("No se puede deshacer.");
    });
    it("escuela ajena → lanza sin tarjeta y sin mirar el mail", async () => {
      m.ownedSchool.mockResolvedValue(null);
      await expect(tool("invitar_admin_escuela").describe!(input, actor)).rejects.toThrow(NO_ESCUELA);
      expect(m.userFind).not.toHaveBeenCalled();
    });
    it("mail de otro tipo de usuario → lanza el mismo aviso que la ruta (409)", async () => {
      m.userFind.mockResolvedValue({ role: "CUSTOMER" });
      await expect(tool("invitar_admin_escuela").describe!(input, actor)).rejects.toThrow("Ya existe un usuario con ese email y no es usuario de escuela.");
    });
    it("run usa la lógica de la ruta con el fotógrafo como dueño", async () => {
      m.invite.mockResolvedValue({ ok: true, invitation: { id: 1 }, emailSent: true, emailError: null });
      const r = await tool("invitar_admin_escuela").run(input, actor);
      expect(m.invite).toHaveBeenCalledWith({ owner: { id: 7, name: "Fotógrafa" }, schoolId: 5, name: "Ana Pérez", email: "Ana@Escuela.com" });
      expect(r).toMatchObject({ ok: true });
    });
    it("run: escuela ajena → no encontrada; 409 → el mensaje de la ruta", async () => {
      m.invite.mockResolvedValue({ ok: false, status: 404, error: "Escuela no encontrada." });
      expect(await tool("invitar_admin_escuela").run(input, actor)).toMatchObject({ ok: false, message: NO_ESCUELA });
      m.invite.mockResolvedValue({ ok: false, status: 409, error: "Ya existe un usuario con ese email y no es usuario de escuela." });
      expect(await tool("invitar_admin_escuela").run(input, actor)).toMatchObject({ ok: false, code: "409" });
    });
    it("run: el mail no salió → lo dice", async () => {
      m.invite.mockResolvedValue({ ok: true, invitation: { id: 1 }, emailSent: false, emailError: "rebotó" });
      vi.spyOn(console, "error").mockImplementation(() => {});
      const r = (await tool("invitar_admin_escuela").run(input, actor)) as { message: string };
      expect(r.message).toContain("no pude mandar el mail de invitación; podés reenviarla desde la ficha de la escuela");
      expect(r.message).not.toContain("rebotó");
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("invitar_admin_escuela"), expect.objectContaining({ error: "rebotó" }));
    });
  });

  describe("vincular_album_a_escuela", () => {
    it("describe con álbum y escuela propios", async () => {
      const d = await tool("vincular_album_a_escuela").describe!({ albumId: 3, schoolId: 5 }, actor);
      expect(d).toContain("Egresados 2026");
      expect(d).toContain("Escuela Norte");
      expect(m.album).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 3, userId: 7, deletedAt: null } }));
    });
    it("álbum ajeno o escuela ajena → describe lanza", async () => {
      m.album.mockResolvedValueOnce(null);
      await expect(tool("vincular_album_a_escuela").describe!({ albumId: 3, schoolId: 5 }, actor)).rejects.toThrow(NO_ALBUM);
      m.ownedSchool.mockResolvedValue(null);
      await expect(tool("vincular_album_a_escuela").describe!({ albumId: 3, schoolId: 5 }, actor)).rejects.toThrow(NO_ESCUELA);
      expect(m.updateSchool).not.toHaveBeenCalled();
    });
    it("run manda modo escolar + escuela; undo con before pasado por JSON", async () => {
      m.updateSchool.mockResolvedValueOnce({ ok: true, before: { schoolId: null, mode: "SIMPLE" }, after: { schoolId: 5, mode: "SCHOOL" } });
      const r = (await tool("vincular_album_a_escuela").run({ albumId: 3, schoolId: 5 }, actor)) as { ok: true; before: unknown };
      expect(m.updateSchool).toHaveBeenCalledWith({ actorUserId: 7, albumId: 3, patch: { mode: "SCHOOL", schoolId: 5 } });
      m.updateSchool.mockResolvedValueOnce({ ok: true, before: {}, after: {} });
      expect(await tool("vincular_album_a_escuela").undo!(json(r.before), actor)).toMatchObject({ ok: true });
      expect(m.updateSchool).toHaveBeenLastCalledWith({ actorUserId: 7, albumId: 3, patch: { schoolId: null, mode: "SIMPLE" } });
    });
    it("run: álbum o escuela ajenos → no encontrado sin revelar", async () => {
      m.updateSchool.mockResolvedValueOnce({ ok: false, status: 404, error: "Álbum no encontrado" });
      expect(await tool("vincular_album_a_escuela").run({ albumId: 3, schoolId: 5 }, actor)).toMatchObject({ ok: false, message: NO_ALBUM });
      m.updateSchool.mockResolvedValueOnce({ ok: false, status: 400, error: "Escuela no encontrada o no te pertenece" });
      expect(await tool("vincular_album_a_escuela").run({ albumId: 3, schoolId: 5 }, actor)).toMatchObject({ ok: false, message: NO_ESCUELA });
    });
    it("undo con datos raros no escribe", async () => {
      expect(await tool("vincular_album_a_escuela").undo!({ albumId: 3, valores: { schoolId: "abc" } }, actor)).toMatchObject({ ok: false });
      expect(await tool("vincular_album_a_escuela").undo!({ albumId: "3", valores: {} }, actor)).toMatchObject({ ok: false });
      expect(m.updateSchool).not.toHaveBeenCalled();
    });
    it("undo ajeno → no encontrado", async () => {
      m.updateSchool.mockResolvedValueOnce({ ok: false, status: 404, error: "Álbum no encontrado" });
      expect(await tool("vincular_album_a_escuela").undo!({ albumId: 3, valores: { schoolId: null } }, actor)).toMatchObject({ ok: false, message: NO_ALBUM });
    });
  });

  describe("elegir_identificacion_alumnos", () => {
    it("describe explica el modo elegido; álbum ajeno → lanza", async () => {
      const d = await tool("elegir_identificacion_alumnos").describe!({ albumId: 3, modo: "ROSTER_REQUIRED", permitirManual: true }, actor);
      expect(d).toContain("Egresados 2026");
      expect(d).toContain("lista");
      expect(d).toContain("carga manual");
      m.album.mockResolvedValue(null);
      await expect(tool("elegir_identificacion_alumnos").describe!({ albumId: 3, modo: "NONE" }, actor)).rejects.toThrow(NO_ALBUM);
    });
    it("run y undo con before por JSON", async () => {
      m.updateSchool.mockResolvedValueOnce({ ok: true, before: { studentIdentificationMode: null, allowManualStudentFallback: false }, after: {} });
      const r = (await tool("elegir_identificacion_alumnos").run({ albumId: 3, modo: "MANUAL", permitirManual: true }, actor)) as { before: unknown };
      expect(m.updateSchool).toHaveBeenCalledWith({ actorUserId: 7, albumId: 3, patch: { studentIdentificationMode: "MANUAL", allowManualStudentFallback: true } });
      m.updateSchool.mockResolvedValueOnce({ ok: true, before: {}, after: {} });
      await tool("elegir_identificacion_alumnos").undo!(json(r.before), actor);
      expect(m.updateSchool).toHaveBeenLastCalledWith({ actorUserId: 7, albumId: 3, patch: { studentIdentificationMode: null, allowManualStudentFallback: false } });
    });
    it("run con álbum ajeno → no encontrado", async () => {
      m.updateSchool.mockResolvedValue({ ok: false, status: 404, error: "Álbum no encontrado" });
      expect(await tool("elegir_identificacion_alumnos").run({ albumId: 3, modo: "NONE" }, actor)).toMatchObject({ ok: false, message: NO_ALBUM });
    });
  });

  describe("configurar_comision_escuela", () => {
    it("describe en castellano; álbum ajeno → lanza", async () => {
      const d = await tool("configurar_comision_escuela").describe!({ albumId: 3, habilitar: true, porcentaje: 10, aplicaA: ["PREVENTA", "POST_EVENT"] }, actor);
      expect(d).toContain("10%");
      expect(d).toContain("preventa");
      expect(d).toContain("ventas posteriores");
      m.album.mockResolvedValue(null);
      await expect(tool("configurar_comision_escuela").describe!({ albumId: 3, habilitar: false }, actor)).rejects.toThrow(NO_ALBUM);
    });
    it("habilitar sin porcentaje y sin uno guardado → describe lanza", async () => {
      await expect(tool("configurar_comision_escuela").describe!({ albumId: 3, habilitar: true }, actor)).rejects.toThrow("porcentaje");
    });
    it("porcentaje fuera de 0–100 no pasa el esquema", () => {
      expect(tool("configurar_comision_escuela").input.safeParse({ albumId: 3, habilitar: true, porcentaje: 120 }).success).toBe(false);
    });
    it("run y undo con before por JSON", async () => {
      m.updateSchool.mockResolvedValueOnce({
        ok: true,
        before: { organizerCommissionEnabled: false, organizerCommissionPercentage: null, organizerCommissionAppliesTo: ["PREVENTA"] },
        after: {},
      });
      const r = (await tool("configurar_comision_escuela").run({ albumId: 3, habilitar: true, porcentaje: 10, aplicaA: ["PREVENTA", "EXTRAS"] }, actor)) as { before: unknown };
      expect(m.updateSchool).toHaveBeenCalledWith({
        actorUserId: 7,
        albumId: 3,
        patch: { organizerCommissionEnabled: true, organizerCommissionPercentage: 10, organizerCommissionAppliesTo: ["PREVENTA", "EXTRAS"] },
      });
      m.updateSchool.mockResolvedValueOnce({ ok: true, before: {}, after: {} });
      await tool("configurar_comision_escuela").undo!(json(r.before), actor);
      expect(m.updateSchool).toHaveBeenLastCalledWith({
        actorUserId: 7,
        albumId: 3,
        patch: { organizerCommissionEnabled: false, organizerCommissionPercentage: null, organizerCommissionAppliesTo: ["PREVENTA"] },
      });
    });
    it("run con álbum ajeno → no encontrado", async () => {
      m.updateSchool.mockResolvedValue({ ok: false, status: 404, error: "Álbum no encontrado" });
      expect(await tool("configurar_comision_escuela").run({ albumId: 3, habilitar: false }, actor)).toMatchObject({ ok: false, message: NO_ALBUM });
    });
  });

  describe("avisar_familias_fotos_listas", () => {
    beforeEach(() => {
      m.photoCount.mockResolvedValue(120);
      m.status.mockResolvedValue({ pendientes: 14, canjeados: 3, ultimoAvisoAt: null });
      m.recipients.mockResolvedValue({ conEmail: 12, sinEmail: 2 });
    });
    it("describe dice a cuántas familias les llega el mail y que no se puede deshacer", async () => {
      const d = await tool("avisar_familias_fotos_listas").describe!({ albumId: 3 }, actor);
      expect(d).toContain("Se manda un mail a 12 familias");
      expect(d).toContain("2");
      expect(d).toContain("No se puede deshacer.");
      expect(m.photoCount).toHaveBeenCalledWith({ where: { albumId: 3, isRemoved: false } });
    });
    it("álbum ajeno → lanza sin tarjeta y sin mirar las familias", async () => {
      m.album.mockResolvedValue(null);
      await expect(tool("avisar_familias_fotos_listas").describe!({ albumId: 3 }, actor)).rejects.toThrow(NO_ALBUM);
      expect(m.album).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 3, userId: 7, deletedAt: null } }));
      expect(m.status).not.toHaveBeenCalled();
    });
    it("álbum sin fotos → lanza", async () => {
      m.photoCount.mockResolvedValue(0);
      await expect(tool("avisar_familias_fotos_listas").describe!({ albumId: 3 }, actor)).rejects.toThrow("no tiene fotos");
    });
    it("sin familias pendientes → lanza", async () => {
      m.status.mockResolvedValue({ pendientes: 0, canjeados: 10, ultimoAvisoAt: null });
      await expect(tool("avisar_familias_fotos_listas").describe!({ albumId: 3 }, actor)).rejects.toThrow("No hay familias");
    });
    it("pendientes pero ninguna con mail (cobradas por fuera) → lanza", async () => {
      m.recipients.mockResolvedValue({ conEmail: 0, sinEmail: 4 });
      await expect(tool("avisar_familias_fotos_listas").describe!({ albumId: 3 }, actor)).rejects.toThrow("Canjes");
    });
    it("run avisa con la URL del sitio; sin fotos o ajeno no manda nada", async () => {
      const prev = process.env.APP_URL;
      delete process.env.APP_URL;
      m.notify.mockResolvedValue({ enviados: 12, sinEmail: 2 });
      const r = await tool("avisar_familias_fotos_listas").run({ albumId: 3 }, actor);
      expect(m.notify).toHaveBeenCalledWith({ albumId: 3, baseUrl: "https://www.compramelafoto.com" });
      expect(r).toMatchObject({ ok: true, data: { enviados: 12, sinEmail: 2 } });
      process.env.APP_URL = "https://otra.test/";
      await tool("avisar_familias_fotos_listas").run({ albumId: 3 }, actor);
      expect(m.notify).toHaveBeenLastCalledWith({ albumId: 3, baseUrl: "https://otra.test" });
      if (prev === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = prev;

      m.notify.mockReset();
      m.photoCount.mockResolvedValue(0);
      expect(await tool("avisar_familias_fotos_listas").run({ albumId: 3 }, actor)).toMatchObject({ ok: false });
      m.album.mockResolvedValue(null);
      expect(await tool("avisar_familias_fotos_listas").run({ albumId: 3 }, actor)).toMatchObject({ ok: false, message: NO_ALBUM });
      expect(m.notify).not.toHaveBeenCalled();
    });
  });
});
