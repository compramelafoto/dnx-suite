import Link from "next/link";

/**
 * Las dos pestañas de "Mi perfil": los datos de siempre y «Más sobre mí».
 *
 * Son dos páginas y no una pestaña que se oculta en el navegador: «Más sobre mí» tiene su propio
 * formulario, y mezclarlo con el de los datos personales haría que guardar uno pisara el otro.
 */
export function ProfileTabs({ active }: { active: "datos" | "sobre-mi" }) {
  const tab = (href: string, label: string, activa: boolean) => (
    <Link
      href={href}
      aria-current={activa ? "page" : undefined}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        activa
          ? "border-[var(--fo-accent)] font-semibold text-[var(--fo-text)]"
          : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Secciones de mi perfil" className="flex gap-1 border-b border-[var(--fo-border)]">
      {tab("/portal/perfil", "Mis datos", active === "datos")}
      {tab("/portal/perfil/sobre-mi", "Más sobre mí", active === "sobre-mi")}
    </nav>
  );
}
