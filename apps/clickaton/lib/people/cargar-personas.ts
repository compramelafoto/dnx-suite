import "server-only";

import { prisma } from "@/lib/admin/db";
import { cargarResultadosDeEdicion } from "@/lib/edition-results/cargar-resultados";
import { claveDeLocalidad } from "@/lib/localities/clave";

import {
  armarPersonas,
  type InscripcionPlana,
  type LocalidadConocida,
  type NotaDeObra,
  type Persona,
} from "./armar-personas";

/** Estados en los que la foto llegó de verdad al servidor. */
const FOTO_SUBIDA = new Set([
  "UPLOADED",
  "PROCESSING",
  "READY_FOR_REVIEW",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "REJECTED",
]);

export type LocalidadEnRevision = {
  clave: string;
  ciudad: string;
  provincia: string | null;
  estado: string;
  origen: string;
  lat: number | null;
  lng: number | null;
  candidatos: { ciudad: string; provincia: string; departamento: string | null }[];
  personas: number;
};

/** Hoy en Argentina, como YYYY-MM-DD: el servidor corre en UTC. */
export function hoyEnArgentina(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(ahora);
}

/**
 * Lee la tabla de localidades, o nada si la migración todavía no se aplicó:
 * Personas tiene que funcionar igual, sólo que sin mapa.
 */
async function leerLocalidades() {
  try {
    return await prisma.clickatonLocality.findMany();
  } catch (error) {
    console.warn("[clickaton] ClickatonLocality no disponible:", error);
    return null;
  }
}

