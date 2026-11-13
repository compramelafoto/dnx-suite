import "server-only";
import { prisma, Prisma } from "@repo/db";
import { aplicarCambio, resolverReglas, type ClaveRegla, type Nivel, type Reglas } from "./reglas";
import { claveDeEstudiante, type FilaPadron } from "./padron";
import { esEstadoAsistencia, esHora, ganaLaNueva, type EstadoAsistencia } from "./asistencia";
import {
  calcularNotaPeriodo,
  esEspecialPeriodo,
  esTipoEvaluacion,
  leerCelda,
  sugerirNotaFinal,
  type CalculoPeriodo,
  type EspecialNota,
  type EspecialPeriodo,
  type EvaluacionParaCalculo,
  type NotaParaCalculo,
  type TipoEvaluacion,
} from "./notas";

/**
 * Lecturas y escrituras del Registro docente. Toda función recibe el `workspaceId` del contexto y
 * filtra por él: un id de otro espacio nunca encuentra nada.
 */

const num = (d: Prisma.Decimal | null | undefined): number | null => (d === null || d === undefined ? null : Number(d.toString()));
const fechaIso = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
/** «AAAA-MM-DD» → Date a medianoche UTC (las columnas son `@db.Date`). */
export function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function nombreDeCurso(c: { anio: string; division: string | null; materia: string; turno?: string | null }): string {
  return [`${c.anio}${c.division ? ` ${c.division}` : ""}`, c.materia, c.turno].filter(Boolean).join(" · ");
}

// ── Escuelas ─────────────────────────────────────────────────────────────────────────────────

export async function listarEscuelas(workspaceId: string) {
  const escuelas = await prisma.docenteEscuela.findMany({
    where: { workspaceId, archivadaAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      cursos: {
        where: { archivadoAt: null },
        orderBy: [{ cicloLectivo: "desc" }, { anio: "asc" }, { division: "asc" }],
        include: { _count: { select: { estudiantes: { where: { bajaAt: null } } } } },
      },
    },
  });
  return escuelas.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    numero: e.numero,
    modelo: e.modelo,
    cursos: e.cursos.map((c) => ({ id: c.id, nombre: nombreDeCurso(c), cicloLectivo: c.cicloLectivo, estudiantes: c._count.estudiantes })),
  }));
}

export async function crearEscuela(
  workspaceId: string,
  d: { nombre: string; numero: string | null; cue: string | null; localidad: string | null; modelo: string },
) {
  const e = await prisma.docenteEscuela.create({ data: { workspaceId, ...d }, select: { id: true } });
  return e.id;
}

export async function obtenerEscuela(workspaceId: string, id: string) {
  return prisma.docenteEscuela.findFirst({
    where: { id, workspaceId },
    include: { cursos: { where: { archivadoAt: null }, orderBy: [{ anio: "asc" }, { division: "asc" }] } },
  });
}

export async function editarEscuela(
  workspaceId: string,
  id: string,
  d: { nombre: string; numero: string | null; cue: string | null; localidad: string | null; modelo: string },
) {
  await prisma.docenteEscuela.updateMany({ where: { id, workspaceId }, data: d });
}

/** Guarda (valor) o borra (undefined = volver a la regla de arriba) una regla en un nivel. */
export async function guardarRegla(
  workspaceId: string,
  nivel: Exclude<Nivel, "modelo">,
  id: string,
  clave: ClaveRegla,
  valor: unknown,
): Promise<void> {
  if (nivel === "escuela") {
    const e = await prisma.docenteEscuela.findFirst({ where: { id, workspaceId }, select: { reglas: true } });
    if (!e) throw new Error("NO_EXISTE");
    const reglas = aplicarCambio(e.reglas, "escuela", clave, valor);
    await prisma.docenteEscuela.update({ where: { id }, data: { reglas: reglas as Prisma.InputJsonValue } });
  } else if (nivel === "curso") {
    const c = await prisma.docenteCurso.findFirst({ where: { id, workspaceId }, select: { reglas: true } });
    if (!c) throw new Error("NO_EXISTE");
    const reglas = aplicarCambio(c.reglas, "curso", clave, valor);
    await prisma.docenteCurso.update({ where: { id }, data: { reglas: reglas as Prisma.InputJsonValue } });
  } else {
    const s = await prisma.docenteEstudiante.findFirst({ where: { id, workspaceId }, select: { reglas: true } });
    if (!s) throw new Error("NO_EXISTE");
    const reglas = aplicarCambio(s.reglas, "estudiante", clave, valor);
    await prisma.docenteEstudiante.update({ where: { id }, data: { reglas: reglas as Prisma.InputJsonValue } });
  }
}

