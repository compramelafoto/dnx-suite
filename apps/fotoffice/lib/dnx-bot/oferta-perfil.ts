/**
 * Cuándo ofrecer «Armalo conversando» en Configuración → Precios (pedido de Daniel, 13/10: para
 * ahorrar, el camino principal es el formulario; el bot se ofrece sólo si la persona parece
 * trabada). PURO, corre en el navegador.
 *
 * Se ofrece si el perfil está incompleto, el bot está encendido, no dijo «Prefiero seguir yo» en
 * esta visita, y además pasó al menos una de estas cosas:
 *   a. intentó guardar y no pudo (error de validación) o lo que guardó sigue incompleto;
 *   b. lleva más de 4 minutos en la página en esta visita;
 *   c. es su segunda visita (o más) a Precios con el perfil todavía incompleto (cuenta en
 *      localStorage por workspace; si el navegador no deja guardar, cuenta como primera).
 */
export const MS_PARA_OFRECER = 4 * 60 * 1000;

export const OFERTA = {
  titulo: "¿Se te complica completarlo?",
  texto: "Lo podemos armar conversando: te pregunto de a un dato y vos confirmás antes de guardar.",
  boton: "Armalo conversando",
  descartar: "Prefiero seguir yo",
  mensajeAlBot: "Quiero armar mi perfil de precios conversando.",
} as const;

export type SenalesOferta = {
  botDisponible: boolean;
  perfilCompleto: boolean;
  /** «Prefiero seguir yo» en esta visita. */
  descartada: boolean;
  /** a: intentó guardar y no pudo, o lo guardado sigue incompleto. */
  guardadoTrabado: boolean;
  /** b: tiempo en la página en esta visita. */
  msEnLaPagina: number;
  /** c: visitas anteriores a Precios con el perfil incompleto. */
  visitasPrevias: number;
};

export type DecisionOferta = { ofrecer: boolean; motivo: "guardado" | "tiempo" | "visitas" | null };

export function debeOfrecerBot(s: SenalesOferta): DecisionOferta {
  if (!s.botDisponible || s.perfilCompleto || s.descartada) return { ofrecer: false, motivo: null };
  if (s.guardadoTrabado) return { ofrecer: true, motivo: "guardado" };
  if (s.msEnLaPagina >= MS_PARA_OFRECER) return { ofrecer: true, motivo: "tiempo" };
  if (s.visitasPrevias >= 1) return { ofrecer: true, motivo: "visitas" };
  return { ofrecer: false, motivo: null };
}

type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function claveVisitas(workspaceId: string): string {
  return `dnxbot:precios:visitas:${workspaceId}`;
}

/**
 * Anota esta visita a Precios y devuelve cuántas hubo antes con el perfil incompleto. Con el perfil
 * completo borra la cuenta. Nunca lanza: sin almacenamiento, cuenta como primera visita.
 */
export function registrarVisita(almacen: Almacen | null, workspaceId: string, perfilCompleto: boolean): number {
  if (!almacen) return 0;
  const clave = claveVisitas(workspaceId);
  try {
    if (perfilCompleto) {
      almacen.removeItem(clave);
      return 0;
    }
    const previas = Number.parseInt(almacen.getItem(clave) ?? "0", 10);
    const n = Number.isFinite(previas) && previas >= 0 ? previas : 0;
    almacen.setItem(clave, String(n + 1));
    return n;
  } catch {
    return 0;
  }
}
