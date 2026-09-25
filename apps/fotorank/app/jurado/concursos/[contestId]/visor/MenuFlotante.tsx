"use client";

/**
 * Un botón que abre una lista corta de opciones encima de la fotografía.
 *
 * Los filtros y los fondos estaban desplegados todo el tiempo: siete botones
 * ocupando la barra para dos decisiones que se toman una vez y no se vuelven a
 * tocar. Guardados detrás de un botón, la barra se achica y la obra gana la
 * pantalla, que es lo único que importa mientras se califica.
 */
import { useEffect, useRef, useState } from "react";

type Colores = {
  fondo: string;
  panel: string;
  linea: string;
  tinta: string;
  suave: string;
  chip: string;
};

export type OpcionDelMenu = {
  id: string;
  nombre: string;
  /** Una línea explicando qué hace. Se muestra debajo del nombre. */
  detalle?: string;
  /** Un cuadradito de color, para los fondos. */
  muestra?: string;
};

export function MenuFlotante({
  etiqueta,
  titulo,
  opciones,
  elegida,
  colores,
  icono,
  onElegir,
}: {
  /** Lo que dice el botón cerrado. */
  etiqueta: React.ReactNode;
  /** Para quien navega a ciegas y para el globito al pasar el mouse. */
  titulo: string;
  opciones: OpcionDelMenu[];
  elegida: string;
  colores: Colores;
  icono?: React.ReactNode;
  onElegir: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement | null>(null);

  // Se cierra al tocar afuera o con Escape. Escape acá no borra ninguna nota:
  // lo último que se abrió es lo primero que se cierra.
  useEffect(() => {
    if (!abierto) return;
    function afuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node))
        setAbierto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", afuera);
    window.addEventListener("keydown", tecla, true);
    return () => {
      document.removeEventListener("mousedown", afuera);
      window.removeEventListener("keydown", tecla, true);
    };
  }, [abierto]);

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title={titulo}
        className="flex min-h-8 items-center gap-1.5 px-2 text-xs font-medium"
        style={{ border: `1px solid ${colores.linea}`, color: colores.tinta }}
      >
        {icono}
        {etiqueta}
        <span aria-hidden="true" style={{ color: colores.suave, fontSize: 9 }}>
          ▾
        </span>
      </button>

      {abierto ? (
        <div
          role="menu"
          aria-label={titulo}
          className="absolute right-0 z-20 mt-1 w-56 p-1"
          style={{
            background: colores.panel,
            border: `1px solid ${colores.linea}`,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          }}
        >
          {opciones.map((o) => {
            const activa = o.id === elegida;
            return (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={activa}
                onClick={() => {
                  onElegir(o.id);
                  setAbierto(false);
                }}
                className="flex w-full items-start gap-2 px-2 py-1.5 text-left"
                style={{ background: activa ? colores.chip : "transparent" }}
              >
                {o.muestra ? (
                  <span
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{
                      background: o.muestra,
                      border: `1px solid ${activa ? "#e0a061" : colores.linea}`,
                    }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="w-3 shrink-0 text-center text-[11px]"
                    style={{ color: "#e0a061" }}
                  >
                    {activa ? "✓" : ""}
                  </span>
                )}
                <span className="min-w-0">
                  <span
                    className="block text-xs font-medium"
                    style={{ color: colores.tinta }}
                  >
                    {o.nombre}
                  </span>
                  {o.detalle ? (
                    <span
                      className="mt-0.5 block text-[10.5px]"
                      style={{ color: colores.suave }}
                    >
                      {o.detalle}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Un embudo. Dibujado acá para no traer una librería de íconos por uno solo. */
export function IconoDeFiltro() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M1.5 2.5h13a.5.5 0 0 1 .38.82L10 9.2v4.05a.5.5 0 0 1-.72.45l-2.5-1.25A.5.5 0 0 1 6.5 12V9.2L1.12 3.32a.5.5 0 0 1 .38-.82Z" />
    </svg>
  );
}
