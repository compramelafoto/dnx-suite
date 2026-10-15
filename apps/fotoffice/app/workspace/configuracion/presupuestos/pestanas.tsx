import Link from "next/link";

/** Pestañas de Configuración → Presupuestos: los ajustes y las propuestas modelo por categoría. */
export function PestanasPresupuestos({ activa }: { activa: "ajustes" | "propuestas" }) {
  const pestanas = [
    { clave: "ajustes", href: "/workspace/configuracion/presupuestos", texto: "Ajustes" },
    { clave: "propuestas", href: "/workspace/configuracion/presupuestos/propuestas", texto: "Propuestas modelo" },
  ] as const;
  return (
    <nav aria-label="Secciones de Presupuestos" className="flex flex-wrap gap-2 border-b border-[var(--fo-border)]">
      {pestanas.map((p) => (
        <Link
          key={p.clave}
          href={p.href}
          aria-current={p.clave === activa ? "page" : undefined}
          className={
            p.clave === activa
              ? "-mb-px border-b-2 border-[var(--fo-accent)] px-3 py-2 text-sm font-semibold text-[var(--fo-text)]"
              : "px-3 py-2 text-sm text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
          }
        >
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}
