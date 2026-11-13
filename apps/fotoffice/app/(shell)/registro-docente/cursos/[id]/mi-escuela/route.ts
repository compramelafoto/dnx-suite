import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { contextoRegistro } from "@/lib/registro-docente/contexto";
import { asistenciaDelCurso, obtenerCurso, reglasDeEstudiante } from "@/lib/registro-docente/servidor";
import { resumirAsistencia } from "@/lib/registro-docente/asistencia";
import { esEspecialPeriodo } from "@/lib/registro-docente/notas";
import { armarPlanillaMiEscuela, type FilaParaPlanilla } from "@/lib/registro-docente/planilla-mi-escuela";
import { nombreArchivoExport } from "@/lib/listado/csv";

export const dynamic = "force-dynamic";

/** Planilla del curso para Excel: notas de cada período ya convertidas a lo que acepta Mi Escuela. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = await contextoRegistro("VIEW");
  if (!c) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await ctx.params;
  const curso = await obtenerCurso(c.workspaceId, id);
  if (!curso) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const [notas, asistencia] = await Promise.all([
    prisma.docenteNotaPeriodo.findMany({ where: { cursoId: curso.id }, select: { estudianteId: true, periodo: true, final: true, especial: true } }),
    asistenciaDelCurso(curso.id),
  ]);
  const notasDe = new Map<string, FilaParaPlanilla["notas"]>();
  for (const n of notas) {
    const m = notasDe.get(n.estudianteId) ?? {};
    m[n.periodo] = { final: n.final === null ? null : Number(n.final.toString()), especial: esEspecialPeriodo(n.especial) ? n.especial : null };
    notasDe.set(n.estudianteId, m);
  }
  const filas: FilaParaPlanilla[] = curso.estudiantes.map((e) => {
    const reglas = reglasDeEstudiante(curso, e);
    const r = resumirAsistencia(asistencia.porEstudiante.get(e.id) ?? [], reglas);
    return {
      orden: e.orden,
      apellido: e.apellido,
      nombre: e.nombre,
      dni: e.dni,
      condicion: e.condicion,
      baja: e.bajaAt ? e.bajaAt.toISOString().slice(0, 10) : null,
      redondeo: reglas.redondeo,
      notas: notasDe.get(e.id) ?? {},
      faltas: r.faltas,
      asistencia: r.porcentaje,
    };
  });
  const csv = armarPlanillaMiEscuela(curso.reglas.valores.periodos, filas, curso.reglas.valores.decimales);
  const archivo = nombreArchivoExport(curso.nombre, curso.reglas.valores.destino === "mi-escuela-santa-fe" ? "para-mi-escuela" : "planilla");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
