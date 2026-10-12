import { prisma } from "@/lib/prisma";
import { argentinaDay } from "./dia-argentino";
import { computeSchoolSetupProgress, type ProgresoEscolar } from "./escolar/progreso";
import type { Campania } from "./outreach";
import { leerOutreachPanel } from "./outreach";
import { saludoPorHora } from "./saludo";

export type DatosSegmento = {
  nombre: string | null;
  /** Días desde el alta. */
  registradoHace: number;
  tieneAlbum: boolean;
  vendio: boolean;
  tuvoEscolar: boolean;
  progreso: ProgresoEscolar | null;
  outreach: Array<{ campaign: string; status: string; updatedAt: Date }>;
};
export type Globito = {
  campaign: Campania;
  texto: string;
  botones: Array<{ label: string; mensaje: string | null; accion: "CLICKED" | "DISMISSED" | "DECLINED" }>;
};

const DIA_MS = 24 * 60 * 60 * 1000;
const DECLINED_DIAS = 90;
const DISMISSED_DIAS = 7;

function primerNombre(nombre: string | null): string {
  return nombre?.trim().split(/\s+/)[0] ?? "";
}

function suprimida(c: Campania, d: DatosSegmento, now: Date, soloDeclined = false): boolean {
  for (const o of d.outreach) {
    if (o.campaign !== c) continue;
    const edad = now.getTime() - o.updatedAt.getTime();
    if (o.status === "DECLINED" && edad < DECLINED_DIAS * DIA_MS) return true;
    if (soloDeclined) continue; // forzada: sólo «No, gracias» la frena
    if (o.status === "DISMISSED" && edad < DISMISSED_DIAS * DIA_MS) return true;
    if (o.status === "CLICKED") {
      if (c !== "escolar_en_curso") return true;
      if (argentinaDay(o.updatedAt) === argentinaDay(now)) return true; // vuelve al día siguiente
    }
  }
  return false;
}

function aplica(c: Campania, d: DatosSegmento): boolean {
  switch (c) {
    case "escolar_en_curso": {
      // Sólo insiste si lo que sigue es un paso obligatorio pendiente (los opcionales no molestan).
      const sig = d.progreso?.siguiente;
      return !!d.progreso && d.progreso.albumId != null && !!sig && !sig.opcional && sig.estado === "pendiente";
    }
    case "nuevo":
      return d.registradoHace <= 14 && !d.tieneAlbum;
    case "sin_ventas":
      return d.tieneAlbum && !d.vendio;
    case "sin_escolar":
      return d.vendio && !d.tuvoEscolar;
  }
}

const PRIORIDAD: Campania[] = ["escolar_en_curso", "nuevo", "sin_ventas", "sin_escolar"];

/** Con `forzar` se muestra esa campaña si su condición se cumple, aunque esté CLICKED/DISMISSED; nunca si fue DECLINED (90 días). */
export function elegirCampania(d: DatosSegmento, now: Date, opts: { forzar?: Campania } = {}): Globito | null {
  const campaign = opts.forzar
    ? aplica(opts.forzar, d) && !suprimida(opts.forzar, d, now, true)
      ? opts.forzar
      : undefined
    : PRIORIDAD.find((c) => aplica(c, d) && !suprimida(c, d, now));
  if (!campaign) return null;
  const s = saludoPorHora(now);
  const n = primerNombre(d.nombre);
  const conNombre = n ? `${s}, ${n}` : s;
  const ahoraNo = { label: "Ahora no", mensaje: null, accion: "DISMISSED" as const };
  const noGracias = { label: "No, gracias", mensaje: null, accion: "DECLINED" as const };
  switch (campaign) {
    case "escolar_en_curso": {
      const p = d.progreso!;
      const texto = p.aMedias
        ? `${conNombre}. Tu álbum **${p.albumTitulo}** está marcado como escolar pero no tiene escuela, así que queda a medias. ¿Lo arreglamos?`
        : `${conNombre}. Tu álbum escolar **${p.albumTitulo}** va por el paso ${p.siguiente!.n} de 11: ${p.siguiente!.titulo.toLowerCase()}. ¿Seguimos?`;
      return {
        campaign,
        texto,
        botones: [
          { label: p.aMedias ? "Arreglemos" : "Seguimos", mensaje: "Quiero seguir con mi álbum escolar", accion: "CLICKED" },
          ahoraNo,
          noGracias,
        ],
      };
    }
    case "nuevo":
      return {
        campaign,
        texto: `¡${conNombre}! Soy DNX Bot. ¿Te ayudo a armar tu primer álbum? Son unos minutos.`,
        botones: [{ label: "Sí, ayudame", mensaje: "Quiero armar mi primer álbum", accion: "CLICKED" }, ahoraNo],
      };
    case "sin_ventas":
      return {
        campaign,
        texto: `${conNombre}. Vi que todavía no vendiste. ¿Revisamos juntos qué le falta a tu álbum para vender?`,
        botones: [{ label: "Revisemos", mensaje: "¿Qué le falta a mi álbum para vender?", accion: "CLICKED" }, ahoraNo],
      };
    case "sin_escolar":
      return {
        campaign,
        texto: `¡${conNombre}! ¿Te dedicás a la fotografía escolar? Si querés, te enseño a configurar todo para automatizarlo: preventa, cursos, plantillas y entrega.`,
        botones: [
          { label: "Sí, quiero aprender", mensaje: "Quiero aprender a vender fotografía escolar", accion: "CLICKED" },
          { label: "Ya lo hago", mensaje: "Ya hago fotografía escolar, ¿cómo me ayudás?", accion: "CLICKED" },
          noGracias,
        ],
      };
  }
}

/**
 * Datos del fotógrafo para elegir el globito. El progreso escolar sólo mira álbumes escolares
 * creados en los últimos 120 días (`soloRecientes`): uno viejo sin terminar no insiste para siempre.
 */
export async function cargarDatosSegmento(userId: number): Promise<DatosSegmento> {
  const now = new Date();
  const albumes = { userId, deletedAt: null };
  const [user, albumCount, orden, escolar, outreach] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, createdAt: true } }),
    prisma.album.count({ where: albumes }),
    prisma.order.findFirst({
      where: { status: "PAID", isTest: false, totalCents: { gt: 0 }, album: { userId } },
      select: { id: true },
    }),
    // Igual que TUVO_ESCOLAR en outreach-email.ts: los álbumes de prueba no cuentan.
    prisma.album.findFirst({
      where: { ...albumes, isTest: false, OR: [{ schoolId: { not: null } }, { mode: "SCHOOL" }] },
      select: { id: true },
    }),
    leerOutreachPanel(userId),
  ]);
  const tuvoEscolar = !!escolar;
  return {
    nombre: user?.name ?? null,
    registradoHace: user ? Math.max(0, Math.floor((now.getTime() - user.createdAt.getTime()) / DIA_MS)) : 0,
    tieneAlbum: albumCount > 0,
    vendio: !!orden,
    tuvoEscolar,
    progreso: tuvoEscolar ? await computeSchoolSetupProgress(userId, undefined, now, { soloRecientes: true }) : null,
    outreach,
  };
}
