import { memberContactSource } from "./members";
import type { ContactSource } from "./types";

/**
 * Las fuentes de contactos registradas. **Sumar un módulo se hace acá y en ningún otro lado.**
 */
const FUENTES: readonly ContactSource[] = [memberContactSource] as const;

export function listContactSources(): ContactSource[] {
  return FUENTES.slice();
}

export function getContactSource(moduleKey: string): ContactSource | undefined {
  return FUENTES.find((f) => f.moduleKey === moduleKey);
}

export type { ContactSource } from "./types";
