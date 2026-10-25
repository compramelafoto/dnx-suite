/**
 * Opciones de un presupuesto (spec 2026-10-25 «Presupuesto con opciones»). Módulo PURO.
 *
 * Un presupuesto (o una propuesta modelo) puede ofrecer de 1 a 4 opciones alternativas: por
 * ejemplo, para 15 años, Básico, Intermedio y Premium. El cliente elige UNA en el enlace público,
 * la acepta y paga la seña de esa. En el código se llaman «alternativas» para no confundirlas con
 * las opciones de PAGO (contado, cuotas: `./opciones-pago.ts`); en pantalla se dicen «opciones».
 *
 * Dónde se guarda (sin migración, todo en los JSON que ya existen):
 * - cada ítem lleva `alternativaId` (la opción a la que pertenece);
 * - `totals.alternativas`: la definición de cada opción (nombre, descripción, «la más elegida») con
 *   sus totales. Los totales de arriba de `totals` son los de la opción PRINCIPAL (la más elegida o,
 *   si no hay, la primera), así todo lo que ya leía `totals.total` sigue andando;
 * - `costSnapshot.alternativas`: costo y margen de cada opción (INTERNO, nunca sale al público);
 * - `paymentOptions.porAlternativa`: al enviar, la instantánea de las opciones de pago calculada
 *   sobre el total de CADA opción (la de arriba es la de la principal);
 * - al aceptar, `fijarAlternativa` reescribe los totales, las opciones de pago y los costos de
 *   arriba con los de la elegida y guarda `totals.alternativaElegidaId`. Desde ahí el pedido, la
 *   seña, los avisos y los informes leen la elegida sin saber nada de opciones.
 *
 * Sin opciones (`totals.alternativas` ausente o vacío): nada cambia, ni un campo.
 */
import type { Descuento, ItemPresupuesto, ResultadoValidacion } from "./constantes";
import { costosDeVersion, type CostoDeCatalogo, type CostosVersion } from "./costos";
import { calcularTotales, type TotalesPresupuesto } from "./totales";

export const MAX_ALTERNATIVAS = 4;
export const MAX_NOMBRE_ALTERNATIVA = 60;
export const MAX_DESCRIPCION_ALTERNATIVA = 300;
const CLAVE_VALIDA = /^[A-Za-z0-9_-]{1,64}$/;

export type Alternativa = {
  /** Clave dentro del presupuesto (no es un id de la base). */
  id: string;
  nombre: string;
  /** Descripción corta que ve el cliente arriba de la opción. */
  descripcion: string | null;
  /** La marca «La más elegida» (como mucho una). */
  masElegida: boolean;
};

/** Lo que queda guardado en `totals.alternativas`. */
export type AlternativaConTotales = Alternativa & { totales: TotalesPresupuesto };

export const MENSAJES_ALTERNATIVAS = {
  invalidas: "Las opciones del presupuesto no son válidas.",
  maximo: `Un presupuesto puede tener hasta ${MAX_ALTERNATIVAS} opciones.`,
  nombre: `Cada opción necesita un nombre de hasta ${MAX_NOMBRE_ALTERNATIVA} caracteres.`,
  descripcion: `La descripción de cada opción puede tener hasta ${MAX_DESCRIPCION_ALTERNATIVA} caracteres.`,
  repetida: "Hay dos opciones con el mismo nombre.",
  masElegida: "Sólo una opción puede ser «la más elegida».",
  sinItems: (nombre: string) => `La opción «${nombre}» no tiene ítems: agregale alguno o borrala.`,
  elegir: "Elegí una de las opciones del presupuesto.",
} as const;

// --- Validación -----------------------------------------------------------------------------------

/**
 * Valida la lista que llega del editor o de la base. undefined o null = sin opciones. Ids únicos
 * con forma de clave, nombres únicos (el cliente los tiene que distinguir), como mucho una «más
 * elegida».
 */
