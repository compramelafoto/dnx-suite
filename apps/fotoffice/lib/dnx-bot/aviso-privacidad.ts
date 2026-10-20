import type { ToolOutcome } from "@repo/dnx-bot";
import type { Pantalla } from "./contexto";

/**
 * El aviso de privacidad de la etapa 1 (texto elegido por Daniel, 13/10). Lo muestra FOTOFFICE en
 * una tarjeta fija de la burbuja, con el enlace «Cómo cuidamos tus datos»: no depende de que el
 * modelo lo copie bien. Sale una vez por conversación, la primera vez que se habla del perfil (una
 * herramienta del perfil, o una cotización que no pudo dar precio porque el perfil está incompleto).
 */
export const AVISO_PRIVACIDAD =
  "Tus números son tuyos: quedan guardados en tu estudio dentro de FOTOFFICE, no los ven otros fotógrafos ni tus clientes, y sólo los uso para calcular cuánto tenés que cobrar.";
/** Cuando la persona pidió armar el perfil. */
export const AVISO_PRIVACIDAD_ARMAR = `Dale, armémoslo juntos. ${AVISO_PRIVACIDAD}`;
export const ENLACE_DATOS = { etiqueta: "Cómo cuidamos tus datos", ruta: "/ayuda/dnx-bot-datos" } as const;

export type AvisoPrivacidad = { texto: string; enlace: { etiqueta: string; ruta: string } };

const DEL_PERFIL = new Set(["ver_perfil_de_precios", "simular_perfil", "guardar_perfil_de_precios"]);
const PIDE_ARMAR = /\b(arm|complet|carg|hac)\w*\b[^.?!]*\bperfil\b|\bperfil\b[^.?!]*\b(arm|complet|carg)\w*/i;

function perfilIncompleto(r: ToolOutcome | string): boolean {
  if (typeof r === "string") return r.includes('"PERFIL_INCOMPLETO"');
  return r.ok && (r.data as { estado?: unknown } | undefined)?.estado === "PERFIL_INCOMPLETO";
}

/** ¿Ya se habló del perfil en esta conversación (y por lo tanto ya salió el aviso)? */
function yaSeAviso(historial: readonly unknown[]): boolean {
  for (const m of historial as { content?: unknown }[]) {
    if (!Array.isArray(m?.content)) continue;
    for (const b of m.content as { type?: string; name?: string; content?: unknown }[]) {
      if (b?.type === "tool_use" && typeof b.name === "string" && DEL_PERFIL.has(b.name)) return true;
      if (b?.type === "tool_result" && typeof b.content === "string" && perfilIncompleto(b.content)) return true;
    }
  }
  return false;
}

export function avisoDePrivacidad(p: {
  historial: readonly unknown[];
  pantalla: Pantalla;
  textoUsuario: string;
  herramienta: string;
  resultado: ToolOutcome;
}): AvisoPrivacidad | null {
  const delPerfil = DEL_PERFIL.has(p.herramienta);
  const sinPerfil = p.herramienta === "cotizar_trabajo" && perfilIncompleto(p.resultado);
  if (!delPerfil && !sinPerfil) return null;
  if (yaSeAviso(p.historial)) return null;
  const armar = delPerfil && (p.pantalla === "precios" || PIDE_ARMAR.test(p.textoUsuario));
  return { texto: armar ? AVISO_PRIVACIDAD_ARMAR : AVISO_PRIVACIDAD, enlace: { ...ENLACE_DATOS } };
}
