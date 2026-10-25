"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@repo/db";
import { minorToDecimalString, parseArsToMinor } from "@/lib/membership/money";
import { contextoEquipo, type CtxEquipo } from "@/lib/equipo/acceso";
import { JORNADA_POR_OMISION_MIN } from "@/lib/equipo/constantes";
import { esFechaValida, leerHora } from "@/lib/equipo/fechas";
import { leerFormularioFicha } from "@/lib/equipo/ficha";
import { MOTIVOS_CAMBIO, type MotivoCambio } from "@/lib/equipo/horario";
import { MOMENTOS, OCASIONES, PARTES, validarTextoPieza } from "@/lib/equipo/mensajes";
import { asegurarRepertorio } from "@/lib/equipo/mensajes-servidor";

/**
 * Acciones del panel Equipo: sólo dueño o administrador con el módulo encendido
 * (`contextoEquipo`). Ante cualquier falta de permiso rebotan al inicio sin decir el motivo.
 */

async function ctxOFuera(): Promise<CtxEquipo> {
  const ctx = await contextoEquipo();
  if (!ctx) redirect("/dashboard");
  return ctx;
}

function volverConError(ruta: string, error: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(error)}`);
}

function rutaFicha(userId: number) {
  return `/equipo/${userId}`;
}

/** La ficha de esa persona del espacio, o null. Verifica que siga siendo miembro. */
async function fichaDelEspacio(workspaceId: string, userId: number) {
  const m = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { id: true },
  });
  if (!m) return null;
  return prisma.fotofficeEquipoFicha.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true },
  });
}

function leerUserId(fd: FormData): number {
  const n = Number(fd.get("userId"));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export async function crearFichaAction(fd: FormData): Promise<void> {
  const ctx = await ctxOFuera();
  const userId = leerUserId(fd);
  const m = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: ctx.workspaceId } },
    select: { id: true },
  });
  if (!m) volverConError("/equipo", "Esa persona no es del equipo.");
  try {
    await prisma.fotofficeEquipoFicha.create({
      data: { workspaceId: ctx.workspaceId, membershipId: m.id, userId, jornadaMinutos: JORNADA_POR_OMISION_MIN },
    });
  } catch (e) {
    // Ya tenía ficha: se va a ella igual.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  revalidatePath("/equipo");
  redirect(rutaFicha(userId));
}

export async function guardarFichaAction(fd: FormData): Promise<void> {
  const ctx = await ctxOFuera();
  const userId = leerUserId(fd);
  const ruta = rutaFicha(userId);
  const ficha = await fichaDelEspacio(ctx.workspaceId, userId);
  if (!ficha) volverConError("/equipo", "Esa ficha no existe.");
  const r = leerFormularioFicha(fd);
  if (!r.ok) volverConError(ruta, r.error);
  const { franjas, ...datos } = r.datos;
  await prisma.$transaction([
    prisma.fotofficeEquipoFicha.update({ where: { id: ficha.id }, data: datos }),
    prisma.fotofficeEquipoFranja.deleteMany({ where: { fichaId: ficha.id } }),
    prisma.fotofficeEquipoFranja.createMany({ data: franjas.map((f) => ({ ...f, fichaId: ficha.id })) }),
  ]);
  revalidatePath(ruta);
  revalidatePath("/equipo");
  redirect(`${ruta}?ok=1`);
}

/** El valor de la jornada no se edita: se agrega uno nuevo con la fecha desde la que rige. */
export async function agregarValorJornadaAction(fd: FormData): Promise<void> {
  const ctx = await ctxOFuera();
  const userId = leerUserId(fd);
  const ruta = rutaFicha(userId);
  const ficha = await fichaDelEspacio(ctx.workspaceId, userId);
  if (!ficha) volverConError("/equipo", "Esa ficha no existe.");
  const desde = String(fd.get("desde") ?? "").trim();
  if (!esFechaValida(desde)) volverConError(ruta, "Elegí desde qué fecha rige el valor.");
  const minor = parseArsToMinor(String(fd.get("valorArs") ?? ""));
  if (minor === null || minor <= 0) volverConError(ruta, "Escribí el valor de la jornada en pesos.");
  try {
    await prisma.fotofficeEquipoValorJornada.create({
      data: { fichaId: ficha.id, desde, valorArs: minorToDecimalString(minor), createdByUserId: ctx.userId },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      volverConError(ruta, "Ya hay un valor que rige desde esa fecha.");
    }
    throw e;
  }
  revalidatePath(ruta);
  redirect(`${ruta}?ok=1`);
}

export async function guardarCambioAction(fd: FormData): Promise<void> {
  const ctx = await ctxOFuera();
  const userId = leerUserId(fd);
  const ruta = rutaFicha(userId);
  const ficha = await fichaDelEspacio(ctx.workspaceId, userId);
  if (!ficha) volverConError("/equipo", "Esa ficha no existe.");
  const fecha = String(fd.get("fecha") ?? "").trim();
  if (!esFechaValida(fecha)) volverConError(ruta, "Elegí la fecha del cambio.");
  const tipo = fd.get("tipo") === "TRABAJA" ? "TRABAJA" : "NO_TRABAJA";
  const motivoTexto = String(fd.get("motivo") ?? "OTRO");
  const motivo: MotivoCambio = motivoTexto in MOTIVOS_CAMBIO ? (motivoTexto as MotivoCambio) : "OTRO";
  let inicioMin: number | null = null;
  let finMin: number | null = null;
  if (tipo === "TRABAJA") {
    inicioMin = leerHora(String(fd.get("inicio") ?? ""));
    finMin = leerHora(String(fd.get("fin") ?? ""));
    if (inicioMin === null || finMin === null || finMin <= inicioMin) {
      volverConError(ruta, "Si ese día trabaja, poné la hora de entrada y una de salida posterior.");
    }
  }
  const nota = String(fd.get("nota") ?? "").trim().slice(0, 300) || null;
  const datos = { tipo, motivo, inicioMin, finMin, nota, createdByUserId: ctx.userId };
  await prisma.fotofficeEquipoCambio.upsert({
    where: { fichaId_fecha: { fichaId: ficha.id, fecha } },
    create: { fichaId: ficha.id, fecha, ...datos },
    update: datos,
  });
  revalidatePath(ruta);
  revalidatePath("/equipo");
  redirect(`${ruta}?ok=1`);
}

export async function borrarCambioAction(fd: FormData): Promise<void> {
  const ctx = await ctxOFuera();
  const userId = leerUserId(fd);
  const ruta = rutaFicha(userId);
  const ficha = await fichaDelEspacio(ctx.workspaceId, userId);
  if (!ficha) volverConError("/equipo", "Esa ficha no existe.");
  const id = String(fd.get("cambioId") ?? "");
  await prisma.fotofficeEquipoCambio.deleteMany({ where: { id, fichaId: ficha.id } });
  revalidatePath(ruta);
  revalidatePath("/equipo");
  redirect(`${ruta}?ok=1`);
}

/** Corrección a mano de la entrada o la salida de un día. Queda registrada: no se borra. */
export async function corregirJornadaAction(fd: FormData): Promise<void> {
  const ctx = await ctxOFuera();
  const userId = leerUserId(fd);
  const ruta = rutaFicha(userId);
  const ficha = await fichaDelEspacio(ctx.workspaceId, userId);
  if (!ficha) volverConError("/equipo", "Esa ficha no existe.");
  const fecha = String(fd.get("fecha") ?? "").trim();
  if (!esFechaValida(fecha)) volverConError(ruta, "La fecha no se entiende.");
  const entradaTexto = String(fd.get("entrada") ?? "").trim();
  const salidaTexto = String(fd.get("salida") ?? "").trim();
  const entradaMin = entradaTexto ? leerHora(entradaTexto) : null;
  const salidaMin = salidaTexto ? leerHora(salidaTexto) : null;
  if ((entradaTexto && entradaMin === null) || (salidaTexto && salidaMin === null)) volverConError(ruta, "Alguna hora no se entiende.");
  if (entradaMin === null && salidaMin === null) volverConError(ruta, "Poné la hora de entrada, la de salida o las dos.");
  if (entradaMin !== null && salidaMin !== null && salidaMin <= entradaMin) volverConError(ruta, "La salida tiene que ser después de la entrada.");
  const nota = String(fd.get("nota") ?? "").trim().slice(0, 300);
  if (!nota) volverConError(ruta, "Explicá por qué se corrige: queda registrado.");
  await prisma.fotofficeEquipoCorreccion.create({
    data: { workspaceId: ctx.workspaceId, userId, fecha, entradaMin, salidaMin, nota, createdByUserId: ctx.userId },
  });
  revalidatePath(ruta);
  revalidatePath("/equipo");
  redirect(`${ruta}?ok=1`);
}

const MENSAJES = "/equipo/mensajes";

export async function guardarPiezaAction(fd: FormData): Promise<void> {
  const ctx = await ctxOFuera();
  const id = String(fd.get("piezaId") ?? "");
  const v = validarTextoPieza(String(fd.get("texto") ?? ""));
  if (!v.ok) volverConError(MENSAJES, v.error);
  await prisma.fotofficeEquipoPieza.updateMany({
    where: { id, workspaceId: ctx.workspaceId },
    data: { texto: v.texto, activa: fd.get("activa") === "on" },
  });
  revalidatePath(MENSAJES);
  redirect(`${MENSAJES}?ok=1#pieza-${id}`);
}

