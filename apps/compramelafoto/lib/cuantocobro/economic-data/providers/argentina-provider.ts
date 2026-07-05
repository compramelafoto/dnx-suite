import {
  buildInflationSuggestionFromPoints,
  parseDatosGobArPercentChangeSeries,
} from "../inflation-math";
import type {
  EconomicDataInflationResult,
  EconomicDataInterestRateResult,
  EconomicDataUnavailableResult,
  FetchJsonFn,
} from "../economic-data-types";

/** IPC nivel general GBA — variación mensual % (datos.gob.ar / INDEC). */
export const AR_IPC_SERIES_ID = "101.1_I2NG_2016_M_22";

/** BCRA v4 — tasa de política monetaria (nominal anual). */
export const AR_BCRA_POLICY_RATE_VARIABLE_ID = 160;

/** BCRA v4 — BADLAR bancos privados (nominal anual, actualización frecuente). */
export const AR_BCRA_BADLAR_VARIABLE_ID = 7;

const DATOS_GOB_AR_SERIES_URL = "https://apis.datos.gob.ar/series/api/series/";
const BCRA_MONETARIAS_URL = "https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias";

const BCRA_RECENCY_DAYS = 120;

type BcraVariableMeta = {
  idVariable: number;
  descripcion?: string;
  ultFechaInformada?: string;
  ultValorInformado?: number;
};

async function defaultFetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al consultar ${url}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function isRecentBcraDate(isoDate: string | undefined): boolean {
  if (!isoDate) return false;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;
  const diffMs = Date.now() - date.getTime();
  return diffMs <= BCRA_RECENCY_DAYS * 24 * 60 * 60 * 1000;
}

async function fetchBcraVariableMeta(
  variableId: number,
  fetchJson: FetchJsonFn,
): Promise<BcraVariableMeta | null> {
  const url = `${BCRA_MONETARIAS_URL}?IdVariable=${variableId}&limit=1`;
  const payload = await fetchJson(url);
  if (!payload || typeof payload !== "object") return null;

  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;

  const row = results[0];
  if (!row || typeof row !== "object") return null;
  return row as BcraVariableMeta;
}

async function fetchArgentinaIpcMonthlyRates(fetchJson: FetchJsonFn) {
  const url = new URL(DATOS_GOB_AR_SERIES_URL);
  url.searchParams.set("ids", AR_IPC_SERIES_ID);
  url.searchParams.set("limit", "18");
  url.searchParams.set("format", "json");
  url.searchParams.set("metadata", "simple");
  url.searchParams.set("representation_mode", "percent_change");
  url.searchParams.set("sort", "desc");

  const payload = await fetchJson(url.toString());
  return parseDatosGobArPercentChangeSeries(payload);
}

export type ArgentinaProviderOptions = {
  fetchJson?: FetchJsonFn;
};

export async function fetchArgentinaInflationSuggestion(
  options: ArgentinaProviderOptions = {},
): Promise<EconomicDataInflationResult | EconomicDataUnavailableResult> {
  const fetchJson = options.fetchJson ?? defaultFetchJson;
  const queriedAt = new Date().toISOString();

  try {
    const points = await fetchArgentinaIpcMonthlyRates(fetchJson);
    const built = buildInflationSuggestionFromPoints(points, {
      sourceLabel: "IPC Argentina - datos.gob.ar (INDEC)",
      seriesId: AR_IPC_SERIES_ID,
      queriedAt,
    });

    if (!built) {
      return {
        available: false,
        countryCode: "AR",
        type: "inflation",
        sourceLabel: "IPC Argentina - datos.gob.ar",
        queriedAt,
        message: "No se pudieron obtener datos de inflación. Podés cargar la tasa manualmente.",
      };
    }

    return {
      available: true,
      countryCode: "AR",
      type: "inflation",
      sourceLabel: "IPC Argentina - datos.gob.ar (INDEC)",
      queriedAt,
      seriesId: AR_IPC_SERIES_ID,
      method: "ipc_monthly_average_6m",
      latestPeriod: built.latestPeriod,
      latestMonthlyRate: round2(built.latestMonthlyRate),
      average3m: round2(built.average3m),
      average6m: round2(built.average6m),
      average12m: round2(built.average12m),
      suggestedMonthlyRate: round2(built.suggestedMonthlyRate),
      suggestedAnnualRate: round2(built.suggestedAnnualRate),
    };
  } catch {
    return {
      available: false,
      countryCode: "AR",
      type: "inflation",
      sourceLabel: "IPC Argentina - datos.gob.ar",
      queriedAt,
      message: "No se pudo consultar la API de inflación. Podés cargar la tasa manualmente.",
    };
  }
}

