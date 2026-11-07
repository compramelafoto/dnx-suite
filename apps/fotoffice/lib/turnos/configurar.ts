import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { puedeConfigurarAgenda, type CtxAgenda } from "@/lib/agenda/acceso";
import { MENSAJES_TURNOS, esModalidad, type AjustesTurnos } from "./constantes";
import { validarAjustesTurnos, validarConfigTurnoTipo, type ConfigTurnoTipo } from "./configuracion";
import { horaDeMinutos } from "./franjas";

/** Configuración → Agenda → Tipos de cita → Turnos online. Sólo `configurar` (dueño o administrador). */

export type Resultado = { ok: true } | { ok: false; error: string };

export type ConfigTipoEnPantalla = {
  isBookable: boolean;
  publicDescription: string;
  durationMinutes: number | null;
  modality: string;
  address: string;
  franjas: { weekday: number; inicio: string; fin: string }[];
};

export async function leerConfigTurnoTipo(workspaceId: string, tipoId: string): Promise<(ConfigTipoEnPantalla & { name: string }) | null> {
  const t = await prisma.fotofficeCitaTipo.findFirst({
    where: { id: tipoId, workspaceId },
    select: {
      name: true, isBookable: true, publicDescription: true, durationMinutes: true, modality: true, address: true,
      franjas: { select: { weekday: true, startMinute: true, endMinute: true }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] },
    },
  });
  if (!t) return null;
  return {
    name: t.name,
    isBookable: t.isBookable,
    publicDescription: t.publicDescription ?? "",
    durationMinutes: t.durationMinutes ?? null,
    modality: esModalidad(t.modality) ? t.modality : "",
    address: t.address ?? "",
    franjas: t.franjas.map((f) => ({ weekday: f.weekday, inicio: horaDeMinutos(f.startMinute), fin: horaDeMinutos(f.endMinute) })),
  };
}

export async function guardarConfigTurnoTipo(ctx: CtxAgenda, tipoId: unknown, datos: unknown): Promise<Resultado> {
  if (!puedeConfigurarAgenda(ctx)) return { ok: false, error: MENSAJES_TURNOS.sinPermiso };
  if (typeof tipoId !== "string" || tipoId.length === 0 || tipoId.length > 64) return { ok: false, error: MENSAJES_TURNOS.datosInvalidos };
  const v = validarConfigTurnoTipo(datos);
  if (!v.ok) return v;
  const c: ConfigTurnoTipo = v.valor;
  const { workspaceId } = ctx;
  try {
    const tipo = await prisma.fotofficeCitaTipo.findFirst({ where: { id: tipoId, workspaceId }, select: { id: true } });
    if (!tipo) return { ok: false, error: MENSAJES_TURNOS.tipoNoExiste };
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.fotofficeCitaTipo.updateMany({
        where: { id: tipoId, workspaceId },
        data: { isBookable: c.isBookable, publicDescription: c.publicDescription, durationMinutes: c.durationMinutes, modality: c.modality, address: c.address },
      });
      await tx.fotofficeCitaTipoFranja.deleteMany({ where: { typeId: tipoId, workspaceId } });
      if (c.franjas.length > 0) {
        await tx.fotofficeCitaTipoFranja.createMany({ data: c.franjas.map((f) => ({ ...f, workspaceId, typeId: tipoId })) });
      }
    });
    return { ok: true };
  } catch {
    return { ok: false, error: MENSAJES_TURNOS.guardar };
  }
}

export async function guardarAjustesTurnos(ctx: CtxAgenda, datos: unknown): Promise<Resultado> {
  if (!puedeConfigurarAgenda(ctx)) return { ok: false, error: MENSAJES_TURNOS.sinPermiso };
  const v = validarAjustesTurnos(datos);
  if (!v.ok) return v;
  const a: AjustesTurnos = v.valor;
  try {
    await prisma.fotofficeTurnosAjustes.upsert({ where: { workspaceId: ctx.workspaceId }, create: { workspaceId: ctx.workspaceId, ...a }, update: a });
    return { ok: true };
  } catch {
    return { ok: false, error: MENSAJES_TURNOS.guardar };
  }
}