export async function crearPiezaAction(fd: FormData): Promise<void> {
  const ctx = await ctxOFuera();
  const momento = String(fd.get("momento") ?? "");
  const parte = String(fd.get("parte") ?? "");
  const ocasionTexto = String(fd.get("ocasion") ?? "");
  if (!(momento === "CUALQUIERA" || (MOMENTOS as readonly string[]).includes(momento))) volverConError(MENSAJES, "Elegí el momento.");
  if (!(PARTES as readonly string[]).includes(parte)) volverConError(MENSAJES, "Elegí la parte del mensaje.");
  const ocasion = (OCASIONES as readonly string[]).includes(ocasionTexto) ? ocasionTexto : null;
  const v = validarTextoPieza(String(fd.get("texto") ?? ""));
  if (!v.ok) volverConError(MENSAJES, v.error);
  await prisma.fotofficeEquipoPieza.create({
    data: { workspaceId: ctx.workspaceId, momento, parte, ocasion, texto: v.texto },
  });
  revalidatePath(MENSAJES);
  redirect(`${MENSAJES}?ok=1`);
}

/** Carga el repertorio inicial (las piezas que falten; no pisa las editadas). */
export async function cargarRepertorioAction(): Promise<void> {
  const ctx = await ctxOFuera();
  await asegurarRepertorio(ctx.workspaceId);
  revalidatePath(MENSAJES);
  redirect(`${MENSAJES}?ok=1`);
}

export async function guardarAjustesAction(fd: FormData): Promise<void> {
  const ctx = await ctxOFuera();
  const ruta = "/equipo/configuracion";
  const tol = Number(String(fd.get("toleranciaMinutos") ?? "").trim());
  if (!Number.isInteger(tol) || tol < 0 || tol > 60) volverConError(ruta, "La tolerancia tiene que ser un número entero de 0 a 60 minutos.");
  await prisma.fotofficeEquipoAjustes.upsert({
    where: { workspaceId: ctx.workspaceId },
    create: { workspaceId: ctx.workspaceId, toleranciaMinutos: tol },
    update: { toleranciaMinutos: tol },
  });
  revalidatePath(ruta);
  revalidatePath("/equipo");
  redirect(`${ruta}?ok=1`);
}
