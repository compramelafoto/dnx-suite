import {
  getClickatonJuryConnectionInfo,
  getClickatonJuryPrisma,
} from "@repo/db/clickaton-jury-client";

/**
 * Cómo está la conexión entre FotoRank y Clickatón, vista desde FotoRank.
 *
 * El portal del jurado vive en FotoRank, pero las obras y los votos de una
 * maratón viven en la base de Clickatón. La conexión son tres variables de
 * Vercel en FotoRank (y una cuarta en Clickatón) que nadie podía ver desde
 * ninguna pantalla: si faltaba una, el síntoma era un jurado sin fotos.
 *
 * Sólo lee. Nunca devuelve una cadena de conexión ni un secreto: dice si están
 * y, de la base, el host enmascarado.
 */

export type MaratonConJurado = {
  contestId: string;
  titulo: string;
  obrasCongeladas: number;
  congeladoEl: Date | null;
  jurados: number;
  evaluacionesEnviadas: number;
};

export type EstadoDeLaConexion = {
  base: { configurada: boolean; host: string | null; motivo: string | null };
  secretoDeFotos: boolean;
  direccionPublica: string | null;
  /** null si no se pudo consultar (sin configurar o sin respuesta). */
  enVivo: { ok: true; maratones: MaratonConJurado[] } | { ok: false; error: string } | null;
};

export async function estadoDeLaConexionConClickaton(): Promise<EstadoDeLaConexion> {
  const info = getClickatonJuryConnectionInfo();
  const direccionPublica = process.env.CLICKATON_PUBLIC_BASE_URL?.trim() || null;
  const secretoDeFotos = Boolean(process.env.CLICKATON_JURY_MEDIA_SECRET?.trim());

  const base = {
    configurada: info.configured,
    host: info.hostMasked,
    motivo: info.reason ?? null,
  };

  const cliente = getClickatonJuryPrisma();
  if (!cliente) return { base, secretoDeFotos, direccionPublica, enVivo: null };

  try {
    const lotes = await cliente.fotorankAdmissionBatch.findMany({
      where: { status: "FROZEN" },
      orderBy: { frozenAt: "desc" },
      take: 20,
      select: {
        contestId: true,
        frozenEntries: true,
        frozenAt: true,
        contest: { select: { title: true } },
      },
    });
    const ids = lotes.map((l) => l.contestId);

    const [asignaciones, enviadas] = await Promise.all([
      cliente.fotorankJudgeAssignment.findMany({
        where: { contestId: { in: ids } },
        select: { contestId: true, judgeAccountId: true },
      }),
      cliente.fotorankJuryEvaluation.groupBy({
        by: ["contestId"],
        where: { contestId: { in: ids }, status: "SUBMITTED" },
        _count: { _all: true },
      }),
    ]);

    const juradosPorConcurso = new Map<string, Set<string>>();
    for (const a of asignaciones) {
      const set = juradosPorConcurso.get(a.contestId) ?? new Set<string>();
      set.add(a.judgeAccountId);
      juradosPorConcurso.set(a.contestId, set);
    }
    const enviadasPorConcurso = new Map(enviadas.map((e) => [e.contestId, e._count._all]));

    return {
      base,
      secretoDeFotos,
      direccionPublica,
      enVivo: {
        ok: true,
        maratones: lotes.map((l) => ({
          contestId: l.contestId,
          titulo: l.contest.title,
          obrasCongeladas: l.frozenEntries,
          congeladoEl: l.frozenAt,
          jurados: juradosPorConcurso.get(l.contestId)?.size ?? 0,
          evaluacionesEnviadas: enviadasPorConcurso.get(l.contestId) ?? 0,
        })),
      },
    };
  } catch (err: unknown) {
    console.error("FOTORANK CLICKATON CONNECTION CHECK ERROR", err);
    return {
      base,
      secretoDeFotos,
      direccionPublica,
      enVivo: { ok: false, error: "La base de Clickatón no respondió." },
    };
  }
}