// ── Cursos ───────────────────────────────────────────────────────────────────────────────────

export type DatosCurso = {
  cicloLectivo: number;
  anio: string;
  division: string | null;
  turno: string | null;
  materia: string;
};

export async function crearCurso(workspaceId: string, escuelaId: string, d: DatosCurso) {
  const escuela = await prisma.docenteEscuela.findFirst({ where: { id: escuelaId, workspaceId }, select: { id: true } });
  if (!escuela) throw new Error("NO_EXISTE");
  const c = await prisma.docenteCurso.create({ data: { workspaceId, escuelaId, ...d }, select: { id: true } });
  return c.id;
}

export async function editarCurso(workspaceId: string, id: string, d: DatosCurso & { archivado: boolean }) {
  const { archivado, ...resto } = d;
  await prisma.docenteCurso.updateMany({ where: { id, workspaceId }, data: { ...resto, archivadoAt: archivado ? new Date() : null } });
}

export async function obtenerCurso(workspaceId: string, id: string) {
  const c = await prisma.docenteCurso.findFirst({
    where: { id, workspaceId },
    include: {
      escuela: { select: { id: true, nombre: true, numero: true, modelo: true, reglas: true } },
      estudiantes: { orderBy: [{ orden: "asc" }, { apellido: "asc" }] },
    },
  });
  if (!c) return null;
  const cadena = { modelo: c.escuela.modelo, escuela: c.escuela.reglas, curso: c.reglas };
  const reglas = resolverReglas(cadena);
  return {
    ...c,
    nombre: nombreDeCurso(c),
    cadena,
    reglas,
    confirmados: sanearConfirmados(c.confirmadoMiEscuela),
  };
}

export type CursoCompleto = NonNullable<Awaited<ReturnType<typeof obtenerCurso>>>;

function sanearConfirmados(v: unknown): Record<string, string> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([, f]) => typeof f === "string")) as Record<string, string>;
}

/** Reglas de un estudiante: las del curso más las suyas. */
export function reglasDeEstudiante(curso: CursoCompleto, estudiante: { reglas: unknown }): Reglas {
  return resolverReglas({ ...curso.cadena, estudiante: estudiante.reglas }).valores;
}

export async function marcarPeriodoConfirmado(workspaceId: string, cursoId: string, periodo: string, confirmado: boolean) {
  const c = await prisma.docenteCurso.findFirst({ where: { id: cursoId, workspaceId }, select: { confirmadoMiEscuela: true } });
  if (!c) throw new Error("NO_EXISTE");
  const actual = sanearConfirmados(c.confirmadoMiEscuela);
  if (confirmado) actual[periodo] = new Date().toISOString();
  else delete actual[periodo];
  await prisma.docenteCurso.update({ where: { id: cursoId }, data: { confirmadoMiEscuela: actual } });
}

// ── Padrón ───────────────────────────────────────────────────────────────────────────────────

/** Agrega las filas que no estén ya en el curso (por DNI, o por apellido y nombre). */
export async function agregarEstudiantes(workspaceId: string, cursoId: string, filas: readonly FilaPadron[]) {
  const curso = await prisma.docenteCurso.findFirst({
    where: { id: cursoId, workspaceId },
    select: { id: true, estudiantes: { select: { apellido: true, nombre: true, dni: true, orden: true } } },
  });
  if (!curso) throw new Error("NO_EXISTE");
  const existentes = new Set(curso.estudiantes.map(claveDeEstudiante));
  let orden = curso.estudiantes.reduce((m, e) => Math.max(m, e.orden), 0);
  const nuevas = filas.filter((f) => !existentes.has(claveDeEstudiante(f)));
  if (nuevas.length) {
    await prisma.docenteEstudiante.createMany({
      data: nuevas.map((f) => ({
        workspaceId,
        cursoId,
        apellido: f.apellido,
        nombre: f.nombre,
        dni: f.dni,
        condicion: f.condicion,
        orden: ++orden,
      })),
    });
  }
  return { agregados: nuevas.length, repetidos: filas.length - nuevas.length };
}