export function validarAlternativas(raw: unknown): ResultadoValidacion<Alternativa[]> {
  if (raw === undefined || raw === null) return { ok: true, valor: [] };
  if (!Array.isArray(raw)) return { ok: false, error: MENSAJES_ALTERNATIVAS.invalidas };
  if (raw.length > MAX_ALTERNATIVAS) return { ok: false, error: MENSAJES_ALTERNATIVAS.maximo };
  const out: Alternativa[] = [];
  const ids = new Set<string>();
  const nombres = new Set<string>();
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) return { ok: false, error: MENSAJES_ALTERNATIVAS.invalidas };
    const r = x as Record<string, unknown>;
    if (typeof r.id !== "string" || !CLAVE_VALIDA.test(r.id) || ids.has(r.id)) return { ok: false, error: MENSAJES_ALTERNATIVAS.invalidas };
    const nombre = typeof r.nombre === "string" ? r.nombre.replace(/\s+/g, " ").trim() : "";
    if (!nombre || nombre.length > MAX_NOMBRE_ALTERNATIVA) return { ok: false, error: MENSAJES_ALTERNATIVAS.nombre };
    const clave = nombre.toLocaleLowerCase("es");
    if (nombres.has(clave)) return { ok: false, error: MENSAJES_ALTERNATIVAS.repetida };
    if (r.descripcion !== undefined && r.descripcion !== null && typeof r.descripcion !== "string") return { ok: false, error: MENSAJES_ALTERNATIVAS.invalidas };
    const descripcion = typeof r.descripcion === "string" && r.descripcion.trim() !== "" ? r.descripcion.trim() : null;
    if (descripcion !== null && descripcion.length > MAX_DESCRIPCION_ALTERNATIVA) return { ok: false, error: MENSAJES_ALTERNATIVAS.descripcion };
    ids.add(r.id);
    nombres.add(clave);
    out.push({ id: r.id, nombre, descripcion, masElegida: r.masElegida === true });
  }
  if (out.filter((a) => a.masElegida).length > 1) return { ok: false, error: MENSAJES_ALTERNATIVAS.masElegida };
  return { ok: true, valor: out };
}

/** La principal: la más elegida o, si ninguna lo es, la primera. null sin opciones. */
export function alternativaPrincipal<T extends Alternativa>(alternativas: readonly T[]): T | null {
  return alternativas.find((a) => a.masElegida) ?? alternativas[0] ?? null;
}

/**
 * Cada ítem en una opción que existe. Sin opciones, ninguno lleva `alternativaId`. Con opciones,
 * el que no tiene (por ejemplo, uno que sumó DNX Bot) o tiene una que ya no está, va a la principal.
 */
export function asignarItems(items: readonly ItemPresupuesto[], alternativas: readonly Alternativa[]): ItemPresupuesto[] {
  const principal = alternativaPrincipal(alternativas);
  if (!principal) {
    return items.map((i) => {
      if (i.alternativaId === undefined) return i;
      const { alternativaId: _fuera, ...resto } = i;
      return resto;
    });
  }
  const ids = new Set(alternativas.map((a) => a.id));
  return items.map((i) => (i.alternativaId && ids.has(i.alternativaId) ? i : { ...i, alternativaId: principal.id }));
}

export function itemsDeAlternativa<T extends { alternativaId?: string | null }>(items: readonly T[], alternativaId: string): T[] {
  return items.filter((i) => i.alternativaId === alternativaId);
}

// --- Totales y costos --------------------------------------------------------------------------------

type ItemParaTotales = Parameters<typeof calcularTotales>[0][number] & { alternativaId?: string | null };

/**
 * Totales con opciones. Sin opciones, `calcularTotales` de siempre y `alternativas: []`. Con
 * opciones: cada una con su cuenta (el descuento global se aplica a cada una); los totales de
 * arriba son los de la principal, pero `renglones` tiene el neto de TODOS los ítems (el neto de un
 * renglón no depende de la opción).
 */
export function totalesConAlternativas(
  items: readonly ItemParaTotales[],
  alternativas: readonly Alternativa[],
  descuento: Descuento | null,
): { totales: TotalesPresupuesto; alternativas: AlternativaConTotales[] } {
  const principal = alternativaPrincipal(alternativas);
  if (!principal) return { totales: calcularTotales(items, descuento), alternativas: [] };
  const conTotales = alternativas.map((a) => ({ ...a, totales: calcularTotales(itemsDeAlternativa(items, a.id), descuento) }));
  const dePrincipal = conTotales.find((a) => a.id === principal.id)!.totales;
  return { totales: { ...dePrincipal, renglones: calcularTotales(items, null).renglones }, alternativas: conTotales };
}

/** `costSnapshot` con opciones: los de arriba, de la principal (con el costo de cada renglón de todas). */
export type CostosConAlternativas = CostosVersion & { alternativas?: Record<string, CostosVersion> };

export function costosConAlternativas(
  items: readonly ItemPresupuesto[],
  totales: TotalesPresupuesto,
  alternativas: readonly AlternativaConTotales[],
  catalogo: ReadonlyMap<string, CostoDeCatalogo>,
): CostosConAlternativas {
  const principal = alternativaPrincipal(alternativas);
  if (!principal) return costosDeVersion(items, totales, catalogo);
  const porAlternativa: Record<string, CostosVersion> = {};
  for (const a of alternativas) {
    porAlternativa[a.id] = costosDeVersion(itemsDeAlternativa(items, a.id), { ...a.totales, renglones: totales.renglones }, catalogo);
  }
  const todos = costosDeVersion(items, totales, catalogo);
  return { ...porAlternativa[principal.id]!, porItem: todos.porItem, alternativas: porAlternativa };
}

