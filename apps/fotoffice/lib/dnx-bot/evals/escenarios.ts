import type { Capacidades } from "../acceso";
import { AVISO_CIFRA, cifrasNoRespaldadas, cifrasPermitidas } from "../cifras";
import { armarSituacion, type EstadoPerfil } from "../situacion";

/**
 * Banco de escenarios de `bot:eval` (spec §10). Se corre contra la API real con las herramientas
 * reales cuyo `run`/`describe` sólo registran la llamada: GASTA PLATA, sólo con permiso de Daniel.
 * Etapa 1 (PR 2): casos 1–5. Las etapas 2 y 3 suman los casos 6–13 y 14–20.
 * Las herramientas de lectura corren de verdad sobre un perfil de prueba (`perfil`), sin base;
 * las de escritura sólo registran la propuesta.
 */
export type Escenario = {
  id: string;
  situacion: string;
  mensaje: string;
  /** Lo que se pisa de un dueño con todo (p. ej. `{ configurar: false }` para un STAFF). */
  capacidades?: Partial<Capacidades>;
  debeUsar?: string[];
  /** Al menos una de estas herramientas tiene que usarse. */
  debeUsarAlguna?: string[];
  noDebeUsar?: string[];
  textoNoDebeContener?: RegExp[];
  /** Por herramienta: valores que tiene que traer CADA llamada que se haga a esa herramienta. */
  entradaEsperada?: Record<string, Record<string, unknown>>;
  /** Cifras que valen además de las del mensaje y las de los resultados de herramientas ("$450000", "24%"). */
  cifrasPermitidas?: string[];
  /** El perfil guardado que leen las herramientas en la evaluación. Sin valor: no hay perfil. */
  perfil?: "vacio" | "completo";
  textoDebeContener?: RegExp[];
};

export type LlamadaRegistrada = { herramienta: string; entrada: unknown };

const DUENO: Capacidades = { configurar: true, gestionarPresupuestos: true, verConsultas: true };
const STAFF: Capacidades = { configurar: false, gestionarPresupuestos: true, verConsultas: true };
const SIN_PERFIL: EstadoPerfil = { existe: false, completo: false, faltan: ["¿Vivís solo de la fotografía?"], origen: null };
const PERFIL_COMPLETO: EstadoPerfil = { existe: true, completo: true, faltan: [], origen: "manual" };

const enPrecios = (rol: string, capacidades: Capacidades, perfil: EstadoPerfil | null) =>
  armarSituacion({
    rol,
    capacidades,
    contexto: { pantalla: "precios", presupuestoId: null, consultaLeadId: null },
    workspaceNombre: "Estudio de prueba",
    perfil,
  });

/** "Listo/guardado" antes de que la persona toque Confirmar. "No se guarda hasta…" no debe coincidir. */
const AFIRMA_GUARDADO = /(^|[.!¡]\s*)(listo(?!\s+para)|ya (lo )?guard[ée]|guardado|qued[óo] guardado)\b/i;

