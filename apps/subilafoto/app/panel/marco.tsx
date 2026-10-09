"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { estaActivo, filtrarGrupos } from "@/lib/panel-navegacion";
import { gruposParaLaRuta } from "@/lib/panel-navegacion-por-ruta";

/**
 * El marco del panel: menú lateral y contenido.
 *
 * **Lateral en todos lados**, como en el resto de la suite. En el teléfono es un cajón
 * que entra deslizándose desde la izquierda; en pantalla grande, una columna fija al
 * lado del contenido.
 *
 * Antes en el teléfono era una fila horizontal que se desplazaba de costado. Se veía
 * distinta a las demás aplicaciones y obligaba a arrastrar para encontrar una sección.
 *
 * **Hay un solo marco en todo el panel** y las secciones salen de la dirección. Antes
 * el marco del evento dibujaba su propio menú además del general, y adentro de un evento
 * se veían dos, uno encima del otro.
 */
export function MarcoDelPanel({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const grupos = filtrarGrupos(gruposParaLaRuta(ruta), busqueda);

  // Escape cierra, como cualquier cajón.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  return (
    <div className="sobre-claro flex min-h-[100svh] flex-col lg:flex-row">
      {/* El velo. Tocarlo cierra, que es lo que espera cualquiera en un teléfono. */}
      {abierto ? (
        <button
          type="button"
          aria-label="Cerrar el menú"
          onClick={() => setAbierto(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      ) : null}

      <aside
        id="slf-menu"
        aria-label="Secciones del panel"
        className={[
          "fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] overflow-y-auto p-4",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          abierto ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-auto lg:w-72 lg:shrink-0 lg:translate-x-0 lg:overflow-visible lg:transition-none",
        ].join(" ")}
        style={{ background: "var(--slf-panel-lateral)" }}
      >
        <label htmlFor="buscar-seccion" className="sr-only">
          Buscar una sección
        </label>
        <input
          id="buscar-seccion"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar…"
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={{
            background: "white",
            border: "1px solid var(--slf-borde)",
            color: "var(--slf-tinta)",
          }}
        />

        <nav className="mt-5 flex flex-col gap-6">
          {grupos.map((grupo) => (
            <section key={grupo.titulo}>
              <h3
                className="mb-2 text-[0.7rem] font-extrabold uppercase tracking-[0.08em]"
                style={{ color: "var(--slf-tinta-suave)" }}
              >
                {grupo.titulo}
              </h3>

              <ul className="flex flex-col gap-0.5">
                {grupo.items.map((s) => {
                  const activo = estaActivo(s.href, ruta);
                  return (
                    <li key={s.href}>
                      <Link
                        href={s.href}
                        aria-current={activo ? "page" : undefined}
                        /* El cajón se cierra al tocar, no esperando al cambio de
                           pantalla: así se va con el dedo todavía apoyado. */
                        onClick={() => setAbierto(false)}
                        className="flex min-h-[44px] flex-col justify-center rounded-xl px-3 py-2 text-sm font-extrabold"
                        style={{
                          background: activo ? "var(--slf-violeta-texto)" : "transparent",
                          color: activo ? "white" : "var(--slf-violeta-texto)",
                        }}
                      >
                        <span>{s.texto}</span>
                        {s.ayuda ? (
                          <span
                            className="text-[0.7rem] font-medium leading-tight"
                            style={{
                              color: activo
                                ? "rgba(255,255,255,0.85)"
                                : "var(--slf-tinta-suave)",
                            }}
                          >
                            {s.ayuda}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {grupos.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
              No hay ninguna sección que se llame así.
            </p>
          ) : null}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        {/* La barra del teléfono con el botón del menú. En pantalla grande no hace falta. */}
        <div
          className="flex items-center gap-3 px-4 py-3 lg:hidden"
          style={{ borderBottom: "1px solid var(--slf-borde)" }}
        >
          <button
            type="button"
            onClick={() => setAbierto(true)}
            aria-expanded={abierto}
            aria-controls="slf-menu"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-extrabold"
            style={{ color: "var(--slf-violeta-texto)" }}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ☰
            </span>
            Menú
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
