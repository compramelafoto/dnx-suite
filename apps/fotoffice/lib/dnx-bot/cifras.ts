/**
 * Verificador de cifras (spec §5.4): una red de seguridad, PURA, después de cada turno. Saca del
 * texto final del bot los importes y porcentajes y los compara con los que lo respaldan: los
 * resultados de las herramientas y lo que escribió la persona. Lo que no está, se avisa. La
 * defensa principal siguen siendo las herramientas, la guía y las tarjetas.
 *
 * Normalización: importes como "$<dígitos>", porcentajes como "<n>%" (punto decimal).
 */

// $ 1.294.000 · 1.294.000 · 450000 pesos · 24 % · 24,5%
const CIFRA = /\$\s?(\d{1,3}(?:\.\d{3})+|\d+)|(\d{1,3}(?:\.\d{3})+)|(\d+)\s?pesos\b|(\d{1,3}(?:[.,]\d{1,2})?)\s?%/gi;

const plata = (digitos: string) => `$${Number(digitos.replace(/\./g, ""))}`;
const pct = (n: string) => `${Number(n.replace(",", "."))}%`;

export function cifrasDelTexto(texto: string): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(CIFRA)) {
    if (m[1]) out.push(plata(m[1]));
    else if (m[2]) out.push(plata(m[2]));
    else if (m[3]) out.push(plata(m[3]));
    else if (m[4]) out.push(pct(m[4]));
  }
  return out;
}

/**
 * Cifras que respaldan el texto. Generosa a propósito (un falso aviso molesta más que uno que se
 * escapa): todo número de una fuente vale como importe y como porcentaje, y lo dicho en criollo
 * ("450 lucas", "80 mil", "350k") vale por mil.
 */
export function cifrasPermitidas(fuentes: string[]): Set<string> {
  const ok = new Set<string>();
  for (const f of fuentes) {
    for (const c of cifrasDelTexto(f)) ok.add(c);
    for (const m of f.matchAll(/(\d+(?:[.,]\d+)?)\s?(lucas|luquitas|mil|k)\b/gi)) {
      ok.add(`$${Math.round(Number(m[1]!.replace(",", ".")) * 1000)}`);
    }
    for (const m of f.matchAll(/\d{1,3}(?:\.\d{3})+|\d+(?:,\d{1,2})?/g)) {
      const n = m[0];
      if (/^\d{1,3}(?:\.\d{3})+$/.test(n)) ok.add(plata(n));
      else {
        ok.add(plata(n.split(",")[0]!));
        ok.add(pct(n));
      }
    }
  }
  return ok;
}

/** El cero nunca es un número inventado: la guía pide ofrecer dejar un gasto en cero. */
const SIEMPRE = new Set(["$0", "0%"]);

export function cifrasNoRespaldadas(texto: string, permitidas: Set<string>): string[] {
  return [...new Set(cifrasDelTexto(texto).filter((c) => !permitidas.has(c) && !SIEMPRE.has(c)))];
}

/** Lo que respalda cifras en una conversación: mensajes de la persona y resultados de herramientas. */
export function textosDelTurno(mensajes: unknown[]): string[] {
  const out: string[] = [];
  for (const m of mensajes as { role?: string; content?: unknown }[]) {
    if (m?.role !== "user") continue;
    if (typeof m.content === "string") {
      out.push(m.content);
      continue;
    }
    if (!Array.isArray(m.content)) continue;
    for (const b of m.content as { type?: string; content?: unknown; text?: unknown }[]) {
      if (b?.type === "tool_result") {
        if (typeof b.content === "string") out.push(b.content);
        else if (Array.isArray(b.content)) {
          for (const x of b.content as { text?: unknown }[]) if (typeof x?.text === "string") out.push(x.text);
        }
      } else if (b?.type === "text" && typeof b.text === "string") out.push(b.text);
    }
  }
  return out;
}

export const AVISO_CIFRA = "Ojo: un número de este mensaje no salió del cálculo. Usá los de la tarjeta.";
