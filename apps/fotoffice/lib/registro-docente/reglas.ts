/**
 * Reglas del Registro docente, en cascada: modelo → escuela → curso → estudiante.
 *
 * Cada nivel guarda SÓLO lo que cambia respecto del de arriba (`{ [clave]: valor }`). Para saber
 * qué regla se aplica a un estudiante se mira primero lo suyo, después el curso, después la
 * escuela y al final el modelo que eligió la escuela. Borrar una clave de un nivel es «volver a la
 * regla de arriba».
 *
 * Todo es puro (sin base ni Next) y se usa también desde pantallas cliente.
 */

export type Nivel = "modelo" | "escuela" | "curso" | "estudiante";

export type Periodo = {
  /** Estable: las evaluaciones y notas lo guardan. No cambia aunque se renombre el período. */
  clave: string;
  nombre: string;
  /** Fechas ISO «AAAA-MM-DD». Opcionales: la docente las completa con el Calendario Escolar. */
  desde?: string | null;
  hasta?: string | null;
  /** Días habilitados para cargar en la plataforma oficial («Carga desde / hasta» de Mi Escuela). */
  cargaDesde?: string | null;
  cargaHasta?: string | null;
};

export const CATEGORIAS = ["examen", "trabajos", "carpeta", "participacion"] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export type Pesos = Record<Categoria, number>;

export const CATEGORIA_ETIQUETA: Record<Categoria, string> = {
  examen: "Exámenes",
  trabajos: "Trabajos prácticos",
  carpeta: "Carpeta",
  participacion: "Participación",
};

export type Redondeo = "mitad-arriba" | "abajo" | "arriba";
export type Recuperatorio = "promedia" | "reemplaza" | "mejor";
export type Destino = "mi-escuela-santa-fe" | "planilla-propia" | "ninguno";

export type Reglas = {
  periodos: Periodo[];
  notaMinima: number;
  notaMaxima: number;
  decimales: boolean;
  notaAprobacion: number;
  /** Cómo se lleva una nota con decimales al entero que pide la plataforma oficial. */
  redondeo: Redondeo;
  pesos: Pesos;
  recuperatorio: Recuperatorio;
  /** null = sin límite. */
  limiteFaltas: number | null;
  /** Cuánta falta suma cada llegada tarde (0, 0,25, 0,5…). */
  faltaPorTarde: number;
  /** Cuánta falta suma retirarse antes. */
  faltaPorRetiro: number;
  /** Si la inasistencia justificada cuenta para el límite. */
  justificadaCuenta: boolean;
  destino: Destino;
  /** Proyecto pedagógico individual o adecuaciones. Reservado: sólo lo ve la docente. */
  ppi: boolean;
};

export type ClaveRegla = keyof Reglas;
export type CambiosDeReglas = Partial<Reglas>;

export type Modelo = { clave: string; nombre: string; descripcion: string; reglas: Reglas };

const TRIMESTRES: Periodo[] = [
  { clave: "T1", nombre: "1.er trimestre" },
  { clave: "T2", nombre: "2.º trimestre" },
  { clave: "T3", nombre: "3.er trimestre" },
];

const PESOS_IGUALES: Pesos = { examen: 25, trabajos: 25, carpeta: 25, participacion: 25 };

export const MODELOS: readonly Modelo[] = [
  {
    clave: "santa-fe-secundaria",
    nombre: "Santa Fe secundaria (Mi Escuela)",
    descripcion:
      "Trimestres, escala del 1 al 10 en enteros y carga de notas en Mi Escuela. Las fechas de cada trimestre salen del Calendario Escolar de Mi Escuela.",
    reglas: {
      periodos: TRIMESTRES,
      notaMinima: 1,
      notaMaxima: 10,
      decimales: false,
      notaAprobacion: 6,
      redondeo: "mitad-arriba",
      pesos: PESOS_IGUALES,
      recuperatorio: "reemplaza",
      limiteFaltas: null,
      faltaPorTarde: 0,
      faltaPorRetiro: 0,
      justificadaCuenta: true,
      destino: "mi-escuela-santa-fe",
      ppi: false,
    },
  },
  {
    clave: "general",
    nombre: "General (planilla propia)",
    descripcion: "Trimestres, escala del 1 al 10 y una planilla propia, sin plataforma oficial.",
    reglas: {
      periodos: TRIMESTRES,
      notaMinima: 1,
      notaMaxima: 10,
      decimales: true,
      notaAprobacion: 6,
      redondeo: "mitad-arriba",
      pesos: PESOS_IGUALES,
      recuperatorio: "reemplaza",
      limiteFaltas: null,
      faltaPorTarde: 0,
      faltaPorRetiro: 0,
      justificadaCuenta: true,
      destino: "planilla-propia",
      ppi: false,
    },
  },
];

export function modeloDe(clave: string | null | undefined): Modelo {
  return MODELOS.find((m) => m.clave === clave) ?? MODELOS[0];
}