// --- Lectura de lo guardado -------------------------------------------------------------------------

const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Las opciones guardadas en `totals` (con sus totales); [] si no hay o no sirven. */
export function alternativasGuardadas(totals: unknown): AlternativaConTotales[] {
  if (!objeto(totals) || !Array.isArray(totals.alternativas) || totals.alternativas.length === 0) return [];
  const v = validarAlternativas(totals.alternativas);
  if (!v.ok) return [];
  const crudas = totals.alternativas as Record<string, unknown>[];
  const out: AlternativaConTotales[] = [];
  for (const a of v.valor) {
    const t = crudas.find((c) => c.id === a.id)?.totales;
    if (!objeto(t) || typeof t.total !== "number") return [];
    out.push({ ...a, totales: t as unknown as TotalesPresupuesto });
  }
  return out;
}

/** Sólo la definición (sin totales), para el editor. */
export function definicionDe(a: Alternativa): Alternativa {
  return { id: a.id, nombre: a.nombre, descripcion: a.descripcion, masElegida: a.masElegida };
}

/** La opción que eligió el cliente al aceptar, o null. */
export function alternativaElegidaId(totals: unknown): string | null {
  if (!objeto(totals) || typeof totals.alternativaElegidaId !== "string") return null;
  const id = totals.alternativaElegidaId;
  return alternativasGuardadas(totals).some((a) => a.id === id) ? id : null;
}

/**
 * Los ítems que valen de una versión: sin opciones, todos; aceptada, los de la elegida; con
 * opciones y sin aceptar (no debería pasar al crear un pedido), los de la principal.
 * Sirve tanto para los ítems validados como para el JSON crudo de la base.
 */
export function itemsQueValen<T>(items: readonly T[], totals: unknown): T[] {
  const alternativas = alternativasGuardadas(totals);
  if (alternativas.length === 0) return [...items];
  const id = alternativaElegidaId(totals) ?? alternativaPrincipal(alternativas)!.id;
  return items.filter((i) => objeto(i) && i.alternativaId === id);
}

/** Las opciones de pago congeladas de una opción del presupuesto (o las de arriba si no hay por opción). */
export function pagoDeAlternativa(paymentOptions: unknown, alternativaId: string): unknown {
  if (!objeto(paymentOptions)) return paymentOptions;
  const por = paymentOptions.porAlternativa;
  if (objeto(por) && objeto(por[alternativaId])) return por[alternativaId];
  return paymentOptions;
}

/**
 * Lo que se escribe al aceptar una opción: totales, opciones de pago y costos de arriba pasan a ser
 * los de la elegida; se conservan la oferta completa (`alternativas`, `porAlternativa`) y el costo
 * de cada renglón. null si la opción no existe.
 */
export function fijarAlternativa(
  v: { totals: unknown; paymentOptions: unknown; costSnapshot: unknown },
  alternativaId: string,
): { totals: Record<string, unknown>; paymentOptions: unknown; costSnapshot: unknown } | null {
  const alternativas = alternativasGuardadas(v.totals);
  const a = alternativas.find((x) => x.id === alternativaId);
  if (!a || !objeto(v.totals)) return null;
  const t = v.totals;
  const totals = {
    ...a.totales,
    renglones: objeto(t.renglones) ? t.renglones : a.totales.renglones,
    descuento: t.descuento ?? null,
    alternativas: t.alternativas,
    alternativaElegidaId: a.id,
  };
  let paymentOptions = v.paymentOptions;
  if (objeto(v.paymentOptions) && objeto(v.paymentOptions.porAlternativa) && objeto(v.paymentOptions.porAlternativa[a.id])) {
    paymentOptions = { ...(v.paymentOptions.porAlternativa[a.id] as Record<string, unknown>), porAlternativa: v.paymentOptions.porAlternativa };
  }
  let costSnapshot = v.costSnapshot;
  if (objeto(v.costSnapshot) && objeto(v.costSnapshot.alternativas) && objeto(v.costSnapshot.alternativas[a.id])) {
    costSnapshot = {
      ...(v.costSnapshot.alternativas[a.id] as Record<string, unknown>),
      porItem: v.costSnapshot.porItem,
      alternativas: v.costSnapshot.alternativas,
    };
  }
  return { totals, paymentOptions, costSnapshot };
}

/**
 * La opción que elige el cliente al aceptar, validada contra lo guardado. Sin opciones, null (y
 * no tiene que elegir nada). Con una sola, ésa aunque no la mande. Con varias, una que exista.
 */
