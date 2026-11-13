import Link from "next/link";
import type { Periodo } from "@/lib/registro-docente/reglas";

/** Pestañas de un curso. Server component: sólo enlaces. */
export function CursoNav({
  cursoId,
  activa,
  periodos,
  periodoActivo,
}: {
  cursoId: string;
  activa: "padron" | "notas" | "periodo" | "reglas" | "datos";
  periodos: readonly Periodo[];
  periodoActivo?: string;
}) {
  const base = `/registro-docente/cursos/${cursoId}`;
  const tab = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm ${on ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)] font-medium text-[var(--fo-text)]" : "border-[var(--fo-border)] text-[var(--fo-muted)] hover:text-[var(--fo-text)]"}`;
  return (
    <nav aria-label="Secciones del curso" className="flex flex-wrap gap-2">
      <Link href={base} className={tab(activa === "padron")}>Padrón</Link>
      <Link href={`${base}/notas`} className={tab(activa === "notas")}>Planilla de notas</Link>
      {periodos.map((p) => (
        <Link key={p.clave} href={`${base}/periodo/${p.clave}`} className={tab(activa === "periodo" && periodoActivo === p.clave)}>
          {p.nombre}
        </Link>
      ))}
      <Link href={`${base}/periodo/FINAL`} className={tab(activa === "periodo" && periodoActivo === "FINAL")}>Nota final</Link>
      <Link href={`${base}/reglas`} className={tab(activa === "reglas")}>Reglas</Link>
      <Link href={`${base}/datos`} className={tab(activa === "datos")}>Datos del curso</Link>
      <Link href="/registro-docente/asistencia" className={tab(false)}>Pasar lista ↗</Link>
    </nav>
  );
}
