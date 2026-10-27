import { cifrasPermitidas, textosDelTurno } from "@/lib/dnx-bot/cifras";

/**
 * Cifras que puede decir el bot de WhatsApp. Además de lo que respalda cualquier turno de DNX Bot
 * (lo que escribió el cliente y los resultados de las herramientas) vale:
 * - lo que el bot o el equipo ya dijeron antes en el chat (ya se controló cuando se envió), y
 * - una cantidad que dijo el cliente × un precio respaldado ("2 videos" × $12.000 = $24.000).
 * Un precio inventado sigue sin pasar. Módulo PURO.
 */

type Msg = { role?: string; content?: unknown };

const MAX_CANTIDAD = 1000;
/** Sólo se multiplican importes de verdad (no el "$2" que sale de cualquier número suelto). */
const IMPORTE_MINIMO = 100;

function textoDe(m: Msg): string {
  if (typeof m.content === "string") return m.content;
  if (!Array.isArray(m.content)) return "";
  return (m.content as { type?: string; text?: unknown }[])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

export function cifrasRespaldadasEnAtencion(history: readonly unknown[], appended: readonly unknown[]): Set<string> {
  const todos = [...history, ...appended] as Msg[];
  const dichoAntes = (history as Msg[]).filter((m) => m?.role === "assistant").map(textoDe);
  const ok = cifrasPermitidas([...textosDelTurno(todos), ...dichoAntes]);

  const delCliente = todos.filter((m) => m?.role === "user").map(textoDe).join("\n");
  const cantidades = new Set<number>();
  for (const m of delCliente.matchAll(/\b(\d{1,4})\b/g)) {
    const n = Number(m[1]);
    if (n >= 2 && n <= MAX_CANTIDAD) cantidades.add(n);
  }
  const importes = [...ok].filter((c) => c.startsWith("$")).map((c) => Number(c.slice(1))).filter((v) => v >= IMPORTE_MINIMO);
  for (const precio of importes) for (const n of cantidades) ok.add(`$${precio * n}`);
  return ok;
}
