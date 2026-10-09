"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { estaActivo, type Seccion } from "@/lib/panel-navegacion";

/**
 * El menú del panel.
 *
 * **En el teléfono va arriba, en una fila que se desplaza de costado; en pantalla ancha
 * va al lado.** El fotógrafo usa esto parado en un salón, con una mano: un menú lateral
 * en un teléfono se come la mitad del ancho o se esconde detrás de un botón de tres
 * rayas, y las dos cosas estorban cuando hay que llegar rápido a Moderación.
 *
 * El ítem activo se marca con color y con `aria-current`, no sólo con color: quien
 * navega por teclado o con lector de pantalla también tiene que saber dónde está.
 */
export function Navegacion({
  secciones,
  titulo,
}: {
  secciones: Seccion[];
  titulo?: string;
}) {
  const ruta = usePathname();

  return (
    <nav aria-label={titulo ?? "Secciones"} className="min-w-0">
      {titulo ? (
        <p
          className="mb-3 hidden text-xs font-extrabold uppercase tracking-wider lg:block"
          style={{ color: "var(--slf-tinta-suave)" }}
        >
          {titulo}
        </p>
      ) : null}

      <ul
        className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
        style={{ scrollbarWidth: "none" }}
      >
        {secciones.map((s) => {
          const activo = estaActivo(s.href, ruta);
          return (
            <li key={s.href} className="shrink-0 lg:shrink">
              <Link
                href={s.href}
                aria-current={activo ? "page" : undefined}
                className="flex min-h-[44px] items-center rounded-xl px-4 text-sm font-extrabold lg:flex-col lg:items-start lg:justify-center lg:py-2"
                style={{
                  background: activo ? "var(--slf-violeta)" : "transparent",
                  color: activo ? "white" : "var(--slf-violeta)",
                }}
              >
                <span className="whitespace-nowrap lg:whitespace-normal">{s.texto}</span>
                {s.ayuda ? (
                  <span
                    className="hidden text-xs font-medium lg:block"
                    style={{ color: activo ? "rgba(255,255,255,0.8)" : "var(--slf-tinta-suave)" }}
                  >
                    {s.ayuda}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
