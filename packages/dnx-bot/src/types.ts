import type { z } from "zod";

export type BotActor = { userId: number; role: string; email: string; name: string | null };

export type ToolOutcome =
  | { ok: true; message: string; data?: unknown; before?: unknown; after?: unknown }
  | { ok: false; message: string; code?: string };

export type BotTool = {
  name: string;
  description: string;
  input: z.ZodType;
  /** read: corre directo. write: se propone y corre sólo tras confirmación del usuario. */
  kind: "read" | "write";
  /** Texto de la tarjeta "¿Lo hago?" (obligatorio para write). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  describe?: (input: any, actor: BotActor) => Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (input: any, actor: BotActor) => Promise<ToolOutcome>;
  /** Deshacer a partir del `before` guardado. Ausente = no se puede deshacer. */
  undo?: (before: unknown, actor: BotActor) => Promise<ToolOutcome>;
};

export function defineTool<S extends z.ZodType>(t: {
  name: string;
  description: string;
  input: S;
  kind: "read" | "write";
  describe?: (input: z.infer<S>, actor: BotActor) => Promise<string>;
  run: (input: z.infer<S>, actor: BotActor) => Promise<ToolOutcome>;
  undo?: (before: unknown, actor: BotActor) => Promise<ToolOutcome>;
}): BotTool {
  if (t.kind === "write" && !t.describe) throw new Error(`La herramienta ${t.name} es de escritura y no tiene describe()`);
  return t as BotTool;
}