export type DatosEstudiante = {
  apellido: string;
  nombre: string;
  dni: string | null;
  orden: number;
  condicion: "R" | "NR";
  altaAt: string | null;
  bajaAt: string | null;
  bajaMotivo: string | null;
  notaPrivada: string | null;
};

export async function editarEstudiante(workspaceId: string, id: string, d: DatosEstudiante) {
  await prisma.docenteEstudiante.updateMany({
    where: { id, workspaceId },
    data: {
      ...d,
      altaAt: d.altaAt ? aFecha(d.altaAt) : null,
      bajaAt: d.bajaAt ? aFecha(d.bajaAt) : null,
      bajaMotivo: d.bajaAt ? d.bajaMotivo : null,
    },
  });
}

/** Sólo se borra a quien no tiene asistencia ni notas (un error al pegar). Si no, se da de baja. */
export async function borrarEstudiante(workspaceId: string, id: string): Promise<"borrado" | "tiene-datos"> {
  const e = await prisma.docenteEstudiante.findFirst({
    where: { id, workspaceId },
    select: { _count: { select: { asistencias: true, notas: true, notasPeriodo: true } } },
  });
  if (!e) return "borrado";
  if (e._count.asistencias + e._count.notas + e._count.notasPeriodo > 0) return "tiene-datos";
  await prisma.docenteEstudiante.delete({ where: { id } });
  return "borrado";
}

export async function obtenerEstudiante(workspaceId: string, id: string) {
  return prisma.docenteEstudiante.findFirst({ where: { id, workspaceId } });
}

// ── Asistencia ───────────────────────────────────────────────────────────────────────────────

export type RegistroAsistencia = { estudianteId: string; estado: EstadoAsistencia; horaLlegada: string | null; anotadaAt: string };

/** Lo que necesita «Pasar lista» para funcionar sin señal: todos los cursos y lo ya anotado. */
export async function datosParaPasarLista(workspaceId: string, desde: string) {
  const cursos = await prisma.docenteCurso.findMany({
    where: { workspaceId, archivadoAt: null, escuela: { archivadaAt: null } },
    orderBy: [{ escuela: { nombre: "asc" } }, { anio: "asc" }, { division: "asc" }],
    include: {
      escuela: { select: { nombre: true, numero: true } },
      estudiantes: {
        orderBy: [{ orden: "asc" }, { apellido: "asc" }],
        select: { id: true, apellido: true, nombre: true, bajaAt: true },
      },
      clases: {
        where: { fecha: { gte: aFecha(desde) } },
        select: {
          fecha: true,
          estado: true,
          motivo: true,
          horaDocente: true,
          asistencias: { select: { estudianteId: true, estado: true, horaLlegada: true, anotadaAt: true } },
        },
      },
    },
  });
  return cursos.map((c) => ({
    id: c.id,
    nombre: nombreDeCurso(c),
    escuela: [c.escuela.nombre, c.escuela.numero].filter(Boolean).join(" N.° "),
    estudiantes: c.estudiantes.map((e) => ({ id: e.id, nombre: `${e.apellido}, ${e.nombre}`.replace(/, $/, ""), baja: fechaIso(e.bajaAt) })),
    clases: c.clases.map((k) => ({
      fecha: fechaIso(k.fecha)!,
      sinClase: k.estado === "SIN_CLASE",
      motivo: k.motivo,
      horaDocente: k.horaDocente,
      registros: k.asistencias.map((a) => ({
        estudianteId: a.estudianteId,
        estado: a.estado as EstadoAsistencia,
        horaLlegada: a.horaLlegada,
        anotadaAt: a.anotadaAt.toISOString(),
      })),
    })),
  }));
}

export type DatosPasarLista = Awaited<ReturnType<typeof datosParaPasarLista>>;

