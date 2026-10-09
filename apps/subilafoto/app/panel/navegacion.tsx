"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { estaActivo, filtrarGrupos, type Grupo } from "@/lib/panel-navegacion";

/**
 * La barra lateral del panel.
 *
 * **Se despega del contenido** con fondo propio y esquinas redondeadas. Sin eso, el menú
 * y la pantalla eran la misma mancha blanca y no se entendía dónde terminaba uno.
 *
 * **En el teléfono va arriba**, en una fila que se desplaza de costado. El fotógrafo usa
 * esto parado en un salón, con una mano: una barra lateral en un teléfono se come la
 * mitad del ancho o se esconde detrás de un botón de tres rayas, y las dos cosas
 * estorban cuando hay que llegar rápido a Moderación.
 *
 * El violeta de los textos no es el de la marca: ése es un color de botón y a ese brillo
 * cansa en una lista. Ver `--slf-violeta-texto`.
 */
export function Navegacion({ grupos }: { grupos: Grupo[] }) {
  const ruta = usePathname();
  const [busqueda, setBusqueda] = useState("");

  const visibles = filtrarGrupos(grupos, busqueda);

  return (
    <nav
      aria-label="Secciones del panel"
      className="min-w-0 lg:rounded-2xl lg:p-4"
      style={{ background: "var(--slf-panel-lateral)" }}
    >
      {/* El buscador. En el teléfono estorba más de lo que ayuda: hay pocas secciones y
          están todas a la vista en la fila de arriba. */}
      <div className="hidden lg:block">
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
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1 lg:mt-5 lg:flex-col lg:gap-6 lg:overflow-visible lg:pb-0">
        {visibles.map((grupo) => (
          <section key={grupo.titulo} className="shrink-0 lg:shrink">
            <h3
              className="mb-2 hidden text-[0.7rem] font-extrabold uppercase tracking-[0.08em] lg:block"
              style={{ color: "var(--slf-tinta-suave)" }}
            >
              {grupo.titulo}
            </h3>

            <ul className="flex gap-2 lg:flex-col lg:gap-0.5">
              {grupo.items.map((s) => {
                const activo = estaActivo(s.href, ruta);
                return (
                  <li key={s.href} className="shrink-0 lg:shrink">
                    <Link
                      href={s.href}
                      aria-current={activo ? "page" : undefined}
                      className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-extrabold lg:flex-col lg:items-start lg:justify-center lg:py-2"
                      style={{
                        background: activo ? "var(--slf-violeta-texto)" : "transparent",
                        color: activo ? "white" : "var(--slf-violeta-texto)",
                      }}
                    >
                      <span className="whitespace-nowrap lg:whitespace-normal">{s.texto}</span>
                      {s.ayuda ? (
                        <span
                          className="hidden text-[0.7rem] font-medium leading-tight lg:block"
                          style={{
                            color: activo ? "rgba(255,255,255,0.85)" : "var(--slf-tinta-suave)",
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
      </div>

      {visibles.length === 0 ? (
        <p className="mt-4 hidden text-sm lg:block" style={{ color: "var(--slf-tinta-suave)" }}>
          No hay ninguna sección que se llame así.
        </p>
      ) : null}
    </nav>
  );
}
