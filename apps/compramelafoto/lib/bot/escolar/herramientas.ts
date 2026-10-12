/**
 * Herramientas escolares de DNX Bot (para fotógrafos): una de lectura y siete de escritura.
 *
 * Todas verifican el dueño: `describe` lanza un error amable si el álbum o la escuela no
 * son del fotógrafo (el motor lo devuelve al modelo y NO arma la tarjeta), y `run`/`undo`
 * vuelven a verificar. Las que mandan mails a terceros (invitar a la escuela, avisar a las
 * familias) no tienen undo y lo dicen en la tarjeta.
 *
 * Regla de producto (12/10): ninguna herramienta crea packs cobrados por fuera («el colegio
 * ya cobró por fuera»): es una excepción para fotógrafos que se sumaron a mitad de camino.
 */
import { defineTool, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { computeSchoolSetupProgress } from "@/lib/bot/escolar/progreso";
import { updateAlbumSchoolSettingsForOwner, type AlbumSchoolPatch } from "@/lib/albums/album-school-settings";
import {
  countPreventaPhotosReadyRecipients,
  getPreventaPhotosReadyStatus,
  notifyPreventaPhotosReady,
} from "@/lib/preventa-canjeable/notify-preventa-photos-ready";
import { inviteSchoolOrganizerForOwner } from "@/lib/schools/invite-organizer";
import { createSchoolCoursesForOwner, createSchoolForOwner, findOwnedSchool } from "@/lib/schools/school-setup";
import { prisma } from "@/lib/prisma";

const NO_ALBUM = "No encontré ese álbum en tu cuenta.";
const NO_ESCUELA = "No encontré esa escuela en tu cuenta.";
const ERROR_ESCUELA_AJENA = "Escuela no encontrada o no te pertenece";
const NO_DESHACER = "No pude deshacer: los datos guardados no son válidos.";
const URL_SITIO = "https://www.compramelafoto.com";

const id = z.number().int().positive();

const MODOS_IDENTIFICACION = ["NONE", "MANUAL", "ROSTER_OPTIONAL", "ROSTER_REQUIRED"] as const;
const TIPOS_COMISION = ["PREVENTA", "POST_EVENT", "EXTRAS"] as const;

const EXPLICA_MODO: Record<(typeof MODOS_IDENTIFICACION)[number], string> = {
  NONE: "sin identificación: las familias compran sin decir de qué alumno es",
  MANUAL: "carga manual: la familia escribe el nombre del alumno al comprar",
  ROSTER_OPTIONAL: "lista opcional: la familia elige al alumno de la lista del curso, si quiere",
  ROSTER_REQUIRED: "lista obligatoria: la familia tiene que elegir al alumno de la lista del curso",
};

const NOMBRE_TIPO: Record<(typeof TIPOS_COMISION)[number], string> = {
  PREVENTA: "preventa",
  POST_EVENT: "ventas posteriores",
  EXTRAS: "extras y canjes",
};

/**
 * `before` guardado por las herramientas de configuración escolar. Pasa por JSON, así que
 * se valida antes de usarlo como parche: los ids tienen que ser enteros positivos (o null),
 * porque un `schoolId` raro desvincularía la escuela.
 */
const beforeEscolarSchema = z.object({
  albumId: id,
  valores: z.strictObject({
    mode: z.enum(["SIMPLE", "EVENT", "SCHOOL", "COLLABORATIVE"]).optional(),
    schoolId: id.nullable().optional(),
    studentIdentificationMode: z.enum(MODOS_IDENTIFICACION).nullable().optional(),
    allowManualStudentFallback: z.boolean().optional(),
    organizerCommissionEnabled: z.boolean().optional(),
    organizerCommissionPercentage: z.number().min(0).max(100).nullable().optional(),
    organizerCommissionAppliesTo: z.array(z.enum(TIPOS_COMISION)).optional(),
  }),
});

function lista(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

async function albumPropio(albumId: number, userId: number) {
  return prisma.album.findFirst({
    where: { id: albumId, userId, deletedAt: null },
    select: { id: true, title: true, organizerCommissionPercentage: true, organizerCommissionAppliesTo: true },
  });
}

/** Error de `updateAlbumSchoolSettingsForOwner` sin revelar si el álbum o la escuela existen. */
function errorDeConfiguracion(r: { status: number; error: string }) {
  if (r.status === 404) return { ok: false as const, code: "NOT_FOUND", message: NO_ALBUM };
  if (r.error === ERROR_ESCUELA_AJENA) return { ok: false as const, code: "NOT_FOUND", message: NO_ESCUELA };
  return { ok: false as const, code: String(r.status), message: r.error };
}

async function aplicarConfiguracion(albumId: number, patch: AlbumSchoolPatch, userId: number, listo: string) {
  const r = await updateAlbumSchoolSettingsForOwner({ actorUserId: userId, albumId, patch });
  if (!r.ok) return errorDeConfiguracion(r);
  return { ok: true as const, message: listo, before: { albumId, valores: r.before }, after: { albumId, valores: r.after } };
}

async function deshacerConfiguracion(before: unknown, userId: number) {
  const b = beforeEscolarSchema.safeParse(before);
  if (!b.success) return { ok: false as const, message: NO_DESHACER };
  const r = await updateAlbumSchoolSettingsForOwner({ actorUserId: userId, albumId: b.data.albumId, patch: b.data.valores });
  if (!r.ok) return errorDeConfiguracion(r);
  return { ok: true as const, message: "Volví la configuración escolar del álbum a como estaba." };
}

function fechaHoraAr(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type AvisoPreparado =
  | { error: string }
  | {
      album: { title: string };
      estado: Awaited<ReturnType<typeof getPreventaPhotosReadyStatus>>;
      destinatarios: Awaited<ReturnType<typeof countPreventaPhotosReadyRecipients>>;
    };

/** Chequeos previos al aviso a familias; lanza (describe) o se devuelve como error (run). */
async function prepararAviso(albumId: number, userId: number): Promise<AvisoPreparado> {
  const album = await albumPropio(albumId, userId);
  if (!album) return { error: NO_ALBUM };
  const fotos = await prisma.photo.count({ where: { albumId, isRemoved: false } });
  if (fotos === 0) {
    return { error: `«${album.title}» todavía no tiene fotos: primero hay que subirlas y después avisar a las familias.` };
  }
  const estado = await getPreventaPhotosReadyStatus(albumId);
  if (estado.pendientes === 0) {
    return { error: `No hay familias de la preventa de «${album.title}» esperando para elegir sus fotos: no hay a quién avisar.` };
  }
  const destinatarios = await countPreventaPhotosReadyRecipients(albumId);
  if (destinatarios.conEmail === 0) {
    return {
      error: `Las ${estado.pendientes} familias pendientes de «${album.title}» no tienen mail cargado (packs cobrados por fuera): el link se les pasa desde Canjes.`,
    };
  }
  return { album, estado, destinatarios };
}

export const escolarTools: BotTool[] = [
  defineTool({
    name: "ver_progreso_escolar",
    description:
      "Progreso del armado escolar (11 pasos: escuela, cursos, administrador, álbum vinculado, identificación, preventa, plantillas, comisión, preventa publicada, fotos y aviso, entrega). Sin albumId usa el último álbum escolar.",
    kind: "read",
    input: z.strictObject({ albumId: id.optional() }),
    run: async ({ albumId }, actor) => {
      const progreso = await computeSchoolSetupProgress(actor.userId, albumId);
      // Un albumId ajeno hace que el progreso caiga en otro álbum: se responde como no encontrado.
      if (albumId != null && progreso.albumId !== albumId) return { ok: false, code: "NOT_FOUND", message: NO_ALBUM };
      const siguiente = progreso.siguiente ? ` Siguiente paso: ${progreso.siguiente.titulo}.` : "";
      return { ok: true, message: `Armado escolar: ${progreso.hechos} de ${progreso.total} pasos hechos.${siguiente}`, data: progreso };
    },
  }),
  defineTool({
    name: "crear_escuela",
    description: "Propone crear una escuela del fotógrafo (nombre y, si se sabe, localidad y provincia).",
    kind: "write",
    input: z.strictObject({
      nombre: z.string().trim().min(1).max(200),
      localidad: z.string().trim().max(120).optional(),
      provincia: z.string().trim().max(120).optional(),
    }),
    describe: async (i) => {
      const lugar = [i.localidad, i.provincia].filter(Boolean).join(", ");
      return `Crear la escuela «${i.nombre}»${lugar ? ` (${lugar})` : ""}.`;
    },
    run: async (i, actor) => {
      const r = await createSchoolForOwner(actor.userId, { name: i.nombre, city: i.localidad, province: i.provincia });
      if (!r.ok) return { ok: false, code: String(r.status), message: r.error };
      return { ok: true, message: `Listo, creé la escuela «${r.school.name}».`, data: { schoolId: r.school.id } };
    },
  }),
  defineTool({
    name: "cargar_cursos",
    description: "Propone cargar cursos (nombre y división) en una escuela del fotógrafo. Los que ya existen se saltean.",
    kind: "write",
    input: z.strictObject({
      schoolId: id,
      cursos: z
        .array(z.strictObject({ nombre: z.string().trim().min(1).max(80), division: z.string().trim().max(40).optional() }))
        .min(1)
        .max(40),
    }),
    describe: async ({ schoolId, cursos }, actor) => {
      const escuela = await findOwnedSchool(actor.userId, schoolId);
      if (!escuela) throw new Error(NO_ESCUELA);
      const nombres = cursos.map((c) => (c.division ? `${c.nombre} ${c.division}` : c.nombre));
      return `En la escuela «${escuela.name}»: cargar ${cursos.length === 1 ? "el curso" : `${cursos.length} cursos`} ${nombres.join(", ")}. Los que ya estén cargados se saltean.`;
    },
    run: async ({ schoolId, cursos }, actor) => {
      const r = await createSchoolCoursesForOwner(
        actor.userId,
        schoolId,
        cursos.map((c) => ({ name: c.nombre, division: c.division })),
        { skipExisting: true }
      );
      if (!r.ok) return r.status === 404 ? { ok: false, code: "NOT_FOUND", message: NO_ESCUELA } : { ok: false, code: String(r.status), message: r.error };
      const salteados = r.skipped ? ` (${r.skipped} ya estaban y los salteé)` : "";
      return { ok: true, message: `Listo, cargué ${r.created} ${r.created === 1 ? "curso" : "cursos"}${salteados}.`, data: { creados: r.created, salteados: r.skipped } };
    },
  }),
  defineTool({
    name: "invitar_admin_escuela",
    description:
      "Propone invitar por mail a una persona de la escuela como administradora (ve el álbum, los cursos y las ventas de su escuela). Manda un mail: no se puede deshacer.",
    kind: "write",
    input: z.strictObject({ schoolId: id, nombre: z.string().trim().min(1).max(120), email: z.string().trim().email().max(200) }),
    describe: async ({ schoolId, nombre, email }, actor) => {
      const escuela = await findOwnedSchool(actor.userId, schoolId);
      if (!escuela) throw new Error(NO_ESCUELA);
      const mail = email.trim().toLowerCase();
      const existente = await prisma.user.findUnique({ where: { email: mail }, select: { role: true } });
      if (existente && existente.role !== "SCHOOL_ORGANIZER") {
        throw new Error("Ya existe un usuario con ese email y no es usuario de escuela.");
      }
      return `Invitar a ${nombre} como administrador/a de la escuela «${escuela.name}». Se le manda un mail a ${mail} con el enlace para activar su cuenta. No se puede deshacer.`;
    },
    run: async ({ schoolId, nombre, email }, actor) => {
      const r = await inviteSchoolOrganizerForOwner({ owner: { id: actor.userId, name: actor.name }, schoolId, name: nombre, email });
      if (!r.ok) return r.status === 404 ? { ok: false, code: "NOT_FOUND", message: NO_ESCUELA } : { ok: false, code: String(r.status), message: r.error };
      if (!r.emailSent) {
        return {
          ok: true,
          message: `Quedó creada la invitación para ${r.invitation.email}, pero el mail no salió (${r.emailError}). Se puede reenviar desde la escuela, en el panel.`,
          data: { invitationId: r.invitation.id, emailSent: false },
        };
      }
      return { ok: true, message: `Listo, le mandé la invitación a ${r.invitation.email}. Vence en 7 días.`, data: { invitationId: r.invitation.id, emailSent: true } };
    },
  }),
  defineTool({
    name: "vincular_album_a_escuela",
    description: "Propone vincular un álbum a una escuela del fotógrafo y pasarlo a modo escolar. No carga el padrón de alumnos.",
    kind: "write",
    input: z.strictObject({ albumId: id, schoolId: id }),
    describe: async ({ albumId, schoolId }, actor) => {
      const album = await albumPropio(albumId, actor.userId);
      if (!album) throw new Error(NO_ALBUM);
      const escuela = await findOwnedSchool(actor.userId, schoolId);
      if (!escuela) throw new Error(NO_ESCUELA);
      return `Vincular el álbum «${album.title}» a la escuela «${escuela.name}» y pasarlo a modo escolar. La lista de alumnos no se carga sola.`;
    },
    run: async ({ albumId, schoolId }, actor) =>
      aplicarConfiguracion(albumId, { mode: "SCHOOL", schoolId }, actor.userId, "Listo, el álbum quedó vinculado a la escuela."),
    undo: async (before, actor) => deshacerConfiguracion(before, actor.userId),
  }),
  defineTool({
    name: "elegir_identificacion_alumnos",
    description:
      "Propone cómo se identifica al alumno en las compras del álbum: NONE (sin identificar), MANUAL (la familia escribe el nombre), ROSTER_OPTIONAL (lista del curso, opcional), ROSTER_REQUIRED (lista del curso, obligatoria). permitirManual: si no encuentra al alumno en la lista, puede escribirlo.",
    kind: "write",
    input: z.strictObject({ albumId: id, modo: z.enum(MODOS_IDENTIFICACION), permitirManual: z.boolean().optional() }),
    describe: async ({ albumId, modo, permitirManual }, actor) => {
      const album = await albumPropio(albumId, actor.userId);
      if (!album) throw new Error(NO_ALBUM);
      const manual =
        permitirManual === undefined
          ? ""
          : permitirManual
            ? " Si no encuentra al alumno en la lista, la familia puede hacer carga manual."
            : " Sin carga manual si no encuentra al alumno en la lista.";
      return `En «${album.title}»: identificar a los alumnos con ${EXPLICA_MODO[modo]}.${manual}`;
    },
    run: async ({ albumId, modo, permitirManual }, actor) =>
      aplicarConfiguracion(
        albumId,
        { studentIdentificationMode: modo, ...(permitirManual !== undefined ? { allowManualStudentFallback: permitirManual } : {}) },
        actor.userId,
        "Listo, guardé cómo se identifica a los alumnos."
      ),
    undo: async (before, actor) => deshacerConfiguracion(before, actor.userId),
  }),
  defineTool({
    name: "configurar_comision_escuela",
    description:
      "Propone activar o desactivar la comisión que se lleva la escuela en las ventas del álbum: porcentaje (0–100) y a qué ventas aplica (PREVENTA, POST_EVENT = ventas posteriores, EXTRAS = extras y canjes).",
    kind: "write",
    input: z.strictObject({
      albumId: id,
      habilitar: z.boolean(),
      porcentaje: z.number().min(0).max(100).optional(),
      aplicaA: z.array(z.enum(TIPOS_COMISION)).min(1).max(3).optional(),
    }),
    describe: async ({ albumId, habilitar, porcentaje, aplicaA }, actor) => {
      const album = await albumPropio(albumId, actor.userId);
      if (!album) throw new Error(NO_ALBUM);
      if (!habilitar) return `En «${album.title}»: desactivar la comisión de la escuela.`;
      const pct = porcentaje ?? album.organizerCommissionPercentage;
      if (pct == null) throw new Error("Para activar la comisión de la escuela necesito el porcentaje.");
      const tipos = (aplicaA ?? album.organizerCommissionAppliesTo ?? []) as Array<(typeof TIPOS_COMISION)[number]>;
      const sobre = tipos.length ? ` sobre ${lista(tipos.map((t) => NOMBRE_TIPO[t]))}` : "";
      return `En «${album.title}»: la escuela se lleva una comisión del ${pct}%${sobre}.`;
    },
    run: async ({ albumId, habilitar, porcentaje, aplicaA }, actor) => {
      if (habilitar && porcentaje === undefined) {
        const album = await albumPropio(albumId, actor.userId);
        if (!album) return { ok: false, code: "NOT_FOUND", message: NO_ALBUM };
        if (album.organizerCommissionPercentage == null) return { ok: false, message: "Falta el porcentaje de la comisión." };
      }
      const patch: AlbumSchoolPatch = { organizerCommissionEnabled: habilitar };
      if (porcentaje !== undefined) patch.organizerCommissionPercentage = porcentaje;
      if (aplicaA !== undefined) patch.organizerCommissionAppliesTo = aplicaA;
      return aplicarConfiguracion(albumId, patch, actor.userId, "Listo, guardé la comisión de la escuela.");
    },
    undo: async (before, actor) => deshacerConfiguracion(before, actor.userId),
  }),
  defineTool({
    name: "avisar_familias_fotos_listas",
    description:
      "Propone mandar el mail «ya están las fotos» a las familias que compraron en preventa y todavía no eligieron sus fotos. Sólo si el álbum ya tiene fotos. Manda mails: no se puede deshacer.",
    kind: "write",
    input: z.strictObject({ albumId: id }),
    describe: async ({ albumId }, actor) => {
      const p = await prepararAviso(albumId, actor.userId);
      if ("error" in p) throw new Error(p.error);
      const { album, estado, destinatarios } = p;
      const partes = [
        `Se manda un mail a ${destinatarios.conEmail} ${destinatarios.conEmail === 1 ? "familia" : "familias"} de «${album.title}» avisando que ya están las fotos, con el link para elegir las de su pack.`,
      ];
      if (destinatarios.sinEmail > 0) {
        partes.push(`Otras ${destinatarios.sinEmail} no tienen mail (packs cobrados por fuera): a esas el link se les pasa desde Canjes.`);
      }
      if (estado.ultimoAvisoAt) partes.push(`El último aviso salió el ${fechaHoraAr(estado.ultimoAvisoAt)}.`);
      partes.push("No se puede deshacer.");
      return partes.join(" ");
    },
    run: async ({ albumId }, actor) => {
      const p = await prepararAviso(albumId, actor.userId);
      if ("error" in p) return p.error === NO_ALBUM ? { ok: false, code: "NOT_FOUND", message: NO_ALBUM } : { ok: false, message: p.error };
      const baseUrl = (process.env.APP_URL || URL_SITIO).replace(/\/+$/, "");
      const r = await notifyPreventaPhotosReady({ albumId, baseUrl });
      const sinEmail = r.sinEmail ? ` ${r.sinEmail} no tienen mail: a esas pasales el link desde Canjes.` : "";
      return { ok: true, message: `Listo, avisé a ${r.enviados} ${r.enviados === 1 ? "familia" : "familias"}.${sinEmail}`, data: r };
    },
  }),
];
