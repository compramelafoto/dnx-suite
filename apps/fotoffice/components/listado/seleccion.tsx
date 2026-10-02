"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Opcion } from "@/lib/listado/tipos";
import { numero } from "./util";

/** Una acción en lote tal como la ve el navegador: sin funciones, con las opciones ya cargadas. */
export type AccionVisible = {
  clave: string;
  etiqueta: string;
  parametro: { etiqueta: string; opciones: Opcion[] } | null;
};

type Seleccion = {
  ids: Set<string>;
  /** "Todos los resultados" de la consulta, no sólo los de esta página. */
  todos: boolean;
  idsDePagina: string[];
  total: number;
  clave: string;
  query: string;
  acciones: AccionVisible[];
  puedeExportar: boolean;
  rutaExportar: string;
  cantidad: number;
  alternar: (id: string) => void;
  alternarPagina: () => void;
  seleccionarTodos: () => void;
  limpiar: () => void;
};

const Contexto = createContext<Seleccion | null>(null);

export function useSeleccion(): Seleccion {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSeleccion fuera de ProveedorSeleccion");
  return s;
}

export function ProveedorSeleccion({
  idsDePagina,
  total,
  clave,
  query,
  acciones,
  puedeExportar,
  rutaExportar,
  children,
}: {
  idsDePagina: string[];
  total: number;
  clave: string;
  query: string;
  acciones: AccionVisible[];
  puedeExportar: boolean;
  rutaExportar: string;
  children: ReactNode;
}) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [todos, setTodos] = useState(false);

  const alternar = useCallback(
    (id: string) => {
      if (todos) {
        // Destildar una fila con "todos" elegido vuelve a la selección de esta página, sin esa fila.
        setTodos(false);
        setIds(new Set(idsDePagina.filter((i) => i !== id)));
        return;
      }
      setIds((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      });
    },
    [todos, idsDePagina],
  );

  const alternarPagina = useCallback(() => {
    const completa = todos || idsDePagina.every((i) => ids.has(i));
    setTodos(false);
    setIds(completa ? new Set() : new Set(idsDePagina));
  }, [todos, ids, idsDePagina]);

  const seleccionarTodos = useCallback(() => {
    setIds(new Set(idsDePagina));
    setTodos(true);
  }, [idsDePagina]);

  const limpiar = useCallback(() => {
    setIds(new Set());
    setTodos(false);
  }, []);

  const valor = useMemo<Seleccion>(
    () => ({
      ids,
      todos,
      idsDePagina,
      total,
      clave,
      query,
      acciones,
      puedeExportar,
      rutaExportar,
      cantidad: todos ? total : ids.size,
      alternar,
      alternarPagina,
      seleccionarTodos,
      limpiar,
    }),
    [ids, todos, idsDePagina, total, clave, query, acciones, puedeExportar, rutaExportar, alternar, alternarPagina, seleccionarTodos, limpiar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

const CASILLA = "size-4 cursor-pointer accent-[var(--fo-accent)]";

export function CasillaFila({ id }: { id: string }) {
  const s = useSeleccion();
  return (
    <input
      type="checkbox"
      className={CASILLA}
      aria-label="Seleccionar fila"
      checked={s.todos || s.ids.has(id)}
      onChange={() => s.alternar(id)}
    />
  );
}

export function CasillaPagina() {
  const s = useSeleccion();
  const ref = useRef<HTMLInputElement>(null);
  const marcadas = s.idsDePagina.filter((i) => s.ids.has(i)).length;
  const completa = s.todos || (s.idsDePagina.length > 0 && marcadas === s.idsDePagina.length);
  const parcial = !completa && marcadas > 0;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = parcial;
  }, [parcial]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={CASILLA}
      aria-label="Seleccionar toda la página"
      checked={completa}
      disabled={s.idsDePagina.length === 0}
      onChange={s.alternarPagina}
    />
  );
}

/** "Seleccionaste 25 · Seleccionar los 1.240 resultados", sólo cuando hay más resultados que filas. */
export function AvisoSeleccion() {
  const s = useSeleccion();
  const paginaCompleta = s.idsDePagina.length > 0 && s.idsDePagina.every((i) => s.ids.has(i));
  if (s.todos) {
    return (
      <p className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-accent-soft)] px-4 py-2 text-sm text-[var(--fo-text)]">
        Están seleccionados los {numero(s.total)} resultados
        {" · "}
        <button type="button" className="font-medium text-[var(--fo-accent)] underline" onClick={s.limpiar}>
          Quitar selección
        </button>
      </p>
    );
  }
  if (!paginaCompleta || s.total <= s.idsDePagina.length) return null;
  return (
    <p className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-accent-soft)] px-4 py-2 text-sm text-[var(--fo-text)]">
      Seleccionaste {numero(s.ids.size)}
      {" · "}
      <button type="button" className="font-medium text-[var(--fo-accent)] underline" onClick={s.seleccionarTodos}>
        Seleccionar los {numero(s.total)} resultados
      </button>
    </p>
  );
}
