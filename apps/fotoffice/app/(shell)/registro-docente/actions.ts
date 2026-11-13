"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contextoRegistro } from "@/lib/registro-docente/contexto";
import * as S from "@/lib/registro-docente/servidor";
import { DEFINICIONES, MODELOS, resolverReglas, type ClaveRegla, type Nivel } from "@/lib/registro-docente/reglas";
import { fechaOpcional, getterDe, leerValorRegla, opcional } from "@/lib/registro-docente/formulario";
import { leerPadron } from "@/lib/registro-docente/padron";
import { esEspecialPeriodo, esTipoEvaluacion, type EspecialPeriodo } from "@/lib/registro-docente/notas";

/**
 * Formularios del Registro docente. Sin permiso vuelve al tablero; con datos inválidos vuelve a la
 * misma pantalla con `?error=`, como Eventos.
 */

const BASE = "/registro-docente";

async function ctxManage() {
  const ctx = await contextoRegistro("MANAGE");
  if (!ctx) redirect("/dashboard");
  return ctx;
}

function volver(ruta: string, aviso?: { error?: string; ok?: string }): never {
  revalidatePath(BASE, "layout");
  const p = aviso?.error ? `error=${encodeURIComponent(aviso.error)}` : aviso?.ok ? `ok=${encodeURIComponent(aviso.ok)}` : "";
  redirect(p ? `${ruta}${ruta.includes("?") ? "&" : "?"}${p}` : ruta);
}

/** La ruta de vuelta la manda el formulario; sólo se aceptan pantallas de este módulo. */
function rutaDe(fd: FormData, fallback: string): string {
  const r = fd.get("volver");
  return typeof r === "string" && /^\/registro-docente(\/[\w-]+)*(\?[\w=&%.+-]*)?$/.test(r) ? r : fallback;
}

// ── Escuelas ─────────────────────────────────────────────────────────────────────────────────

function datosEscuela(fd: FormData) {
  const g = getterDe(fd);
  const modelo = MODELOS.some((m) => m.clave === g("modelo")) ? g("modelo") : MODELOS[0].clave;
  return { nombre: g("nombre").slice(0, 120), numero: opcional(g("numero"), 20), cue: opcional(g("cue"), 20), localidad: opcional(g("localidad"), 80), modelo };
}

export async function crearEscuelaAction(fd: FormData) {
  const ctx = await ctxManage();
  const d = datosEscuela(fd);
  if (!d.nombre) volver(BASE, { error: "Poné el nombre de la escuela." });
  const id = await S.crearEscuela(ctx.workspaceId, d);
  volver(`${BASE}/escuelas/${id}`, { ok: "Escuela creada. Revisá sus reglas: los cursos las heredan." });
}

export async function editarEscuelaAction(fd: FormData) {
  const ctx = await ctxManage();
  const id = getterDe(fd)("escuelaId");
  const d = datosEscuela(fd);
  if (!d.nombre) volver(`${BASE}/escuelas/${id}`, { error: "Poné el nombre de la escuela." });
  await S.editarEscuela(ctx.workspaceId, id, d);
  volver(`${BASE}/escuelas/${id}`, { ok: "Guardado." });
}

// ── Reglas en cascada ────────────────────────────────────────────────────────────────────────

