import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRegistro } from "@/lib/registro-docente/contexto";
import { notasDelPeriodo, obtenerCurso, reglasDeEstudiante } from "@/lib/registro-docente/servidor";
import { formatearNota } from "@/lib/registro-docente/notas";
import { CATEGORIAS, CATEGORIA_ETIQUETA } from "@/lib/registro-docente/reglas";
import { fechaArgentina } from "@/lib/registro-docente/asistencia";
import { prisma } from "@repo/db";
import { confirmarPeriodoAction, confirmarSugeridasAction } from "../../../../actions";
import { Avisos } from "../../../../_componentes/avisos";
import { CursoNav } from "../../../../_componentes/curso-nav";
import { TablaPeriodo, type FilaTablaPeriodo } from "./tabla";

export const dynamic = "force-dynamic";

const dmy = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : null);

export default async function PeriodoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; clave: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, puedeEditar } = await requireRegistro("VIEW");
  const { id, clave } = await params;
  const sp = await searchParams;
  const curso = await obtenerCurso(workspace.id, id);
  if (!curso) notFound();
  const periodos = curso.reglas.valores.periodos;
  const esFinal = clave === "FINAL";
  const periodo = periodos.find((p) => p.clave === clave);
  if (!esFinal && !periodo) notFound();
  const nombre = esFinal ? "Nota final" : periodo!.nombre;
  const conMiEscuela = curso.reglas.valores.destino === "mi-escuela-santa-fe";
  const { filas } = await notasDelPeriodo(curso, clave);

  // Para la final: la nota de cada período al lado.
  const finalesDePeriodos = esFinal
    ? await prisma.docenteNotaPeriodo.findMany({ where: { cursoId: curso.id, periodo: { in: periodos.map((p) => p.clave) } }, select: { estudianteId: true, periodo: true, final: true, especial: true } })
    : [];
  const finalDe = new Map(finalesDePeriodos.map((n) => [`${n.estudianteId}:${n.periodo}`, n]));

  const columnasDetalle = esFinal ? periodos.map((p) => p.nombre) : CATEGORIAS.filter((c) => curso.reglas.valores.pesos[c] > 0).map((c) => `${CATEGORIA_ETIQUETA[c]} (${curso.reglas.valores.pesos[c]} %)`);
  const porId = new Map(curso.estudiantes.map((e) => [e.id, e]));
  const tabla: FilaTablaPeriodo[] = filas.map((f) => {
    const e = porId.get(f.estudianteId)!;
    const reglas = reglasDeEstudiante(curso, e);
    const detalle = esFinal
      ? periodos.map((p) => {
          const n = finalDe.get(`${e.id}:${p.clave}`);
          if (!n) return "—";
          return n.especial ? n.especial.toLowerCase().replace(/_/g, " ") : n.final ? formatearNota(Number(n.final.toString())) : "—";
        })
      : CATEGORIAS.filter((c) => curso.reglas.valores.pesos[c] > 0).map((c) => {
          const v = f.calculo.porCategoria[c];
          return v.promedio === null ? "—" : `${formatearNota(v.promedio)} (${v.cantidad})`;
        });
    return {
      estudianteId: e.id,
      nombre: `${e.apellido}${e.nombre ? `, ${e.nombre}` : ""}`,
      baja: Boolean(e.bajaAt),
      ppi: reglas.ppi,
      detalle,
      pendientes: f.calculo.pendientes.length,
      sugerida: f.calculo.sugerida,
      final: f.final,
      especial: f.especial,
      motivo: f.motivo,
      pasada: Boolean(f.pasadaMiEscuelaAt),
      aprobacion: reglas.notaAprobacion,
      redondeo: reglas.redondeo,
    };
  });

  const activos = tabla.filter((t) => !t.baja);
  const sinNota = activos.filter((t) => t.final === null && !t.especial).length;
  const pasadas = activos.filter((t) => t.pasada).length;
  const confirmadoAt = curso.confirmados[clave];
  const hoy = fechaArgentina();
  const cargaAbierta = periodo?.cargaDesde && periodo?.cargaHasta ? hoy >= periodo.cargaDesde && hoy <= periodo.cargaHasta : null;
  const base = `/registro-docente/cursos/${curso.id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${nombre} · ${curso.nombre}`}
        description={
          esFinal
            ? "La sugerida es el promedio de las notas finales de los períodos. La nota la decidís vos."
            : "La sugerida sale de los pesos y del recuperatorio de las reglas. La nota final la decidís vos: confirmala o cambiala, y si la cambiás anotá el motivo."
        }
      />
      <CursoNav cursoId={curso.id} activa="periodo" periodos={periodos} periodoActivo={clave} />
      <Avisos error={sp.error} ok={sp.ok} />

      {periodo && (periodo.desde || periodo.cargaDesde) ? (
        <p className="text-sm text-[var(--fo-muted)]">
          {periodo.desde ? `Del ${dmy(periodo.desde)} al ${dmy(periodo.hasta) ?? "—"}. ` : ""}
          {periodo.cargaDesde ? `Mi Escuela deja cargar del ${dmy(periodo.cargaDesde)} al ${dmy(periodo.cargaHasta) ?? "—"}` : ""}
          {cargaAbierta === true ? " (hoy está abierta)." : cargaAbierta === false ? " (hoy no está abierta)." : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          {activos.length - sinNota} de {activos.length} con nota{conMiEscuela ? ` · ${pasadas} pasadas a Mi Escuela` : ""}
        </span>
        {puedeEditar && sinNota ? (
          <form action={confirmarSugeridasAction}>
            <input type="hidden" name="cursoId" value={curso.id} />
            <input type="hidden" name="periodo" value={clave} />
            <button className="fo-btn fo-btn-secondary text-sm min-h-9">Poner la sugerida a quienes no tienen nota</button>
          </form>
        ) : null}
        <a href={`${base}/mi-escuela?periodo=${clave}`} className="fo-btn fo-btn-secondary text-sm min-h-9">
          {conMiEscuela ? "Bajar planilla para Mi Escuela (Excel)" : "Bajar planilla (Excel)"}
        </a>
      </div>

      <TablaPeriodo cursoId={curso.id} periodo={clave} columnasDetalle={columnasDetalle} filas={tabla} conMiEscuela={conMiEscuela} puedeEditar={puedeEditar} />

      {conMiEscuela ? (
        <section className="fo-card space-y-2 p-5 text-sm">
          <h2 className="font-semibold">Cómo pasarlo a Mi Escuela</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Entrá a Mi Escuela con tu ID Ciudadana (FOTOFFICE nunca te pide esa contraseña).</li>
            <li>Calificaciones → Estructura → Sección ({curso.anio} {curso.division ?? ""}) → Materia ({curso.materia}) → Ciclo {curso.cicloLectivo}.</li>
            <li>Con esta pantalla abierta en el celular (o la planilla impresa), elegí en cada desplegable el valor de la columna «Mi Escuela» y tildá «Pasada».</li>
            <li>Tocá Guardar en Mi Escuela y, al terminar, Confirmar Período. Después marcalo acá abajo.</li>
          </ol>
          {puedeEditar ? (
            <form action={confirmarPeriodoAction} className="pt-2">
              <input type="hidden" name="cursoId" value={curso.id} />
              <input type="hidden" name="periodo" value={clave} />
              <input type="hidden" name="confirmado" value={confirmadoAt ? "0" : "1"} />
              {confirmadoAt ? (
                <p className="flex flex-wrap items-center gap-2">
                  <span className="fo-alert-success">Confirmado en Mi Escuela el {dmy(confirmadoAt)}.</span>
                  <button className="fo-btn fo-btn-ghost text-sm">Quitar la marca</button>
                </p>
              ) : (
                <button className="fo-btn fo-btn-primary text-sm">Ya confirmé el período en Mi Escuela</button>
              )}
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