export async function cargarPersonas(): Promise<{
  personas: Persona[];
  ediciones: { id: string; nombre: string }[];
  localidadesDisponibles: boolean;
  pendientesDeUbicar: number;
  enRevision: LocalidadEnRevision[];
}> {
  const [inscripciones, admitidas, referidos, encuestas, localidades, sesiones] = await Promise.all([
    prisma.clickatonRegistration.findMany({
      where: { status: { not: "DRAFT" } },
      select: {
        id: true,
        editionId: true,
        edition: { select: { name: true } },
        status: true,
        paymentStatus: true,
        createdAt: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        documentNumber: true,
        birthDate: true,
        city: true,
        province: true,
        country: true,
        instagramHandle: true,
        totalAmount: true,
        currency: true,
        promotionCodeSnapshot: true,
        isGift: true,
        visibleCode: true,
        socialPublicationConsent: true,
        userId: true,
        venue: { select: { name: true } },
        ticketType: { select: { name: true } },
        items: { select: { variantNameSnapshot: true, fulfillmentStatus: true } },
        _count: { select: { checkIns: true } },
        photoSubmissions: { select: { id: true, status: true } },
      },
    }),
    prisma.clickatonTechnicalAdmissionDecision.findMany({
      where: { eligible: true },
      select: { submissionId: true },
    }),
    prisma.clickatonReferralAttribution.groupBy({
      by: ["referrerUserId"],
      where: { status: { not: "REVOKED" } },
      _count: { _all: true },
    }),
    prisma.clickatonSurveyResponse.findMany({
      select: { userId: true, npsScore: true, submittedAt: true },
      orderBy: { submittedAt: "asc" },
    }),
    leerLocalidades(),
    prisma.fotorankJuryScoringSession.findMany({
      select: { admissionBatch: { select: { editionId: true } } },
    }),
  ]);

  // Las notas salen del mismo cálculo que la pantalla de Resultados.
  const edicionesJuzgadas = [
    ...new Set(sesiones.map((s) => s.admissionBatch.editionId).filter(Boolean)),
  ] as string[];
  const resultados = await Promise.all(edicionesJuzgadas.map((id) => cargarResultadosDeEdicion(id)));
  const notas: NotaDeObra[] = resultados.flatMap((r) =>
    r
      ? r.filas.flatMap((f) =>
          f.autor
            ? [
                {
                  registrationId: f.autor.registrationId,
                  nota: f.nota,
                  puesto: f.puesto,
                  premio: f.premio,
                  final: r.modo === "FINAL",
                },
              ]
            : [],
        )
      : [],
  );

  const admitida = new Set(admitidas.map((a) => a.submissionId));
  const planas: InscripcionPlana[] = inscripciones.map((i) => ({
    id: i.id,
    editionId: i.editionId,
    edicion: i.edition.name,
    status: i.status,
    paymentStatus: i.paymentStatus,
    createdAt: i.createdAt.toISOString(),
    firstName: i.firstName,
    lastName: i.lastName,
    email: i.email,
    phone: i.phone,
    documentNumber: i.documentNumber,
    // Se guarda como medianoche UTC del día que eligió: la fecha es la parte UTC.
    birthDate: i.birthDate ? i.birthDate.toISOString().slice(0, 10) : null,
    city: i.city,
    province: i.province,
    country: i.country,
    instagramHandle: i.instagramHandle,
    totalAmount: i.totalAmount,
    currency: i.currency,
    promotionCode: i.promotionCodeSnapshot,
    isGift: i.isGift,
    visibleCode: i.visibleCode,
    sede: i.venue?.name ?? null,
    entrada: i.ticketType.name,
    talle: i.items.find((it) => it.variantNameSnapshot)?.variantNameSnapshot ?? null,
    kitEntregado: i.items.some((it) => it.fulfillmentStatus === "DELIVERED"),
    acreditado: i._count.checkIns > 0,
    fotosSubidas: i.photoSubmissions.filter((s) => FOTO_SUBIDA.has(s.status)).length,
    fotosAdmitidas: i.photoSubmissions.filter((s) => admitida.has(s.id)).length,
    autorizaRedes: i.socialPublicationConsent,
    userId: i.userId,
  }));

  const mapaDeLocalidades = new Map<string, LocalidadConocida>(
    (localidades ?? []).map((l) => [
      l.clave,
      { ciudad: l.ciudad, provincia: l.provincia, lat: l.lat, lng: l.lng, estado: l.estado },
    ]),
  );

  const personas = armarPersonas({
    inscripciones: planas,
    notas,
    referidosPorUsuario: new Map(referidos.map((r) => [r.referrerUserId, r._count._all])),
    // La última respuesta de cada usuario pisa a las anteriores.
    npsPorUsuario: new Map(encuestas.map((e) => [e.userId, e.npsScore])),
    localidades: mapaDeLocalidades,
    hoy: hoyEnArgentina(),
  });

  // Ciudades escritas por alguien que todavía no tienen fila, y las que la
  // tienen pero no quedaron resueltas.
  const personasPorClave = new Map<string, number>();
  const clavesSinFila = new Set<string>();
  for (const p of personas) {
    const clave = p.localidad?.clave ?? claveDeLocalidad(p.ciudad, p.provincia);
    if (!clave) continue;
    personasPorClave.set(clave, (personasPorClave.get(clave) ?? 0) + 1);
    if (!mapaDeLocalidades.has(clave)) clavesSinFila.add(clave);
  }

  const enRevision: LocalidadEnRevision[] = (localidades ?? [])
    .filter((l) => l.estado !== "RESUELTA")
    .map((l) => ({
      clave: l.clave,
      ciudad: l.ciudad,
      provincia: l.provincia,
      estado: l.estado,
      origen: l.origen,
      lat: l.lat,
      lng: l.lng,
      candidatos: ((l.candidatos ?? []) as LocalidadEnRevision["candidatos"]).map((c) => ({
        ciudad: c.ciudad,
        provincia: c.provincia,
        departamento: c.departamento ?? null,
      })),
      personas: personasPorClave.get(l.clave) ?? 0,
    }))
    .sort((a, b) => b.personas - a.personas);

  const ediciones = [
    ...new Map(inscripciones.map((i) => [i.editionId, i.edition.name])).entries(),
  ].map(([id, nombre]) => ({ id, nombre }));

  return {
    personas,
    ediciones,
    localidadesDisponibles: localidades !== null,
    pendientesDeUbicar: clavesSinFila.size,
    enRevision,
  };
}