export async function guardarReglaAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const nivel = g("nivel") as Exclude<Nivel, "modelo">;
  const id = g("id");
  const clave = g("clave") as ClaveRegla;
  const ruta = rutaDe(fd, BASE);
  const def = DEFINICIONES.find((d) => d.clave === clave);
  if (!def || !(["escuela", "curso", "estudiante"] as const).includes(nivel) || !def.niveles.includes(nivel)) {
    volver(ruta, { error: "Esa regla no se puede cambiar acá." });
  }
  if (g("quitar") === "1") {
    await S.guardarRegla(ctx.workspaceId, nivel, id, clave, undefined);
    volver(ruta, { ok: `«${def.etiqueta}» volvió a la regla de arriba.` });
  }
  // Para los períodos hace falta saber cuáles hay, así un período nuevo no repite una clave.
  const periodos = await periodosVigentes(ctx.workspaceId, nivel, id);
  const r = leerValorRegla(clave, g, { periodos });
  if (!r.ok) volver(ruta, { error: r.error });
  try {
    await S.guardarRegla(ctx.workspaceId, nivel, id, clave, r.valor);
  } catch {
    volver(ruta, { error: "No se pudo guardar esa regla." });
  }
  volver(ruta, { ok: `«${def.etiqueta}» guardado.` });
}

async function periodosVigentes(workspaceId: string, nivel: Exclude<Nivel, "modelo">, id: string) {
  if (nivel === "escuela") {
    const e = await S.obtenerEscuela(workspaceId, id);
    return e ? resolverReglas({ modelo: e.modelo, escuela: e.reglas }).valores.periodos : [];
  }
  if (nivel === "curso") {
    const c = await S.obtenerCurso(workspaceId, id);
    return c ? c.reglas.valores.periodos : [];
  }
  return [];
}

// ── Cursos ───────────────────────────────────────────────────────────────────────────────────

function datosCurso(fd: FormData): S.DatosCurso | null {
  const g = getterDe(fd);
  const ciclo = Number(g("cicloLectivo"));
  const d = {
    cicloLectivo: Number.isInteger(ciclo) && ciclo >= 2000 && ciclo <= 2100 ? ciclo : new Date().getFullYear(),
    anio: g("anio").slice(0, 20),
    division: opcional(g("division"), 20),
    turno: opcional(g("turno"), 30),
    materia: g("materia").slice(0, 80),
  };
  return d.anio && d.materia ? d : null;
}

export async function crearCursoAction(fd: FormData) {
  const ctx = await ctxManage();
  const escuelaId = getterDe(fd)("escuelaId");
  const ruta = rutaDe(fd, BASE);
  const d = datosCurso(fd);
  if (!d) volver(ruta, { error: "El curso necesita el año y la materia." });
  try {
    const id = await S.crearCurso(ctx.workspaceId, escuelaId, d);
    volver(`${BASE}/cursos/${id}`, { ok: "Curso creado. Ahora pegá el padrón." });
  } catch (e) {
    if (e instanceof Error && e.message === "NO_EXISTE") volver(ruta, { error: "No existe esa escuela." });
    throw e;
  }
}

export async function editarCursoAction(fd: FormData) {
  const ctx = await ctxManage();
  const id = getterDe(fd)("cursoId");
  const d = datosCurso(fd);
  if (!d) volver(`${BASE}/cursos/${id}/datos`, { error: "El curso necesita el año y la materia." });
  await S.editarCurso(ctx.workspaceId, id, { ...d, archivado: fd.get("archivado") === "on" });
  volver(fd.get("archivado") === "on" ? BASE : `${BASE}/cursos/${id}`, { ok: "Guardado." });
}

// ── Padrón ───────────────────────────────────────────────────────────────────────────────────

export async function pegarPadronAction(fd: FormData) {
  const ctx = await ctxManage();
  const cursoId = getterDe(fd)("cursoId");
  const ruta = `${BASE}/cursos/${cursoId}`;
  const texto = String(fd.get("padron") ?? "").slice(0, 60_000);
  const { filas } = leerPadron(texto);
  if (!filas.length) volver(ruta, { error: "No se encontró ningún estudiante en lo que pegaste." });
  const r = await S.agregarEstudiantes(ctx.workspaceId, cursoId, filas);
  volver(ruta, {
    ok: `Se agregaron ${r.agregados} ${r.agregados === 1 ? "estudiante" : "estudiantes"}.${r.repetidos ? ` ${r.repetidos} ya estaban.` : ""}`,
  });
}

