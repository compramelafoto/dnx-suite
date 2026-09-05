import { describe, expect, it, afterEach } from "vitest";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_RUN_MS,
  resolveBatchSize,
  resolveConcurrency,
  resolveMaxRunMs,
  shouldRunAnotherRound,
} from "./analysis-throughput";

describe("analysis-throughput", () => {
  const prevBatch = process.env.ANALYSIS_BATCH_SIZE;
  const prevConcurrency = process.env.ANALYSIS_CONCURRENCY;
  const prevRunSeconds = process.env.ANALYSIS_MAX_RUN_SECONDS;

  afterEach(() => {
    restore("ANALYSIS_BATCH_SIZE", prevBatch);
    restore("ANALYSIS_CONCURRENCY", prevConcurrency);
    restore("ANALYSIS_MAX_RUN_SECONDS", prevRunSeconds);
  });

  function restore(key: string, value: string | undefined) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }

  describe("resolveBatchSize", () => {
    it("el default ya no es el lote de 2 que trababa la cola", () => {
      delete process.env.ANALYSIS_BATCH_SIZE;
      expect(resolveBatchSize()).toBe(DEFAULT_BATCH_SIZE);
      expect(resolveBatchSize()).toBeGreaterThan(2);
    });

    it("respeta la variable de entorno", () => {
      process.env.ANALYSIS_BATCH_SIZE = "25";
      expect(resolveBatchSize()).toBe(25);
    });

    it("acota valores absurdos en vez de romper", () => {
      process.env.ANALYSIS_BATCH_SIZE = "9999";
      expect(resolveBatchSize()).toBe(50);
      process.env.ANALYSIS_BATCH_SIZE = "0";
      expect(resolveBatchSize()).toBe(1);
      process.env.ANALYSIS_BATCH_SIZE = "no-es-un-numero";
      expect(resolveBatchSize()).toBe(DEFAULT_BATCH_SIZE);
    });
  });

  describe("resolveConcurrency", () => {
    it("procesa varias fotos a la vez por default", () => {
      delete process.env.ANALYSIS_CONCURRENCY;
      expect(resolveConcurrency()).toBe(DEFAULT_CONCURRENCY);
      expect(resolveConcurrency()).toBeGreaterThan(1);
    });

    it("acota el máximo para no saturar Rekognition", () => {
      process.env.ANALYSIS_CONCURRENCY = "500";
      expect(resolveConcurrency()).toBe(12);
    });
  });

  describe("resolveMaxRunMs", () => {
    it("por default usa casi todo el presupuesto de la función (maxDuration 800 s)", () => {
      delete process.env.ANALYSIS_MAX_RUN_SECONDS;
      expect(resolveMaxRunMs()).toBe(DEFAULT_MAX_RUN_MS);
      expect(resolveMaxRunMs()).toBeGreaterThan(600_000);
    });

    it("acepta segundos por entorno y nunca supera el techo de la función", () => {
      process.env.ANALYSIS_MAX_RUN_SECONDS = "120";
      expect(resolveMaxRunMs()).toBe(120_000);
      process.env.ANALYSIS_MAX_RUN_SECONDS = "5000";
      expect(resolveMaxRunMs()).toBe(780_000);
    });
  });

  describe("shouldRunAnotherRound", () => {
    const budget = 700_000;

    it("corta cuando la cola quedó vacía", () => {
      expect(
        shouldRunAnotherRound({
          elapsedMs: 1_000,
          maxRunMs: budget,
          lastRoundLocked: 0,
          lastRoundMs: 800,
        })
      ).toBe(false);
    });

    it("sigue mientras haya trabajo y quede presupuesto", () => {
      expect(
        shouldRunAnotherRound({
          elapsedMs: 10_000,
          maxRunMs: budget,
          lastRoundLocked: 12,
          lastRoundMs: 9_000,
        })
      ).toBe(true);
    });

    it("no arranca una vuelta que no entraría en el presupuesto", () => {
      expect(
        shouldRunAnotherRound({
          elapsedMs: 695_000,
          maxRunMs: budget,
          lastRoundLocked: 12,
          lastRoundMs: 9_000,
        })
      ).toBe(false);
    });

    it("no tiene tope de fotos: sólo lo corta el reloj", () => {
      // Ya procesó decenas de miles de fotos en esta corrida y sigue habiendo cola.
      expect(
        shouldRunAnotherRound({
          elapsedMs: 60_000,
          maxRunMs: budget,
          lastRoundLocked: 12,
          lastRoundMs: 1_200,
          processedSoFar: 50_000,
        })
      ).toBe(true);
    });

    it("una vuelta lentísima que ya se pasó del presupuesto corta", () => {
      expect(
        shouldRunAnotherRound({
          elapsedMs: 720_000,
          maxRunMs: budget,
          lastRoundLocked: 12,
          lastRoundMs: 300_000,
        })
      ).toBe(false);
    });
  });
});