export type DefinicionRegla = {
  clave: ClaveRegla;
  etiqueta: string;
  ayuda?: string;
  /** Niveles donde se puede cambiar (siempre se puede en la escuela). */
  niveles: readonly Exclude<Nivel, "modelo">[];
};

const TODOS = ["escuela", "curso", "estudiante"] as const;
const SIN_ESTUDIANTE = ["escuela", "curso"] as const;

export const DEFINICIONES: readonly DefinicionRegla[] = [
  { clave: "periodos", etiqueta: "Períodos", ayuda: "Trimestres, cuatrimestres o los que use la escuela, con sus fechas.", niveles: SIN_ESTUDIANTE },
  { clave: "decimales", etiqueta: "Notas con decimales", niveles: TODOS },
  { clave: "notaMinima", etiqueta: "Nota más baja de la escala", niveles: SIN_ESTUDIANTE },
  { clave: "notaMaxima", etiqueta: "Nota más alta de la escala", niveles: SIN_ESTUDIANTE },
  { clave: "notaAprobacion", etiqueta: "Se aprueba con", niveles: TODOS },
  { clave: "redondeo", etiqueta: "Redondeo para la planilla oficial", ayuda: "Cómo pasa una nota con decimales al entero de la plataforma.", niveles: SIN_ESTUDIANTE },
  { clave: "pesos", etiqueta: "Peso de cada tipo de evaluación (%)", niveles: TODOS },
  { clave: "recuperatorio", etiqueta: "Qué hace el recuperatorio", niveles: TODOS },
  { clave: "limiteFaltas", etiqueta: "Límite de faltas", ayuda: "Vacío: sin límite.", niveles: TODOS },
  { clave: "faltaPorTarde", etiqueta: "Falta que suma cada llegada tarde", ayuda: "0 = no suma; 0,5 = media falta.", niveles: TODOS },
  { clave: "faltaPorRetiro", etiqueta: "Falta que suma retirarse antes", niveles: TODOS },
  { clave: "justificadaCuenta", etiqueta: "La falta justificada cuenta para el límite", niveles: TODOS },
  { clave: "destino", etiqueta: "Adónde van las notas", niveles: SIN_ESTUDIANTE },
  { clave: "ppi", etiqueta: "PPI o adecuaciones (reservado)", ayuda: "Sólo lo ve la docente.", niveles: ["estudiante"] },
];

export const DESTINO_ETIQUETA: Record<Destino, string> = {
  "mi-escuela-santa-fe": "Mi Escuela (Santa Fe)",
  "planilla-propia": "Planilla propia",
  ninguno: "Ninguno",
};

export const RECUPERATORIO_ETIQUETA: Record<Recuperatorio, string> = {
  promedia: "Se promedia con la nota original",
  reemplaza: "Reemplaza la nota original",
  mejor: "Queda la mejor de las dos",
};

export const REDONDEO_ETIQUETA: Record<Redondeo, string> = {
  "mitad-arriba": "Desde ,50 sube (6,50 → 7)",
  abajo: "Siempre baja (6,90 → 6)",
  arriba: "Siempre sube (6,10 → 7)",
};

export type Origen = Nivel;
export type ReglasResueltas = { valores: Reglas; origen: Record<ClaveRegla, Origen> };

export type CadenaDeReglas = {
  modelo: string | null | undefined;
  escuela?: unknown;
  curso?: unknown;
  estudiante?: unknown;
};

/**
 * La regla que se aplica, y de qué nivel sale. El estudiante pisa al curso, el curso a la escuela
 * y la escuela al modelo. Un valor inválido guardado en un nivel se ignora (se sigue hacia arriba),
 * así un dato roto nunca deja a un curso sin regla.
 */
export function resolverReglas(cadena: CadenaDeReglas): ReglasResueltas {
  const base = modeloDe(cadena.modelo).reglas;
  const valores = { ...base } as Reglas;
  const origen = Object.fromEntries(Object.keys(base).map((k) => [k, "modelo"])) as Record<ClaveRegla, Origen>;
  const niveles: [Exclude<Nivel, "modelo">, unknown][] = [
    ["escuela", cadena.escuela],
    ["curso", cadena.curso],
    ["estudiante", cadena.estudiante],
  ];
  for (const [nivel, crudo] of niveles) {
    const cambios = sanearCambios(crudo, nivel);
    for (const clave of Object.keys(cambios) as ClaveRegla[]) {
      (valores as Record<string, unknown>)[clave] = cambios[clave];
      origen[clave] = nivel;
    }
  }
  return { valores, origen };
}

export function resolverRegla<K extends ClaveRegla>(cadena: CadenaDeReglas, clave: K): { valor: Reglas[K]; origen: Origen } {
  const r = resolverReglas(cadena);
  return { valor: r.valores[clave], origen: r.origen[clave] };
}

