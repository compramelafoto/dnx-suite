import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import {
  leerMateriales,
  mesesPagados,
  recorridoBox,
  type CajaConMateriales,
  type CargoParaBox,
  type RecorridoBox,
} from "./secuencia";

/**
 * BOX mensual — la parte que toca la base. La regla vive en `secuencia.ts`.
 */

/**
 * Si el workspace usa la BOX mensual: alguna categoría con caja o alguna caja cargada. Decide si
 * la pantalla aparece en el menú, para no ensuciar el panel de las instituciones que no la usan.
 *
 * **Nunca lanza**: la consulta corre en el menú de todas las pantallas, y si la tabla todavía no
 * existiera en la base (migración sin aplicar) el panel entero no puede caerse por esto.
 */
export async function workspaceUsaBoxMensual(workspaceId: string): Promise<boolean> {
  try {
    const [categoria, caja] = await Promise.all([
      prisma.memberCategory.findFirst({ where: { workspaceId, includesMonthlyBox: true }, select: { id: true } }),
      prisma.fotofficeBox.findFirst({ where: { workspaceId }, select: { id: true } }),
    ]);
    return categoria !== null || caja !== null;
  } catch (error) {
    console.error("[fotoffice][box] no se pudo saber si el workspace usa la BOX mensual", {
      workspaceId,
      detalle: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export type CajaFila = CajaConMateriales & {
  description: string | null;
  isActive: boolean;
  enviadas: number;
};

/** El catálogo de cajas, por N°. */
export async function listarCajas(workspaceId: string): Promise<CajaFila[]> {
  const filas = await prisma.fotofficeBox.findMany({
    where: { workspaceId },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      name: true,
      description: true,
      materials: true,
      isActive: true,
      _count: { select: { shipments: true } },
    },
  });
  return filas.map((f) => ({
    id: f.id,
    number: f.number,
    name: f.name,
    description: f.description,
    materials: leerMateriales(f.materials),
    isActive: f.isActive,
    enviadas: f._count.shipments,
  }));
}

/** Los cargos que pueden ser un mes pagado, con lo que `esMesPagado` necesita. */
const CARGO_SELECT = {
  concept: true,
  period: true,
  amountArs: true,
  balanceArs: true,
  allocations: { select: { payment: { select: { status: true, paidAt: true, createdAt: true } } } },
} as const;

type CargoCrudo = {
  concept: CargoParaBox["concept"];
  period: string;
  amountArs: { toString(): string };
  balanceArs: { toString(): string };
  allocations: { payment: { status: string; paidAt: Date | null; createdAt: Date } }[];
};

function aCargoParaBox(c: CargoCrudo): CargoParaBox {
  // El último pago acreditado que se le imputó: es el que lo terminó de cancelar.
  let acreditadoEn: Date | null = null;
  for (const a of c.allocations) {
    if (a.payment.status !== "ACREDITADO") continue;
    const cuando = a.payment.paidAt ?? a.payment.createdAt;
    if (!acreditadoEn || cuando > acreditadoEn) acreditadoEn = cuando;
  }
  return {
    concept: c.concept,
    period: c.period,
    amountMinor: decimalArsToMinor(c.amountArs),
    balanceMinor: decimalArsToMinor(c.balanceArs),
    acreditadoEn,
  };
}

export type SocioConBox = {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  recorrido: RecorridoBox;
};

/**
 * El recorrido de cada persona socia ACTIVA de una categoría con caja. Una persona suspendida o
 * dada de baja no aparece para enviar: su historial sigue en «Enviadas» y en su ficha.
 */
export async function cargarRecorridos(workspaceId: string, now: Date = new Date()): Promise<{
  socios: SocioConBox[];
  cajas: CajaFila[];
}> {
  const [cajas, socios] = await Promise.all([
    listarCajas(workspaceId),
    prisma.member.findMany({
      where: { workspaceId, status: "ACTIVE", category: { includesMonthlyBox: true } },
      select: {
        id: true,
        memberNumber: true,
        firstName: true,
        lastName: true,
        address: true,
        city: true,
        province: true,
        postalCode: true,
        boxShipments: { select: { boxId: true } },
        charges: { where: { concept: { in: ["INGRESO", "MENSUAL", "OTRO"] } }, select: CARGO_SELECT },
      },
    }),
  ]);

  return {
    cajas,
    socios: socios.map((s) => ({
      id: s.id,
      memberNumber: s.memberNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      address: s.address,
      city: s.city,
      province: s.province,
      postalCode: s.postalCode,
      recorrido: recorridoBox({
        meses: mesesPagados(s.charges.map(aCargoParaBox), now),
        cajasEnviadas: s.boxShipments.map((e) => e.boxId),
        cajas,
      }),
    })),
  };
}

/** El recorrido de una sola persona (ficha y «Marcar enviada»). `null` si no existe en el workspace. */
export async function cargarRecorridoDeSocio(
  workspaceId: string,
  memberId: string,
  now: Date = new Date(),
): Promise<{
  socio: {
    id: string;
    status: string;
    address: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    conBox: boolean;
  };
  recorrido: RecorridoBox;
  envios: EnvioFila[];
} | null> {
  const socio = await prisma.member.findFirst({
    where: { id: memberId, workspaceId },
    select: {
      id: true,
      status: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
      category: { select: { includesMonthlyBox: true } },
      charges: { where: { concept: { in: ["INGRESO", "MENSUAL", "OTRO"] } }, select: CARGO_SELECT },
    },
  });
  if (!socio) return null;
  const [cajas, envios] = await Promise.all([listarCajas(workspaceId), listarEnvios(workspaceId, { memberId })]);
  return {
    socio: {
      id: socio.id,
      status: socio.status,
      address: socio.address,
      city: socio.city,
      province: socio.province,
      postalCode: socio.postalCode,
      conBox: socio.category?.includesMonthlyBox ?? false,
    },
    recorrido: recorridoBox({
      meses: mesesPagados(socio.charges.map(aCargoParaBox), now),
      cajasEnviadas: envios.map((e) => e.boxId),
      cajas,
    }),
    envios,
  };
}

export type EnvioFila = {
  id: string;
  boxId: string;
  boxNumber: number;
  boxName: string;
  status: "ENVIADA" | "ENTREGADA";
  address: string;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  carrier: string | null;
  trackingCode: string | null;
  notes: string | null;
  shippedAt: Date;
  deliveredAt: Date | null;
  member: { id: string; memberNumber: string; firstName: string; lastName: string };
};

/** El historial de envíos, del más nuevo al más viejo. */
export async function listarEnvios(
  workspaceId: string,
  filtro: { memberId?: string; take?: number } = {},
): Promise<EnvioFila[]> {
  const filas = await prisma.fotofficeBoxShipment.findMany({
    where: { workspaceId, ...(filtro.memberId ? { memberId: filtro.memberId } : {}) },
    orderBy: [{ shippedAt: "desc" }, { boxNumber: "desc" }],
    take: filtro.take,
    select: {
      id: true,
      boxId: true,
      boxNumber: true,
      status: true,
      address: true,
      city: true,
      province: true,
      postalCode: true,
      carrier: true,
      trackingCode: true,
      notes: true,
      shippedAt: true,
      deliveredAt: true,
      box: { select: { name: true } },
      member: { select: { id: true, memberNumber: true, firstName: true, lastName: true } },
    },
  });
  return filas.map(({ box, ...f }) => ({ ...f, boxName: box.name }));
}