export async function editarEstudianteAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const id = g("estudianteId");
  const ruta = rutaDe(fd, BASE);
  const orden = Number(g("orden"));
  const d: S.DatosEstudiante = {
    apellido: g("apellido").slice(0, 80),
    nombre: g("nombre").slice(0, 80),
    dni: opcional(g("dni").replace(/\D/g, ""), 12),
    orden: Number.isInteger(orden) && orden > 0 ? orden : 1,
    condicion: g("condicion") === "NR" ? "NR" : "R",
    altaAt: fechaOpcional(g("altaAt")),
    bajaAt: fechaOpcional(g("bajaAt")),
    bajaMotivo: opcional(g("bajaMotivo"), 120),
    notaPrivada: opcional(g("notaPrivada"), 2000),
  };
  if (!d.apellido) volver(ruta, { error: "Falta el apellido." });
  await S.editarEstudiante(ctx.workspaceId, id, d);
  volver(ruta, { ok: "Guardado." });
}

export async function borrarEstudianteAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const cursoId = g("cursoId");
  const r = await S.borrarEstudiante(ctx.workspaceId, g("estudianteId"));
  if (r === "tiene-datos") {
    volver(`${BASE}/cursos/${cursoId}/estudiantes/${g("estudianteId")}`, {
      error: "Tiene asistencia o notas: en vez de borrarlo, ponele fecha de baja.",
    });
  }
  volver(`${BASE}/cursos/${cursoId}`, { ok: "Estudiante borrado." });
}

// ── Evaluaciones ─────────────────────────────────────────────────────────────────────────────

function datosEvaluacion(fd: FormData): S.DatosEvaluacion | null {
  const g = getterDe(fd);
  const max = Number(g("notaMaxima").replace(",", ".") || "10");
  const tipo = g("tipo");
  if (!esTipoEvaluacion(tipo)) return null;
  const d = {
    titulo: g("titulo").slice(0, 120),
    tipo,
    fecha: fechaOpcional(g("fecha")),
    periodo: g("periodo"),
    notaMaxima: Number.isFinite(max) && max > 0 && max <= 1000 ? max : 10,
    recuperaAId: opcional(g("recuperaAId"), 40),
    descripcion: opcional(g("descripcion"), 1000),
  };
  return d.titulo && d.periodo ? d : null;
}

export async function crearEvaluacionAction(fd: FormData) {
  const ctx = await ctxManage();
  const cursoId = getterDe(fd)("cursoId");
  const ruta = rutaDe(fd, `${BASE}/cursos/${cursoId}/notas`);
  const d = datosEvaluacion(fd);
  if (!d) volver(ruta, { error: "La evaluación necesita un nombre, un tipo y un período." });
  await S.crearEvaluacion(ctx.workspaceId, cursoId, d);
  volver(ruta, { ok: "Evaluación creada." });
}

export async function editarEvaluacionAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const ruta = rutaDe(fd, BASE);
  if (g("borrar") === "1") {
    if (g("confirmarBorrado") !== "on") volver(ruta, { error: "Para borrar una evaluación, tildá «Sí, borrarla»." });
    await S.borrarEvaluacion(ctx.workspaceId, g("evaluacionId"));
    volver(ruta, { ok: "Evaluación borrada, con sus notas." });
  }
  const d = datosEvaluacion(fd);
  if (!d) volver(ruta, { error: "La evaluación necesita un nombre, un tipo y un período." });
  await S.editarEvaluacion(ctx.workspaceId, g("evaluacionId"), d);
  volver(ruta, { ok: "Guardado." });
}

