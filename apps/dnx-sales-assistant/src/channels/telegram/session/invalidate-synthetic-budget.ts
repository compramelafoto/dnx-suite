import { readFile } from "node:fs/promises";
import type { StoredConversation } from "../../../conversation/memory-models.js";
import { SYNTHETIC_PROFILE_ID } from "../../../pricing/profile/user-facing-profile-guard.js";
import { telegramSessionsPath } from "../persistence/paths.js";
import type { TelegramLocalStore } from "../persistence/telegram-local-store.js";

const INVALIDATION_MESSAGE =
  "Los datos del trabajo están guardados, pero el presupuesto anterior fue invalidado porque utilizó un perfil de prueba.";

/**
 * Invalida precios/aprobaciones sintéticas; conserva el draft conversacional.
 */
export async function invalidateSyntheticBudgets(
  store: TelegramLocalStore,
): Promise<{ conversationsTouched: number; chatsFlagged: number }> {
  const ids = await collectConversationIds(store);
  let conversationsTouched = 0;

  for (const id of ids) {
    const current = await store.memory.get(id);
    if (!current) continue;
    if (!shouldInvalidatePricing(current)) continue;

    const next: StoredConversation = {
      ...current,
      pricingResult: undefined,
      pricingCacheKey: undefined,
      updatedAt: new Date().toISOString(),
    };
    await store.memory.set(next);
    await store.persistConversation(id);
    conversationsTouched += 1;
  }

  await store.invalidateSyntheticApprovals();
  const chatsFlagged = await store.flagAllBudgetsInvalidated(INVALIDATION_MESSAGE);

  return { conversationsTouched, chatsFlagged };
}

function shouldInvalidatePricing(stored: StoredConversation): boolean {
  const cache = stored.pricingCacheKey ?? "";
  const result = stored.pricingResult;
  if (!result && !cache) return false;
  if (cache.includes("unavailable") || cache.includes("test-1")) return true;
  if (result?.status === "FAILED") return true;
  if (result?.status === "READY") {
    const blob = JSON.stringify(result);
    if (blob.includes(SYNTHETIC_PROFILE_ID) || blob.includes("test-1")) {
      return true;
    }
    // READY sin evidencia de perfil real de esta etapa → invalidar
    return true;
  }
  return Boolean(result);
}

async function collectConversationIds(
  store: TelegramLocalStore,
): Promise<string[]> {
  const ids = new Set<string>(store.listConversationIdsFromReviews());
  try {
    const raw = await readFile(telegramSessionsPath(), "utf8");
    const data = JSON.parse(raw) as {
      conversations?: Record<string, StoredConversation>;
    };
    for (const id of Object.keys(data.conversations ?? {})) ids.add(id);
  } catch {
    // ignore
  }
  return [...ids];
}