/**
 * Guarda una planilla de asistencia (un curso, un día). Es idempotente: mandarla dos veces deja lo
 * mismo, y de dos versiones de un mismo estudiante gana la anotada después. Así el celular puede
 * reintentar sin miedo cuando vuelve la señal.
 */
export async function guardarAsistencia(
  workspaceId: string,
  input: {
    cursoId: string;
    fecha: string;
    sinClase: boolean;
    motivo: string | null;
    horaDocente: string | null;
    registros: readonly RegistroAsistencia[];
  },
): Promise<{ guardados: number; ignorados: number }> {
  const curso = await prisma.docenteCurso.findFirst({
    where: { id: input.cursoId, workspaceId },
    select: { id: true, estudiantes: { select: { id: true } } },
  });
  if (!curso) throw new Error("NO_EXISTE");
  const delCurso = new Set(curso.estudiantes.map((e) => e.id));
  const validos = input.registros.filter(
    (r) => delCurso.has(r.estudianteId) && esEstadoAsistencia(r.estado) && (r.horaLlegada === null || esHora(r.horaLlegada)) && !Number.isNaN(Date.parse(r.anotadaAt)),
  );

  const datosClase = {
    estado: input.sinClase ? "SIN_CLASE" : "DICTADA",
    motivo: input.motivo,
    horaDocente: input.horaDocente !== null && esHora(input.horaDocente) ? input.horaDocente : null,
  };
  return prisma.$transaction(async (tx) => {
    const clase = await tx.docenteClase.upsert({
      where: { cursoId_fecha: { cursoId: curso.id, fecha: aFecha(input.fecha) } },
      create: { cursoId: curso.id, fecha: aFecha(input.fecha), ...datosClase },
      update: datosClase,
      select: { id: true, asistencias: { select: { estudianteId: true, anotadaAt: true } } },
    });
    const previas = new Map(clase.asistencias.map((a) => [a.estudianteId, a.anotadaAt]));
    let guardados = 0;
    for (const r of validos) {
      const anotadaAt = new Date(r.anotadaAt);
      if (!ganaLaNueva(previas.get(r.estudianteId) ?? null, anotadaAt)) continue;
      const hora = r.estado === "TARDE" ? r.horaLlegada : null;
      await tx.docenteAsistencia.upsert({
        where: { claseId_estudianteId: { claseId: clase.id, estudianteId: r.estudianteId } },
        create: { claseId: clase.id, estudianteId: r.estudianteId, estado: r.estado, horaLlegada: hora, anotadaAt },
        update: { estado: r.estado, horaLlegada: hora, anotadaAt },
      });
      guardados++;
    }
    return { guardados, ignorados: input.registros.length - guardados };
    // Un curso entero son ~35 escrituras: el tope de 5 s por omisión no alcanza con la base fría.
  }, { timeout: 20_000, maxWait: 10_000 });
}

/** Estados de cada estudiante en las clases dictadas del curso, opcionalmente entre dos fechas. */
export async function asistenciaDelCurso(cursoId: string, desde?: string | null, hasta?: string | null) {
  const clases = await prisma.docenteClase.findMany({
    where: {
      cursoId,
      estado: "DICTADA",
      fecha: { ...(desde ? { gte: aFecha(desde) } : {}), ...(hasta ? { lte: aFecha(hasta) } : {}) },
    },
    select: { asistencias: { select: { estudianteId: true, estado: true } } },
  });
  const porEstudiante = new Map<string, EstadoAsistencia[]>();
  for (const k of clases) {
    for (const a of k.asistencias) {
      if (!esEstadoAsistencia(a.estado)) continue;
      porEstudiante.set(a.estudianteId, [...(porEstudiante.get(a.estudianteId) ?? []), a.estado]);
    }
  }
  return { clases: clases.length, porEstudiante };
}

// ── Evaluaciones y notas ─────────────────────────────────────────────────────────────────────

export type DatosEvaluacion = {
  titulo: string;
  tipo: TipoEvaluacion;
  fecha: string | null;
  periodo: string;
  notaMaxima: number;
  recuperaAId: string | null;
  descripcion: string | null;
};

async function cursoDelWorkspace(workspaceId: string, cursoId: string) {
  const c = await prisma.docenteCurso.findFirst({ where: { id: cursoId, workspaceId }, select: { id: true } });
  if (!c) throw new Error("NO_EXISTE");
  return c;
}

