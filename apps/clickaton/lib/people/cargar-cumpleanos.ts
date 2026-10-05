import "server-only";

import { prisma } from "@/lib/admin/db";
import { esEdicionDePrueba } from "./armar-personas";
import { hoyEnArgentina } from "./cargar-personas";
import { cumpleanosDeLaSemana, type CumpleDeLaSemana } from "./cumpleanos-semana";

/** Los mismos estados con los que Personas cuenta a alguien como participante. */
const ESTADOS_QUE_CUENTAN = ["CONFIRMED", "DISQUALIFIED", "REFUND_REQUESTED"] as const;

export type CumpleanosDelPanel = {
  cumples: CumpleDeLaSemana[];
  /** Personas que participaron, para mostrar cuántas cargaron la fecha. */
  personas: number;
  conFecha: number;
};

/**
 * Cumpleaños de esta semana entre quienes participaron de Clickatón.
 *
 * Liviano a propósito: el inicio del panel no puede esperar el cálculo completo de Personas
 * (notas, localidades, encuestas). La persona es el email, igual que en Personas.
 */
export async function cargarCumpleanosDeLaSemana(): Promise<CumpleanosDelPanel> {
  const filas = await prisma.clickatonRegistration.findMany({
    where: { isOpsTest: false, status: { in: [...ESTADOS_QUE_CUENTAN] } },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      instagramHandle: true,
      createdAt: true,
      edition: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // La inscripción más reciente pone el nombre; la fecha y el Instagram, la última que los tenga.
  const porEmail = new Map<
    string,
    { nombre: string; fechaNacimiento: string | null; instagram: string | null }
  >();
  for (const f of filas) {
    if (esEdicionDePrueba(f.edition.name)) continue;
    const clave = f.email.trim().toLowerCase();
    if (!clave) continue;
    const previa = porEmail.get(clave);
    porEmail.set(clave, {
      nombre: `${f.firstName} ${f.lastName}`.trim(),
      // Se guarda como medianoche UTC del día elegido: la fecha es la parte UTC.
      fechaNacimiento: f.birthDate ? f.birthDate.toISOString().slice(0, 10) : (previa?.fechaNacimiento ?? null),
      instagram: f.instagramHandle?.trim() || previa?.instagram || null,
    });
  }

  const personas = [...porEmail].map(([clave, p]) => ({ clave, ...p }));
  return {
    cumples: cumpleanosDeLaSemana(personas, hoyEnArgentina()),
    personas: personas.length,
    conFecha: personas.filter((p) => p.fechaNacimiento).length,
  };
}