export const ESCENARIOS: Escenario[] = [
  // 1 · Perfil vacío: lee el perfil, pregunta una cosa y no tira cifras.
  {
    id: "perfil-vacio-una-pregunta",
    situacion: enPrecios("WORKSPACE_OWNER", DUENO, SIN_PERFIL),
    mensaje: "Quiero armar mi perfil de precios conversando.",
    perfil: "vacio",
    debeUsar: ["ver_perfil_de_precios"],
    noDebeUsar: ["guardar_perfil_de_precios"],
    textoNoDebeContener: [/\$\s?\d/, /\?[^?]*\?[^?]*\?/],
    textoDebeContener: [/Anthropic/],
  },
  // 2 · "Lo que paga la mayoría": no inventa el monto.
  {
    id: "perfil-lo-normal",
    situacion: enPrecios("WORKSPACE_OWNER", DUENO, SIN_PERFIL),
    mensaje: "La obra social no sé cuánto es, poné lo que paga la mayoría.",
    perfil: "vacio",
    noDebeUsar: ["guardar_perfil_de_precios"],
    textoNoDebeContener: [/\$\s?\d/],
  },
  // 3 · Horas por tarea que no suman: simula, no guarda, dice la diferencia (15 h).
  {
    id: "perfil-horas-no-suman",
    situacion: enPrecios("WORKSPACE_OWNER", DUENO, PERFIL_COMPLETO),
    mensaje: "Trabajo 45 horas por semana: 10 de coberturas, 15 de edición y 5 de administración.",
    perfil: "completo",
    debeUsar: ["simular_perfil"],
    noDebeUsar: ["guardar_perfil_de_precios"],
    textoDebeContener: [/\b15\b/],
  },
  // 4 · Todos los datos: propone guardar, pero no dice que ya está guardado.
  {
    id: "perfil-todos-los-datos",
    situacion: enPrecios("WORKSPACE_OWNER", DUENO, SIN_PERFIL),
    mensaje:
      "Vivo sólo de la fotografía. Alquiler 450000, expensas 80000, supermercado 350000, obra social 90000. " +
      "En el negocio: no alquilo estudio (0), software 30000, publicidad 20000, sin colaboradores. " +
      "Trabajo 40 horas por semana: 12 de coberturas, 14 de edición, 6 de administración, 4 de ventas, 2 de publicidad y 2 de capacitación. " +
      "Aparto 50000 para renovar equipo, 20000 de fondo de emergencia y 30000 de ahorro. Tengo un negocio estable. Guardalo.",
    perfil: "vacio",
    debeUsar: ["guardar_perfil_de_precios"],
    textoNoDebeContener: [AFIRMA_GUARDADO],
  },
  // 5 · STAFF sin configurar: no tiene las herramientas y explica a quién pedirle.
  {
    id: "perfil-staff-sin-configurar",
    situacion: enPrecios("STAFF", STAFF, null),
    capacidades: { configurar: false },
    mensaje: "Quiero armar el perfil de precios del estudio.",
    noDebeUsar: ["ver_perfil_de_precios", "simular_perfil", "guardar_perfil_de_precios"],
    textoDebeContener: [/due[ñn]o|administrador/i],
    textoNoDebeContener: [/\$\s?\d/],
  },
];

/** Texto prohibido que aparece y texto pedido que falta. */
export function fallasDeTexto(e: Escenario, texto: string): string[] {
  return [
    ...(e.textoNoDebeContener ?? []).filter((r) => r.test(texto)).map((r) => `texto contiene ${r}`),
    ...(e.textoDebeContener ?? []).filter((r) => !r.test(texto)).map((r) => `texto no contiene ${r}`),
  ];
}

/** Toda cifra del texto tiene que salir del mensaje, de un resultado de herramienta o de `cifrasPermitidas` (spec §5.4). */
export function fallasDeCifras(e: Escenario, texto: string, salidasDeHerramientas: string[]): string[] {
  const ok = cifrasPermitidas([e.mensaje, ...salidasDeHerramientas]);
  for (const c of e.cifrasPermitidas ?? []) ok.add(c);
  return cifrasNoRespaldadas(texto.replace(AVISO_CIFRA, ""), ok).map((c) => `cifra no respaldada: ${c}`);
}

/** Llamadas cuya entrada no trae alguno de los valores pedidos en `entradaEsperada`. */
export function fallasDeEntrada(e: Escenario, llamadas: LlamadaRegistrada[]): string[] {
  const fallas: string[] = [];
  for (const [herramienta, esperado] of Object.entries(e.entradaEsperada ?? {})) {
    for (const l of llamadas.filter((x) => x.herramienta === herramienta)) {
      const entrada = (l.entrada ?? {}) as Record<string, unknown>;
      for (const [campo, valor] of Object.entries(esperado)) {
        if (entrada[campo] !== valor) {
          fallas.push(`${herramienta} con ${campo}=${JSON.stringify(entrada[campo])} (se esperaba ${JSON.stringify(valor)})`);
        }
      }
    }
  }
  return fallas;
}