async function validarRecupera(cursoId: string, recuperaAId: string | null, propio?: string) {
  if (!recuperaAId) return null;
  if (recuperaAId === propio) return null;
  const r = await prisma.docenteEvaluacion.findFirst({ where: { id: recuperaAId, cursoId, recuperaAId: null }, select: { id: true } });
  return r?.id ?? null;
}

export async function crearEvaluacion(workspaceId: string, cursoId: string, d: DatosEvaluacion) {
  await cursoDelWorkspace(workspaceId, cursoId);
  if (!esTipoEvaluacion(d.tipo)) throw new Error("TIPO");
  const recuperaAId = await validarRecupera(cursoId, d.recuperaAId);
  const e = await prisma.docenteEvaluacion.create({
    data: { ...d, cursoId, recuperaAId, fecha: d.fecha ? aFecha(d.fecha) : null },
    select: { id: true },
  });
  return e.id;
}

export async function editarEvaluacion(workspaceId: string, id: string, d: DatosEvaluacion) {
  const ev = await prisma.docenteEvaluacion.findFirst({ where: { id, curso: { workspaceId } }, select: { cursoId: true } });
  if (!ev) throw new Error("NO_EXISTE");
  const recuperaAId = await validarRecupera(ev.cursoId, d.recuperaAId, id);
  await prisma.docenteEvaluacion.update({ where: { id }, data: { ...d, recuperaAId, fecha: d.fecha ? aFecha(d.fecha) : null } });
}

export async function borrarEvaluacion(workspaceId: string, id: string) {
  await prisma.docenteEvaluacion.deleteMany({ where: { id, curso: { workspaceId } } });
}

/** Guarda lo escrito en una celda de la planilla. Vacío borra la nota. */
export async function guardarCelda(
  workspaceId: string,
  evaluacionId: string,
  estudianteId: string,
  texto: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ev = await prisma.docenteEvaluacion.findFirst({ where: { id: evaluacionId, curso: { workspaceId } }, select: { cursoId: true, notaMaxima: true } });
  if (!ev) return { ok: false, error: "No existe esa evaluación." };
  const est = await prisma.docenteEstudiante.findFirst({ where: { id: estudianteId, cursoId: ev.cursoId }, select: { id: true } });
  if (!est) return { ok: false, error: "Ese estudiante no es del curso." };
  const c = leerCelda(texto, num(ev.notaMaxima) ?? 10);
  if (!c.ok) return c;
  if (c.vacia) {
    await prisma.docenteNota.deleteMany({ where: { evaluacionId, estudianteId } });
    return { ok: true };
  }
  const data = { valor: c.valor === null ? null : new Prisma.Decimal(c.valor), especial: c.especial, entregaTarde: c.entregaTarde };
  await prisma.docenteNota.upsert({
    where: { evaluacionId_estudianteId: { evaluacionId, estudianteId } },
    create: { evaluacionId, estudianteId, ...data },
    update: data,
  });
  return { ok: true };
}

export async function evaluacionesDelCurso(cursoId: string) {
  const evs = await prisma.docenteEvaluacion.findMany({
    where: { cursoId },
    orderBy: [{ fecha: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    include: { notas: { select: { estudianteId: true, valor: true, especial: true, entregaTarde: true } } },
  });
  return evs.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    tipo: e.tipo as TipoEvaluacion,
    fecha: fechaIso(e.fecha),
    periodo: e.periodo,
    notaMaxima: num(e.notaMaxima) ?? 10,
    recuperaAId: e.recuperaAId,
    descripcion: e.descripcion,
    notas: new Map(
      e.notas.map((n) => [n.estudianteId, { valor: num(n.valor), especial: n.especial as EspecialNota | null, entregaTarde: n.entregaTarde }]),
    ),
  }));
}

export type EvaluacionDelCurso = Awaited<ReturnType<typeof evaluacionesDelCurso>>[number];

// ── Notas de período ─────────────────────────────────────────────────────────────────────────

