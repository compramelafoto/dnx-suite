/**
 * ETAPA 16A — Tiempo activo y ETA de jurado (§7.7 master rules).
 * Métrica ACTIVE_EVALUATION_TIME: no es evaluación de desempeño humano.
 * No hay ETA confiable antes de ~20–30 evaluaciones (minSamples default 25).
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";

function newId() {
  return `jah${randomBytes(12).toString("hex")}`;
}

const DEFAULT_IDLE_THRESHOLD_SECONDS = 75;

/**
 * Registra actividad del jurado (heartbeat). Si el gap desde la última señal supera el umbral
 * de inactividad, no se acumulan esos segundos (pausa automática por inactividad).
 */
export async function recordJuryActivityHeartbeat(input: {
  contestId: string;
  jurorId: string;
  scoringSessionId?: string | null;
  /** Segundos transcurridos desde la última señal de actividad del cliente. */
  elapsedSeconds: number;
  idleThresholdSeconds?: number;
}) {
  const idleThresholdSeconds = input.idleThresholdSeconds ?? DEFAULT_IDLE_THRESHOLD_SECONDS;
  const elapsed = Number.isFinite(input.elapsedSeconds) ? Math.max(0, input.elapsedSeconds) : 0;
  const now = new Date();

  const existing = await prisma.fotorankJuryActivityHeartbeat.findUnique({
    where: { contestId_jurorId: { contestId: input.contestId, jurorId: input.jurorId } },
  });

  const shouldAccumulate = existing ? elapsed <= idleThresholdSeconds : false;
  const increment = shouldAccumulate ? Math.round(elapsed) : 0;

  if (!existing) {
    return prisma.fotorankJuryActivityHeartbeat.create({
      data: {
        id: newId(),
        contestId: input.contestId,
        jurorId: input.jurorId,
        scoringSessionId: input.scoringSessionId ?? null,
        lastActiveAt: now,
        activeSecondsAccumulated: 0,
        idleThresholdSeconds,
      },
    });
  }

  return prisma.fotorankJuryActivityHeartbeat.update({
    where: { id: existing.id },
    data: {
      lastActiveAt: now,
      scoringSessionId: input.scoringSessionId ?? existing.scoringSessionId,
      idleThresholdSeconds,
      activeSecondsAccumulated: existing.activeSecondsAccumulated + increment,
    },
  });
}

export type JudgeEtaInput = {
  completed: number;
  remaining: number;
  /** Tiempo activo total acumulado (segundos), correspondiente a `completed` evaluaciones. */
  activeSeconds: number;
  /** Muestras mínimas antes de confiar en la ETA (default 25, spec: ~20–30). */
  minSamples?: number;
};

export type JudgeEtaResult = {
  secondsPerEntry: number;
  etaSeconds: number;
  label: string;
};

/**
 * Calcula ETA a partir de ritmo observado. Devuelve null si aún no hay muestras suficientes
 * (spec: "no ETA confiable antes de ~20–30 evaluaciones").
 */
export function computeJudgeEta(input: JudgeEtaInput): JudgeEtaResult | null {
  const minSamples = input.minSamples ?? 25;
  if (input.completed < minSamples) return null;
  if (input.completed <= 0 || input.activeSeconds <= 0) return null;

  const secondsPerEntry = input.activeSeconds / input.completed;
  const etaSeconds = Math.max(0, Math.round(secondsPerEntry * Math.max(0, input.remaining)));

  return {
    secondsPerEntry,
    etaSeconds,
    label: formatEtaLabel(etaSeconds),
  };
}

function formatEtaLabel(etaSeconds: number): string {
  if (etaSeconds < 60) return `${etaSeconds}s`;
  const minutes = Math.round(etaSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours} h ${remMinutes} min` : `${hours} h`;
}