/** Una celda de la planilla. La llama la planilla (cliente) sin recargar la página. */
export async function guardarCeldaAction(input: { evaluacionId: string; estudianteId: string; texto: string }) {
  const ctx = await contextoRegistro("MANAGE");
  if (!ctx) return { ok: false as const, error: "No tenés permiso para cargar notas." };
  // Sin revalidar a propósito: todas las pantallas del módulo son dinámicas, y re-dibujar la
  // página por cada celda hacía que las notas se encolaran y se perdieran al salir.
  return S.guardarCelda(ctx.workspaceId, input.evaluacionId, input.estudianteId, String(input.texto ?? "").slice(0, 20));
}

// ── Notas de período ─────────────────────────────────────────────────────────────────────────

const numeroONull = (s: string): number | null => {
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
};

export async function guardarNotaPeriodoAction(input: {
  cursoId: string;
  estudianteId: string;
  periodo: string;
  final: string;
  especial: string;
  motivo: string;
  sugerida: number | null;
}) {
  const ctx = await contextoRegistro("MANAGE");
  if (!ctx) return { ok: false as const, error: "No tenés permiso." };
  const especial: EspecialPeriodo | null = esEspecialPeriodo(input.especial) ? input.especial : null;
  const final = especial ? null : numeroONull(String(input.final ?? "").trim());
  if (!especial && String(input.final ?? "").trim() && final === null) return { ok: false as const, error: "Esa nota no es un número válido." };
  try {
    await S.guardarNotaPeriodo(ctx.workspaceId, {
      cursoId: input.cursoId,
      estudianteId: input.estudianteId,
      periodo: String(input.periodo).slice(0, 10),
      final,
      especial,
      motivo: opcional(String(input.motivo ?? ""), 300),
      sugerida: typeof input.sugerida === "number" && Number.isFinite(input.sugerida) ? input.sugerida : null,
    });
  } catch {
    return { ok: false as const, error: "No se pudo guardar." };
  }
  return { ok: true as const };
}

/** Pone la sugerida como nota final a todos los que todavía no tienen una. */
export async function confirmarSugeridasAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const cursoId = g("cursoId");
  const periodo = g("periodo");
  const ruta = `${BASE}/cursos/${cursoId}/periodo/${periodo}`;
  const curso = await S.obtenerCurso(ctx.workspaceId, cursoId);
  if (!curso) volver(BASE, { error: "No existe ese curso." });
  const { filas } = await S.notasDelPeriodo(curso, periodo);
  const activos = new Set(curso.estudiantes.filter((e) => !e.bajaAt).map((e) => e.id));
  let n = 0;
  for (const f of filas) {
    if (f.confirmada || f.calculo.sugerida === null || !activos.has(f.estudianteId)) continue;
    await S.guardarNotaPeriodo(ctx.workspaceId, {
      cursoId,
      estudianteId: f.estudianteId,
      periodo,
      final: f.calculo.sugerida,
      especial: null,
      motivo: null,
      sugerida: f.calculo.sugerida,
    });
    n++;
  }
  volver(ruta, { ok: n ? `Se pusieron ${n} notas sugeridas. Revisalas: las podés cambiar.` : "No había notas sugeridas para poner." });
}

export async function marcarPasadaAction(input: { cursoId: string; estudianteId: string; periodo: string; pasada: boolean }) {
  const ctx = await contextoRegistro("MANAGE");
  if (!ctx) return { ok: false as const };
  await S.marcarPasada(ctx.workspaceId, input.cursoId, input.estudianteId, input.periodo, Boolean(input.pasada));
  return { ok: true as const };
}

export async function confirmarPeriodoAction(fd: FormData) {
  const ctx = await ctxManage();
  const g = getterDe(fd);
  const cursoId = g("cursoId");
  const periodo = g("periodo");
  await S.marcarPeriodoConfirmado(ctx.workspaceId, cursoId, periodo, g("confirmado") === "1");
  volver(`${BASE}/cursos/${cursoId}/periodo/${periodo}`, {
    ok: g("confirmado") === "1" ? "Período marcado como confirmado en Mi Escuela." : "Se quitó la marca de confirmado.",
  });
}