/** Lo que vale la regla un nivel más arriba: es lo que vuelve si se borra el cambio. */
export function reglasDeArriba(cadena: CadenaDeReglas, nivel: Exclude<Nivel, "modelo">): ReglasResueltas {
  if (nivel === "escuela") return resolverReglas({ modelo: cadena.modelo });
  if (nivel === "curso") return resolverReglas({ modelo: cadena.modelo, escuela: cadena.escuela });
  return resolverReglas({ modelo: cadena.modelo, escuela: cadena.escuela, curso: cadena.curso });
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const fechaOpcional = (v: unknown) => v === undefined || v === null || (typeof v === "string" && FECHA_ISO.test(v));

function periodosValidos(v: unknown): v is Periodo[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > 12) return false;
  const claves = new Set<string>();
  for (const p of v) {
    if (!esObjeto(p)) return false;
    if (typeof p.clave !== "string" || !/^[A-Z0-9]{1,8}$/.test(p.clave) || p.clave === "FINAL") return false;
    if (typeof p.nombre !== "string" || !p.nombre.trim() || p.nombre.length > 60) return false;
    if (![p.desde, p.hasta, p.cargaDesde, p.cargaHasta].every(fechaOpcional)) return false;
    if (claves.has(p.clave)) return false;
    claves.add(p.clave);
  }
  return true;
}

function pesosValidos(v: unknown): v is Pesos {
  if (!esObjeto(v)) return false;
  const suma = CATEGORIAS.reduce((s, c) => s + (esNumero(v[c]) ? (v[c] as number) : NaN), 0);
  return CATEGORIAS.every((c) => esNumero(v[c]) && (v[c] as number) >= 0 && (v[c] as number) <= 100) && suma > 0;
}

/** Si un valor sirve para una regla. Lo usan el resolvedor y las acciones que guardan. */
export function valorValido(clave: ClaveRegla, v: unknown): boolean {
  switch (clave) {
    case "periodos":
      return periodosValidos(v);
    case "notaMinima":
    case "notaMaxima":
    case "notaAprobacion":
      return esNumero(v) && v >= 0 && v <= 100;
    case "decimales":
    case "justificadaCuenta":
    case "ppi":
      return typeof v === "boolean";
    case "redondeo":
      return v === "mitad-arriba" || v === "abajo" || v === "arriba";
    case "recuperatorio":
      return v === "promedia" || v === "reemplaza" || v === "mejor";
    case "destino":
      return v === "mi-escuela-santa-fe" || v === "planilla-propia" || v === "ninguno";
    case "pesos":
      return pesosValidos(v);
    case "limiteFaltas":
      return v === null || (esNumero(v) && v >= 0 && v <= 365);
    case "faltaPorTarde":
    case "faltaPorRetiro":
      return esNumero(v) && v >= 0 && v <= 1;
    default:
      return false;
  }
}

/** Quita de lo guardado en un nivel lo que no es una regla, no vale o no se puede cambiar ahí. */
export function sanearCambios(crudo: unknown, nivel: Exclude<Nivel, "modelo">): CambiosDeReglas {
  if (!esObjeto(crudo)) return {};
  const out: Record<string, unknown> = {};
  for (const def of DEFINICIONES) {
    if (!(def.clave in crudo)) continue;
    if (!def.niveles.includes(nivel)) continue;
    const v = crudo[def.clave];
    if (valorValido(def.clave, v)) out[def.clave] = v;
  }
  return out as CambiosDeReglas;
}

/** Guarda (o borra, con `undefined`) el cambio de una regla en un nivel. Devuelve un objeto nuevo. */
export function aplicarCambio(
  crudo: unknown,
  nivel: Exclude<Nivel, "modelo">,
  clave: ClaveRegla,
  valor: unknown,
): CambiosDeReglas {
  const actuales: Record<string, unknown> = { ...sanearCambios(crudo, nivel) };
  if (valor === undefined) {
    delete actuales[clave];
    return actuales as CambiosDeReglas;
  }
  const def = DEFINICIONES.find((d) => d.clave === clave);
  if (!def || !def.niveles.includes(nivel)) throw new Error(`La regla ${clave} no se puede cambiar en ${nivel}.`);
  if (!valorValido(clave, valor)) throw new Error(`Valor inválido para ${clave}.`);
  actuales[clave] = valor;
  return actuales as CambiosDeReglas;
}

/** Próxima clave libre para un período nuevo («P4», «P5»…), sin reusar ninguna existente. */
export function claveDePeriodoNueva(periodos: readonly Periodo[]): string {
  const usadas = new Set(periodos.map((p) => p.clave));
  for (let i = usadas.size + 1; i < 100; i++) {
    const c = `P${i}`;
    if (!usadas.has(c)) return c;
  }
  throw new Error("Demasiados períodos.");
}

export const ORIGEN_ETIQUETA: Record<Origen, string> = {
  modelo: "del modelo",
  escuela: "de la escuela",
  curso: "cambiado en este curso",
  estudiante: "cambiado para este estudiante",
};