export type FilaPeriodo = {
  estudianteId: string;
  calculo: CalculoPeriodo;
  final: number | null;
  especial: EspecialPeriodo | null;
  motivo: string | null;
  sugeridaAlConfirmar: number | null;
  pasadaMiEscuelaAt: string | null;
  confirmada: boolean;
};

/** Sugerida (con las reglas de cada estudiante) y lo ya confirmado, para un período o «FINAL». */
export async function notasDelPeriodo(curso: CursoCompleto, periodo: string) {
  const [evaluaciones, guardadas] = await Promise.all([
    evaluacionesDelCurso(curso.id),
    prisma.docenteNotaPeriodo.findMany({ where: { cursoId: curso.id } }),
  ]);
  const evsCalculo: EvaluacionParaCalculo[] = evaluaciones.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    periodo: e.periodo,
    notaMaxima: e.notaMaxima,
    recuperaAId: e.recuperaAId,
    fecha: e.fecha,
  }));
  const guardadaDe = new Map(guardadas.map((g) => [`${g.estudianteId}:${g.periodo}`, g]));
  const claves = curso.reglas.valores.periodos.map((p) => p.clave);

  const filas: FilaPeriodo[] = curso.estudiantes.map((est) => {
    const reglas = reglasDeEstudiante(curso, est);
    let calculo: CalculoPeriodo;
    if (periodo === "FINAL") {
      const finales = claves.map((k) => num(guardadaDe.get(`${est.id}:${k}`)?.final));
      const s = sugerirNotaFinal(finales, reglas);
      calculo = { sugerida: s.sugerida, porCategoria: {} as CalculoPeriodo["porCategoria"], evaluaciones: [], pendientes: [], sinNotas: [] };
    } else {
      const notas = new Map<string, NotaParaCalculo>();
      for (const e of evaluaciones) {
        const n = e.notas.get(est.id);
        if (n) notas.set(e.id, { valor: n.valor, especial: n.especial });
      }
      calculo = calcularNotaPeriodo({ periodo, evaluaciones: evsCalculo, notas, reglas });
    }
    const g = guardadaDe.get(`${est.id}:${periodo}`);
    return {
      estudianteId: est.id,
      calculo,
      final: num(g?.final),
      especial: esEspecialPeriodo(g?.especial) ? g!.especial as EspecialPeriodo : null,
      motivo: g?.motivo ?? null,
      sugeridaAlConfirmar: num(g?.sugeridaAlConfirmar),
      pasadaMiEscuelaAt: g?.pasadaMiEscuelaAt?.toISOString() ?? null,
      confirmada: Boolean(g && (g.final !== null || g.especial !== null)),
    };
  });
  return { filas, evaluaciones };
}

export async function guardarNotaPeriodo(
  workspaceId: string,
  input: {
    cursoId: string;
    estudianteId: string;
    periodo: string;
    final: number | null;
    especial: EspecialPeriodo | null;
    motivo: string | null;
    sugerida: number | null;
  },
) {
  const est = await prisma.docenteEstudiante.findFirst({ where: { id: input.estudianteId, cursoId: input.cursoId, workspaceId }, select: { id: true } });
  if (!est) throw new Error("NO_EXISTE");
  if (input.final === null && input.especial === null) {
    await prisma.docenteNotaPeriodo.deleteMany({ where: { estudianteId: input.estudianteId, periodo: input.periodo } });
    return;
  }
  const data = {
    final: input.final === null ? null : new Prisma.Decimal(input.final),
    especial: input.especial,
    motivo: input.motivo,
    sugeridaAlConfirmar: input.sugerida === null ? null : new Prisma.Decimal(input.sugerida),
  };
  await prisma.docenteNotaPeriodo.upsert({
    where: { estudianteId_periodo: { estudianteId: input.estudianteId, periodo: input.periodo } },
    create: { cursoId: input.cursoId, estudianteId: input.estudianteId, periodo: input.periodo, ...data },
    update: data,
  });
}

export async function marcarPasada(workspaceId: string, cursoId: string, estudianteId: string, periodo: string, pasada: boolean) {
  await prisma.docenteNotaPeriodo.updateMany({
    where: { cursoId, estudianteId, periodo, curso: { workspaceId } },
    data: { pasadaMiEscuelaAt: pasada ? new Date() : null },
  });
}

