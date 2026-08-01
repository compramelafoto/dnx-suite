/**
 * Server-side only commercial scenarios for homologation.
 * Browser may select a case id — never amount / receivers / consents.
 */

export type HomologationScenarioId = "OWNER_PLUS_1" | "OWNER_PLUS_2";

export type HomologationScenario = {
  id: HomologationScenarioId;
  label: string;
  partnerCount: 1 | 2;
  /** Minor units ARS — sandbox-safe small amounts. */
  totalMinor: bigint;
  currency: "ARS";
};

const SCENARIOS: Record<HomologationScenarioId, HomologationScenario> = {
  OWNER_PLUS_1: {
    id: "OWNER_PLUS_1",
    label: "Owner + 1 partner",
    partnerCount: 1,
    totalMinor: 10_000n, // $100.00
    currency: "ARS",
  },
  OWNER_PLUS_2: {
    id: "OWNER_PLUS_2",
    label: "Owner + 2 partners",
    partnerCount: 2,
    totalMinor: 15_000n, // $150.00
    currency: "ARS",
  },
};

export function listHomologationScenarios(): HomologationScenario[] {
  return Object.values(SCENARIOS);
}

export function resolveHomologationScenario(
  id: string | undefined | null,
): HomologationScenario | null {
  if (!id) return null;
  const key = id.trim().toUpperCase() as HomologationScenarioId;
  return SCENARIOS[key] ?? null;
}

/** Ignore any client-supplied amount — always use scenario. */
export function scenarioAmountMinor(
  scenario: HomologationScenario,
  _clientDisplayedAmountMinor?: number,
): bigint {
  void _clientDisplayedAmountMinor;
  return scenario.totalMinor;
}
