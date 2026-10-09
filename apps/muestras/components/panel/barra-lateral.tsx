"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { activeSectionKey, type PanelSectionGroup } from "@repo/muestras";

/**
 * La barra del panel. En pantalla ancha queda fija al costado; en el teléfono es una franja con
 * la sección actual y un botón "Menú" que abre un cajón desde la izquierda (Escape lo cierra).
 */
export function BarraLateral({ grupos, nombre }: { grupos: PanelSectionGroup[]; nombre: string }) {
  const activa = activeSectionKey(usePathname());
  const [abierta, setAbierta] = useState(false);
  const actual = grupos.flatMap((g) => g.sections).find((s) => s.key === activa);

  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierta(false); };
    window.addEventListener("keydown", alTeclear);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = "";
    };
  }, [abierta]);

  const lista = (
    <nav aria-label="Panel" className="space-y-7">
      {grupos.map((g) => (
        <div key={g.group}>
          <p className="mb-2 text-[13px] text-[var(--mf-muted)]">{g.label}</p>
          <ul className="space-y-0.5">
            {g.sections.map((s) => {
              const esActiva = s.key === activa;
              return (
                <li key={s.key}>
                  <Link
                    href={s.href}
                    aria-current={esActiva ? "page" : undefined}
                    onClick={() => setAbierta(false)}
                    className={`-ml-3 block border-l-2 py-1.5 pl-3 text-[15px] ${esActiva ? "border-[var(--mf-ink)] font-medium" : "border-transparent text-[var(--mf-muted)] hover:text-[var(--mf-ink)]"}`}
                  >
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-[var(--mf-line)] py-3 lg:hidden">
        <span className="text-sm text-[var(--mf-muted)]">{actual?.label ?? "Mi panel"}</span>
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls="panel-cajon"
          onClick={() => setAbierta(true)}
          className="inline-flex h-10 items-center border border-[var(--mf-ink)] px-4 text-sm"
        >
          Menú
        </button>
      </div>
      {abierta ? (
        <div id="panel-cajon" role="dialog" aria-modal="true" aria-label="Menú del panel" className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Cerrar el menú" className="absolute inset-0 bg-black/30" onClick={() => setAbierta(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] overflow-y-auto bg-[var(--mf-bg)] p-6 shadow-xl">
            <div className="mb-8 flex items-center justify-between">
              <span className="mf-titulo text-2xl">Mi panel</span>
              <button type="button" autoFocus onClick={() => setAbierta(false)} className="text-sm underline underline-offset-4">Cerrar</button>
            </div>
            {lista}
          </div>
        </div>
      ) : null}
      <aside className="hidden lg:block">
        <div className="sticky top-16 space-y-8 pt-10">
          <p className="truncate text-sm"><span className="text-[var(--mf-muted)]">Hola,</span> {nombre}</p>
          {lista}
        </div>
      </aside>
    </>
  );
}