export function alternativaAceptada(totals: unknown, elegida: unknown): ResultadoValidacion<string | null> {
  const alternativas = alternativasGuardadas(totals);
  if (alternativas.length === 0) return { ok: true, valor: null };
  if (typeof elegida === "string" && alternativas.some((a) => a.id === elegida)) return { ok: true, valor: elegida };
  if ((elegida === undefined || elegida === null || elegida === "") && alternativas.length === 1) return { ok: true, valor: alternativas[0]!.id };
  return { ok: false, error: MENSAJES_ALTERNATIVAS.elegir };
}

/** El total para mostrar en un mensaje: el único o, con opciones, «desde» el más barato. */
export function totalParaMensaje(totals: unknown, formato: (n: number) => string): string {
  const alternativas = alternativasGuardadas(totals);
  const total = objeto(totals) && typeof totals.total === "number" ? totals.total : 0;
  if (alternativas.length < 2 || alternativaElegidaId(totals)) return formato(total);
  return `desde ${formato(Math.min(...alternativas.map((a) => a.totales.total)))}`;
}

// --- Operaciones del editor ---------------------------------------------------------------------------

let contador = 0;
export function nuevaClaveAlternativa(): string {
  contador += 1;
  return `op${Date.now().toString(36)}${contador.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Un nombre que todavía no está («Opción 2», «Opción 3»…). */
export function nombreLibre(alternativas: readonly Alternativa[]): string {
  const usados = new Set(alternativas.map((a) => a.nombre.toLocaleLowerCase("es")));
  for (let n = alternativas.length + 1; ; n++) {
    const nombre = `Opción ${n}`;
    if (!usados.has(nombre.toLocaleLowerCase("es"))) return nombre;
  }
}

type Estado = { alternativas: Alternativa[]; items: ItemPresupuesto[] };

/**
 * Agrega una opción. La primera vez (sin opciones) arma DOS: la «Opción 1» con todos los ítems que
 * ya había y una «Opción 2» vacía. Con 4, no hace nada.
 */
export function agregarAlternativa(e: Estado, clave: () => string = nuevaClaveAlternativa): Estado & { nueva: string | null } {
  if (e.alternativas.length >= MAX_ALTERNATIVAS) return { ...e, nueva: null };
  if (e.alternativas.length === 0) {
    const primera: Alternativa = { id: clave(), nombre: "Opción 1", descripcion: null, masElegida: false };
    const segunda: Alternativa = { id: clave(), nombre: "Opción 2", descripcion: null, masElegida: false };
    return { alternativas: [primera, segunda], items: e.items.map((i) => ({ ...i, alternativaId: primera.id })), nueva: segunda.id };
  }
  const nueva: Alternativa = { id: clave(), nombre: nombreLibre(e.alternativas), descripcion: null, masElegida: false };
  return { alternativas: [...e.alternativas, nueva], items: e.items, nueva: nueva.id };
}

/** Borra una opción y sus ítems. Si queda una sola, se vuelve un presupuesto común (sin opciones). */
export function quitarAlternativa(e: Estado, id: string): Estado {
  const alternativas = e.alternativas.filter((a) => a.id !== id);
  const items = e.items.filter((i) => i.alternativaId !== id);
  if (alternativas.length <= 1) return { alternativas: [], items: asignarItems(items, []) };
  return { alternativas, items };
}

/** Cambia de lugar una opción (el orden es el que ve el cliente). */
export function moverAlternativa(alternativas: readonly Alternativa[], id: string, paso: -1 | 1): Alternativa[] {
  const i = alternativas.findIndex((a) => a.id === id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= alternativas.length) return [...alternativas];
  const copia = [...alternativas];
  [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  return copia;
}

/** Marca (o desmarca) «la más elegida»: marcar una desmarca las demás. */
export function marcarMasElegida(alternativas: readonly Alternativa[], id: string, marcada: boolean): Alternativa[] {
  return alternativas.map((a) => ({ ...a, masElegida: a.id === id ? marcada : marcada ? false : a.masElegida }));
}

export function moverItemA(items: readonly ItemPresupuesto[], itemId: string, alternativaId: string): ItemPresupuesto[] {
  return items.map((i) => (i.id === itemId ? { ...i, alternativaId } : i));
}

/** Copia un ítem a otra opción, con clave nueva, justo al final de esa opción. */
export function copiarItemA(items: readonly ItemPresupuesto[], itemId: string, alternativaId: string, clave: string): ItemPresupuesto[] {
  const it = items.find((i) => i.id === itemId);
  if (!it) return [...items];
  const copia: ItemPresupuesto = JSON.parse(JSON.stringify({ ...it, id: clave, alternativaId })) as ItemPresupuesto;
  let ultimo = -1;
  items.forEach((i, k) => {
    if (i.alternativaId === alternativaId) ultimo = k;
  });
  const out = [...items];
  out.splice(ultimo < 0 ? out.length : ultimo + 1, 0, copia);
  return out;
}
