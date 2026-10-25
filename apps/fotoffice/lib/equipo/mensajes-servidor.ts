import "server-only";
import { prisma, Prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { EQUIPO_MODULE_KEY } from "./constantes";
import { saludaCumpleHoy } from "./cumpleanos";
import { diaYMinuto } from "./fechas";
import { nombreParaSaludo } from "./ficha";
import { horarioDelDia } from "./horario";
import {
  armarMensaje,
  avisoDeSalidaVisible,
  DIAS_SIN_REPETIR,
  ocasionesDelDia,
  type Momento,
  type MomentoPieza,
  type Ocasion,
  type Parte,
  type Pieza,
} from "./mensajes";
import { REPERTORIO_INICIAL } from "./repertorio";
import { fichaActivaDe, fichaHorario, ventasDelDia } from "./repositorio";

/**
 * Los mensajes a las empleadas, del lado del servidor.
 *
 * Regla de oro: nada de esto puede mostrarle un error a una empleada ni trabar la caja. Cada
 * función atrapa sus errores y devuelve null: si algo falla, el saludo simplemente no aparece.
 */

/** Copia a la base las piezas del repertorio inicial que falten (no pisa las que editó el dueño). */
export async function asegurarRepertorio(workspaceId: string): Promise<void> {
  const conClave = await prisma.fotofficeEquipoPieza.count({ where: { workspaceId, clave: { not: null } } });
  if (conClave >= REPERTORIO_INICIAL.length) return;
  await prisma.fotofficeEquipoPieza.createMany({
    data: REPERTORIO_INICIAL.map((p) => ({
      workspaceId,
      clave: p.clave,
      momento: p.momento,
      parte: p.parte,
      ocasion: p.ocasion,
      texto: p.texto,
    })),
    skipDuplicates: true,
  });
}

export async function piezasDelEspacio(workspaceId: string): Promise<Pieza[]> {
  const rows = await prisma.fotofficeEquipoPieza.findMany({
    where: { workspaceId },
    orderBy: [{ momento: "asc" }, { parte: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    momento: r.momento as MomentoPieza,
    parte: r.parte as Parte,
    ocasion: (r.ocasion as Ocasion | null) ?? null,
    texto: r.texto,
    activa: r.activa,
  }));
}

/** Cuántos de los últimos mensajes se miran para no repetir piezas seguido. */
const RECIENTES = 6;

/**
 * El mensaje de ese momento para esa persona, o null si no corresponde (módulo apagado, sin
 * ficha activa, repertorio vacío) o si algo falló. Si ya se le armó uno hoy para ese momento,
 * devuelve el mismo.
 */
export async function mensajeDelMomento(p: {
  workspaceId: string;
  userId: number;
  momento: Momento;
  ahora?: Date;
}): Promise<{ texto: string } | null> {
  try {
    if (!(await isModuleEnabledForWorkspace(p.workspaceId, EQUIPO_MODULE_KEY))) return null;
    const ahora = p.ahora ?? new Date();
    const { fecha } = diaYMinuto(ahora);
    const clave = { workspaceId: p.workspaceId, userId: p.userId, fecha, momento: p.momento };

    const ya = await prisma.fotofficeEquipoMensaje.findUnique({
      where: { workspaceId_userId_fecha_momento: clave },
      select: { texto: true },
    });
    if (ya) return { texto: ya.texto };

    const datos = await fichaActivaDe(p.workspaceId, p.userId);
    if (!datos) return null;
    const { ficha } = datos;
    const horario = fichaHorario(ficha);
    const trabaja = (f: string) => horarioDelDia(horario, ficha.cambios, f).trabaja;

    const desde = new Date(ahora.getTime() - DIAS_SIN_REPETIR * 86_400_000);
    const [historial, cumpleYaSaludado, ventasHoy] = await Promise.all([
      prisma.fotofficeEquipoMensaje.findMany({
        where: { workspaceId: p.workspaceId, userId: p.userId, createdAt: { gte: desde } },
        select: { combinacion: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.fotofficeEquipoMensaje.count({
        where: { workspaceId: p.workspaceId, userId: p.userId, fecha, ocasion: { contains: "CUMPLEANOS" } },
      }),
      p.momento === "APERTURA" ? Promise.resolve(0) : ventasDelDia(p.workspaceId, p.userId, fecha),
    ]);

    // Está en la caja ahora mismo, así que hoy trabaja aunque su horario no lo diga.
    const cumple =
      cumpleYaSaludado === 0 &&
      saludaCumpleHoy({ fechaNacimiento: ficha.fechaNacimiento, hoy: fecha, trabaja, estaTrabajandoHoy: true });
    const { ocasiones, feriado } = ocasionesDelDia({ fecha, cumple, trabaja });

    await asegurarRepertorio(p.workspaceId);
    const piezas = await piezasDelEspacio(p.workspaceId);
    const armado = armarMensaje(piezas, {
      momento: p.momento,
      fecha,
      nombre: nombreParaSaludo({ apodo: ficha.apodo, name: datos.name, email: datos.email }),
      ventasHoy,
      ocasiones,
      feriado,
      usadas: historial.map((h) => h.combinacion),
      recientes: historial.slice(0, RECIENTES).flatMap((h) => h.combinacion.split("|")),
      semilla: `${p.userId}|${fecha}|${p.momento}`,
    });
    if (!armado) return null;

    try {
      await prisma.fotofficeEquipoMensaje.create({
        data: { ...clave, combinacion: armado.combinacion, texto: armado.texto, ocasion: armado.ocasion },
      });
    } catch (e) {
      // Dos pestañas a la vez: gana el primero y se muestra ése.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const otro = await prisma.fotofficeEquipoMensaje.findUnique({
          where: { workspaceId_userId_fecha_momento: clave },
          select: { texto: true },
        });
        return otro ? { texto: otro.texto } : null;
      }
      throw e;
    }
    return { texto: armado.texto };
  } catch (e) {
    console.error("[equipo] no se pudo armar el mensaje", e);
    return null;
  }
}

/**
 * Lo que necesita el aviso de salida para programarse en el navegador: el día y la hora de fin
 * de su horario de hoy. Null si no corresponde mostrarlo hoy (sin ficha, sin horario, sin un
 * turno abierto a su nombre, o ya lo cerró con la cruz).
 */
export async function programaDelAvisoDeSalida(p: {
  workspaceId: string;
  userId: number;
  ahora?: Date;
}): Promise<{ fecha: string; finMin: number } | null> {
  try {
    if (!(await isModuleEnabledForWorkspace(p.workspaceId, EQUIPO_MODULE_KEY))) return null;
    const ahora = p.ahora ?? new Date();
    const { fecha } = diaYMinuto(ahora);
    const datos = await fichaActivaDe(p.workspaceId, p.userId);
    if (!datos) return null;
    const hoy = horarioDelDia(fichaHorario(datos.ficha), datos.ficha.cambios, fecha);
    if (hoy.finMin === null) return null;
    const [turnoPropio, aviso] = await Promise.all([
      prisma.cashShift.count({ where: { workspaceId: p.workspaceId, status: "ABIERTO", openedByUserId: p.userId } }),
      prisma.fotofficeEquipoMensaje.findUnique({
        where: { workspaceId_userId_fecha_momento: { workspaceId: p.workspaceId, userId: p.userId, fecha, momento: "SALIDA" } },
        select: { cerradoAt: true },
      }),
    ]);
    if (turnoPropio === 0 || aviso?.cerradoAt) return null;
    return { fecha, finMin: hoy.finMin };
  } catch (e) {
    console.error("[equipo] no se pudo preparar el aviso de salida", e);
    return null;
  }
}

/** El texto del aviso de salida si ya es la hora; null si no corresponde. */
export async function avisoDeSalidaAhora(p: { workspaceId: string; userId: number; ahora?: Date }): Promise<string | null> {
  const ahora = p.ahora ?? new Date();
  const programa = await programaDelAvisoDeSalida({ ...p, ahora });
  if (!programa) return null;
  const visible = avisoDeSalidaVisible({
    ahoraMin: diaYMinuto(ahora).minuto,
    finMin: programa.finMin,
    tieneTurnoPropioAbierto: true,
    cerrado: false,
  });
  if (!visible) return null;
  const m = await mensajeDelMomento({ ...p, momento: "SALIDA", ahora });
  return m?.texto ?? null;
}

/** Cierra el aviso de salida de hoy: no vuelve a aparecer ese día. */
export async function cerrarAvisoDeSalida(p: { workspaceId: string; userId: number; ahora?: Date }): Promise<void> {
  try {
    const { fecha } = diaYMinuto(p.ahora ?? new Date());
    await prisma.fotofficeEquipoMensaje.updateMany({
      where: { workspaceId: p.workspaceId, userId: p.userId, fecha, momento: "SALIDA" },
      data: { cerradoAt: new Date() },
    });
  } catch (e) {
    console.error("[equipo] no se pudo cerrar el aviso de salida", e);
  }
}
