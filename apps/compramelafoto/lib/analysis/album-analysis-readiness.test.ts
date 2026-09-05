import { describe, expect, it, afterEach } from "vitest";
import {
  DEFAULT_MAX_WAIT_HOURS,
  DEFAULT_QUIET_WINDOW_MINUTES,
  decideAlbumReadiness,
  resolveMaxWaitMs,
  resolveQuietWindowMs,
  type AlbumAnalysisStats,
} from "./album-analysis-readiness";

const NOW = new Date("2026-09-05T18:00:00.000Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60 * 1000);
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 60 * 60 * 1000);

function stats(partial: Partial<AlbumAnalysisStats> = {}): AlbumAnalysisStats {
  return {
    albumId: 1,
    pending: 0,
    processing: 0,
    done: 0,
    error: 0,
    lastPhotoAt: null,
    ...partial,
  };
}

describe("album-analysis-readiness", () => {
  const prevQuiet = process.env.ALBUM_READY_QUIET_MINUTES;
  const prevMaxWait = process.env.ALBUM_READY_MAX_WAIT_HOURS;

  afterEach(() => {
    if (prevQuiet == null) delete process.env.ALBUM_READY_QUIET_MINUTES;
    else process.env.ALBUM_READY_QUIET_MINUTES = prevQuiet;
    if (prevMaxWait == null) delete process.env.ALBUM_READY_MAX_WAIT_HOURS;
    else process.env.ALBUM_READY_MAX_WAIT_HOURS = prevMaxWait;
  });

  describe("configuración", () => {
    it("por default espera 30 minutos sin fotos nuevas", () => {
      delete process.env.ALBUM_READY_QUIET_MINUTES;
      expect(resolveQuietWindowMs()).toBe(DEFAULT_QUIET_WINDOW_MINUTES * 60 * 1000);
      expect(resolveQuietWindowMs()).toBe(30 * 60 * 1000);
    });

    it("por default la válvula de escape es a las 24 horas", () => {
      delete process.env.ALBUM_READY_MAX_WAIT_HOURS;
      expect(resolveMaxWaitMs()).toBe(DEFAULT_MAX_WAIT_HOURS * 60 * 60 * 1000);
      expect(resolveMaxWaitMs()).toBe(24 * 60 * 60 * 1000);
    });

    it("se pueden mover por entorno sin tocar código", () => {
      process.env.ALBUM_READY_QUIET_MINUTES = "5";
      expect(resolveQuietWindowMs()).toBe(5 * 60 * 1000);
      process.env.ALBUM_READY_MAX_WAIT_HOURS = "6";
      expect(resolveMaxWaitMs()).toBe(6 * 60 * 60 * 1000);
    });

    it("un valor de entorno inválido no rompe: cae al default", () => {
      process.env.ALBUM_READY_QUIET_MINUTES = "ni idea";
      expect(resolveQuietWindowMs()).toBe(DEFAULT_QUIET_WINDOW_MINUTES * 60 * 1000);
    });

    it("permite desactivar la ventana de calma con 0", () => {
      process.env.ALBUM_READY_QUIET_MINUTES = "0";
      expect(resolveQuietWindowMs()).toBe(0);
    });
  });

  describe("decideAlbumReadiness", () => {
    it("un álbum sin fotos no está listo", () => {
      const result = decideAlbumReadiness(stats(), NOW);
      expect(result.ready).toBe(false);
      expect(result.reason).toBe("no_photos");
    });

    it("no avisa mientras queden fotos sin analizar", () => {
      const result = decideAlbumReadiness(
        stats({ pending: 400, done: 100, lastPhotoAt: minutesAgo(90) }),
        NOW
      );
      expect(result.ready).toBe(false);
      expect(result.reason).toBe("analysis_in_progress");
    });

    it("no avisa mientras haya una foto en proceso", () => {
      const result = decideAlbumReadiness(
        stats({ processing: 1, done: 499, lastPhotoAt: minutesAgo(90) }),
        NOW
      );
      expect(result.ready).toBe(false);
      expect(result.reason).toBe("analysis_in_progress");
    });

    it("no avisa entre tanda y tanda: la última foto entró hace 10 minutos", () => {
      const result = decideAlbumReadiness(
        stats({ done: 200, lastPhotoAt: minutesAgo(10) }),
        NOW
      );
      expect(result.ready).toBe(false);
      expect(result.reason).toBe("quiet_window");
    });

    it("avisa cuando terminó el análisis y pasó la ventana de calma", () => {
      const result = decideAlbumReadiness(
        stats({ done: 500, lastPhotoAt: minutesAgo(45) }),
        NOW
      );
      expect(result.ready).toBe(true);
      expect(result.reason).toBe("ready");
    });

    it("una foto rota no congela el álbum para siempre", () => {
      const result = decideAlbumReadiness(
        stats({ done: 499, error: 1, lastPhotoAt: minutesAgo(45) }),
        NOW
      );
      expect(result.ready).toBe(true);
      expect(result.reason).toBe("ready");
    });

    it("si todavía no hay ninguna foto analizada, no avisa", () => {
      const result = decideAlbumReadiness(
        stats({ error: 3, lastPhotoAt: minutesAgo(45) }),
        NOW
      );
      expect(result.ready).toBe(false);
      expect(result.reason).toBe("no_analyzed_photos");
    });

    it("válvula: a las 24 horas avisa igual aunque el análisis siga trabado", () => {
      const result = decideAlbumReadiness(
        stats({ pending: 300, done: 50, lastPhotoAt: hoursAgo(25) }),
        NOW
      );
      expect(result.ready).toBe(true);
      expect(result.reason).toBe("timeout");
    });

    it("a las 23 horas todavía espera", () => {
      const result = decideAlbumReadiness(
        stats({ pending: 300, done: 50, lastPhotoAt: hoursAgo(23) }),
        NOW
      );
      expect(result.ready).toBe(false);
      expect(result.reason).toBe("analysis_in_progress");
    });

    it("la válvula también rescata un álbum donde todo falló", () => {
      const result = decideAlbumReadiness(
        stats({ error: 10, lastPhotoAt: hoursAgo(25) }),
        NOW
      );
      expect(result.ready).toBe(true);
      expect(result.reason).toBe("timeout");
    });

    it("sin fecha de última foto no dispara la válvula por accidente", () => {
      const result = decideAlbumReadiness(
        stats({ pending: 5, lastPhotoAt: null }),
        NOW
      );
      expect(result.ready).toBe(false);
      expect(result.reason).toBe("analysis_in_progress");
    });

    it("con la ventana de calma en 0 avisa apenas termina el análisis", () => {
      process.env.ALBUM_READY_QUIET_MINUTES = "0";
      const result = decideAlbumReadiness(
        stats({ done: 200, lastPhotoAt: minutesAgo(1) }),
        NOW
      );
      expect(result.ready).toBe(true);
      expect(result.reason).toBe("ready");
    });
  });
});