export async function fetchArgentinaInterestRateSuggestion(
  options: ArgentinaProviderOptions = {},
): Promise<EconomicDataInterestRateResult | EconomicDataUnavailableResult> {
  const fetchJson = options.fetchJson ?? defaultFetchJson;
  const queriedAt = new Date().toISOString();

  try {
    const policyMeta = await fetchBcraVariableMeta(AR_BCRA_POLICY_RATE_VARIABLE_ID, fetchJson);
    if (
      policyMeta?.ultValorInformado != null &&
      isRecentBcraDate(policyMeta.ultFechaInformada)
    ) {
      return {
        available: true,
        countryCode: "AR",
        type: "interest_rate",
        sourceLabel: "BCRA - Tasas de interés de política monetaria",
        queriedAt,
        latestPeriod: policyMeta.ultFechaInformada,
        suggestedAnnualRate: round2(policyMeta.ultValorInformado),
        method: "bcra_policy_rate",
        bcraVariableId: AR_BCRA_POLICY_RATE_VARIABLE_ID,
        bcraVariableLabel: policyMeta.descripcion ?? "Política monetaria",
      };
    }

    const badlarMeta = await fetchBcraVariableMeta(AR_BCRA_BADLAR_VARIABLE_ID, fetchJson);
    if (
      badlarMeta?.ultValorInformado != null &&
      isRecentBcraDate(badlarMeta.ultFechaInformada)
    ) {
      return {
        available: true,
        countryCode: "AR",
        type: "interest_rate",
        sourceLabel: "BCRA - Tasa BADLAR bancos privados",
        queriedAt,
        latestPeriod: badlarMeta.ultFechaInformada,
        suggestedAnnualRate: round2(badlarMeta.ultValorInformado),
        method: "bcra_badlar",
        message: "Referencia de mercado bancario (BADLAR), no tasa de política monetaria.",
        bcraVariableId: AR_BCRA_BADLAR_VARIABLE_ID,
        bcraVariableLabel: badlarMeta.descripcion ?? "BADLAR",
      };
    }

    const inflation = await fetchArgentinaInflationSuggestion(options);
    if (inflation.available && inflation.suggestedAnnualRate != null) {
      return {
        available: true,
        countryCode: "AR",
        type: "interest_rate",
        sourceLabel: "IPC Argentina - datos.gob.ar",
        queriedAt,
        latestPeriod: inflation.latestPeriod,
        latestMonthlyRate: inflation.latestMonthlyRate,
        average3m: inflation.average3m,
        average6m: inflation.average6m,
        average12m: inflation.average12m,
        suggestedMonthlyRate: inflation.suggestedMonthlyRate,
        suggestedAnnualRate: inflation.suggestedAnnualRate,
        method: "inflation_proxy",
        message:
          "Referencia basada en inflación histórica, no tasa bancaria. Revisá y ajustá manualmente si hace falta.",
      };
    }

    return {
      available: false,
      countryCode: "AR",
      type: "interest_rate",
      sourceLabel: "BCRA / IPC Argentina",
      queriedAt,
      message: "No se pudo obtener una tasa sugerida. Podés cargar la tasa manualmente.",
    };
  } catch {
    return {
      available: false,
      countryCode: "AR",
      type: "interest_rate",
      sourceLabel: "BCRA / IPC Argentina",
      queriedAt,
      message: "No se pudo consultar tasas de referencia. Podés cargar la tasa manualmente.",
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
