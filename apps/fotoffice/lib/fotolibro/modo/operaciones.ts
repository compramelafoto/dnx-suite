import { FOTOS_POR_PAGINA_MAX } from "./maquetar";
import { FOTOS_POR_PLIEGO_MAX } from "./disenos";
import { pliegoVacio, type EstadoFotolibro, type Lado, type ModoPliego } from "./estado";

/**
 * Lo que se puede hacer con las fotos en el Modo Fotolibro. Funciones puras: reciben el estado y
 * devuelven uno nuevo, sin tocar el anterior (así deshacer es guardar el anterior).
 */

export type Ubicacion = { pliego: number; lado: Lado; fotoId: string };

const maximo = (lado: Lado) => (lado === "todo" ? FOTOS_POR_PLIEGO_MAX : FOTOS_POR_PAGINA_MAX);

const copiar = (e: EstadoFotolibro): EstadoFotolibro => ({
  ...e,
  fotos: [...e.fotos],
  pliegos: e.pliegos.map((p) => ({
    modo: p.modo,
    todo: { ...p.todo, fotos: [...p.todo.fotos] },
    izq: { ...p.izq, fotos: [...p.izq.fotos] },
    der: { ...p.der, fotos: [...p.der.fotos] },
  })),
});

/**
 * Suma fotos a una página, sin repetir las que ya están ahí y hasta el máximo por página.
 * El acomodo vuelve a la variante 0: la que mejor llena con la cantidad nueva.
 */
export function agregarAPagina(e: EstadoFotolibro, pliego: number, lado: Lado, ids: string[]): EstadoFotolibro {
  const n = copiar(e);
  const pagina = n.pliegos[pliego]?.[lado];
  if (!pagina) return e;
  for (const id of ids) {
    if (pagina.fotos.length >= maximo(lado)) break;
    if (!pagina.fotos.includes(id)) pagina.fotos.push(id);
  }
  pagina.variante = 0;
  return n;
}

/**
 * Arma el pliego con varias fotos de una: la primera mitad a la izquierda y el resto a la derecha,
 * como cuando en la línea de tiempo se corta un tramo. Una sola foto va a la página que esté vacía.
 */
export function armarPliego(e: EstadoFotolibro, pliego: number, ids: string[]): EstadoFotolibro {
  if (ids.length === 0) return e;
  if (e.pliegos[pliego]?.modo === "pliego") return agregarAPagina(e, pliego, "todo", ids);
  if (ids.length === 1) {
    const vaIzq = (e.pliegos[pliego]?.izq.fotos.length ?? 0) === 0;
    return agregarAPagina(e, pliego, vaIzq ? "izq" : "der", ids);
  }
  const mitad = Math.ceil(ids.length / 2);
  return agregarAPagina(agregarAPagina(e, pliego, "izq", ids.slice(0, mitad)), pliego, "der", ids.slice(mitad));
}

export function quitarDePagina(e: EstadoFotolibro, u: Ubicacion): EstadoFotolibro {
  const n = copiar(e);
  const pagina = n.pliegos[u.pliego]?.[u.lado];
  if (!pagina) return e;
  pagina.fotos = pagina.fotos.filter((id) => id !== u.fotoId);
  pagina.variante = 0;
  return n;
}

/** Cambia de lugar dos fotos ya puestas (en la misma página, en la otra o en otro pliego). */
export function intercambiar(e: EstadoFotolibro, a: Ubicacion, b: Ubicacion): EstadoFotolibro {
  if (a.pliego === b.pliego && a.lado === b.lado && a.fotoId === b.fotoId) return e;
  const n = copiar(e);
  const pa = n.pliegos[a.pliego]?.[a.lado];
  const pb = n.pliegos[b.pliego]?.[b.lado];
  if (!pa || !pb) return e;
  const ia = pa.fotos.indexOf(a.fotoId);
  const ib = pb.fotos.indexOf(b.fotoId);
  if (ia < 0 || ib < 0) return e;
  // Entre páginas distintas, no se puede terminar con la misma foto dos veces en una página.
  if (pa !== pb && (pa.fotos.includes(b.fotoId) || pb.fotos.includes(a.fotoId))) return e;
  pa.fotos[ia] = b.fotoId;
  pb.fotos[ib] = a.fotoId;
  return n;
}

/** Pasa una foto ya puesta a otra página (al final). */
export function moverAPagina(e: EstadoFotolibro, desde: Ubicacion, pliego: number, lado: Lado): EstadoFotolibro {
  if (desde.pliego === pliego && desde.lado === lado) return e;
  const destino = e.pliegos[pliego]?.[lado];
  if (!destino || destino.fotos.includes(desde.fotoId) || destino.fotos.length >= maximo(lado)) return e;
  return agregarAPagina(quitarDePagina(e, desde), pliego, lado, [desde.fotoId]);
}

/** Siguiente (+1) o anterior (−1) acomodo de una página: las teclas A/Q y S/W. */
export function cambiarVariante(e: EstadoFotolibro, pliego: number, lado: Lado, paso: number): EstadoFotolibro {
  const n = copiar(e);
  const pagina = n.pliegos[pliego]?.[lado];
  if (!pagina || pagina.fotos.length === 0) return e;
  pagina.variante = pagina.variante + paso;
  return n;
}

export function vaciarPliego(e: EstadoFotolibro, pliego: number): EstadoFotolibro {
  const n = copiar(e);
  if (!n.pliegos[pliego]) return e;
  n.pliegos[pliego] = pliegoVacio(n.pliegos[pliego]!.modo);
  return n;
}

/**
 * Pasa un pliego de "pliego entero" a "por páginas" o al revés, sin perder fotos: al juntar,
 * van primero las de la izquierda; al separar, la primera mitad va a la izquierda.
 */
export function cambiarModo(e: EstadoFotolibro, pliego: number, modo: ModoPliego): EstadoFotolibro {
  const p = e.pliegos[pliego];
  if (!p || p.modo === modo) return e;
  const n = copiar(e);
  const q = n.pliegos[pliego]!;
  if (modo === "pliego") {
    const fotos = [...new Set([...q.izq.fotos, ...q.der.fotos])].slice(0, FOTOS_POR_PLIEGO_MAX);
    n.pliegos[pliego] = { ...pliegoVacio("pliego"), todo: { fotos, variante: 0 } };
  } else {
    const fotos = q.todo.fotos;
    const mitad = Math.ceil(fotos.length / 2);
    n.pliegos[pliego] = {
      ...pliegoVacio("paginas"),
      izq: { fotos: fotos.slice(0, mitad).slice(0, FOTOS_POR_PAGINA_MAX), variante: 0 },
      der: { fotos: fotos.slice(mitad).slice(0, FOTOS_POR_PAGINA_MAX), variante: 0 },
    };
  }
  return n;
}

/** Suma un pliego vacío después de `despuesDe` (al final si no se indica). */
export function agregarPliego(e: EstadoFotolibro, despuesDe?: number): EstadoFotolibro {
  const n = copiar(e);
  const i = despuesDe === undefined ? n.pliegos.length : despuesDe + 1;
  // El pliego nuevo se arma igual que el que se estaba armando.
  n.pliegos.splice(i, 0, pliegoVacio(n.pliegos[despuesDe ?? n.pliegos.length - 1]?.modo ?? "pliego"));
  return n;
}

/** Saca un pliego. Nunca deja el libro sin pliegos. */
export function quitarPliego(e: EstadoFotolibro, pliego: number): EstadoFotolibro {
  if (e.pliegos.length <= 1) return e;
  const n = copiar(e);
  n.pliegos.splice(pliego, 1);
  return n;
}

export function sumarFotos(e: EstadoFotolibro, fotos: EstadoFotolibro["fotos"]): EstadoFotolibro {
  const n = copiar(e);
  const ya = new Set(n.fotos.map((f) => f.id));
  n.fotos.push(...fotos.filter((f) => !ya.has(f.id)));
  return n;
}

/** Pone otra foto en el lugar de una ya puesta (soltar una foto de la tira encima de otra). */
export function reemplazar(e: EstadoFotolibro, u: Ubicacion, nuevaId: string): EstadoFotolibro {
  const pagina = e.pliegos[u.pliego]?.[u.lado];
  if (!pagina || u.fotoId === nuevaId || pagina.fotos.includes(nuevaId)) return e;
  const n = copiar(e);
  const p = n.pliegos[u.pliego]![u.lado];
  const i = p.fotos.indexOf(u.fotoId);
  if (i < 0) return e;
  p.fotos[i] = nuevaId;
  return n;
}

/**
 * Resultado de confirmar originales subidos de fondo: los que llegaron dejan de estar pendientes;
 * los que no, quedan marcados para volver a subirlos.
 */
export function confirmarOriginales(e: EstadoFotolibro, resultado: Record<string, boolean>): EstadoFotolibro {
  let cambio = false;
  const fotos = e.fotos.map((f) => {
    if (!f.claveOriginal || !(f.claveOriginal in resultado)) return f;
    cambio = true;
    const { claveOriginal: _c, faltaOriginal: _f, ...resto } = f;
    return resultado[f.claveOriginal] ? resto : { ...resto, claveOriginal: f.claveOriginal, faltaOriginal: true };
  });
  return cambio ? { ...e, fotos } : e;
}

/**
 * Lleva el pliego `desde` al lugar `hasta` (los demás se corren). Para mover también lo hecho a
 * mano y los encuadres, ver `permutarHojas` en `bloques.ts`, que usa el mismo `ordenNuevo`.
 */
export function moverPliego(e: EstadoFotolibro, desde: number, hasta: number): EstadoFotolibro {
  const n = e.pliegos.length;
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= n || hasta >= n) return e;
  const pliegos = [...e.pliegos];
  const [p] = pliegos.splice(desde, 1);
  pliegos.splice(hasta, 0, p!);
  return { ...e, pliegos };
}

/** Cuál era antes cada pliego después de `moverPliego`: `orden[nuevo] = viejo`. */
export function ordenTrasMover(cantidad: number, desde: number, hasta: number): number[] {
  const orden = Array.from({ length: cantidad }, (_, i) => i);
  const [x] = orden.splice(desde, 1);
  orden.splice(hasta, 0, x!);
  return orden;
}

/** Copia el pliego (mismas fotos, misma distribución) justo después. */
export function duplicarPliego(e: EstadoFotolibro, pliego: number): EstadoFotolibro {
  const p = e.pliegos[pliego];
  if (!p) return e;
  const copia = { modo: p.modo, todo: { ...p.todo, fotos: [...p.todo.fotos] }, izq: { ...p.izq, fotos: [...p.izq.fotos] }, der: { ...p.der, fotos: [...p.der.fotos] } };
  const pliegos = [...e.pliegos];
  pliegos.splice(pliego + 1, 0, copia);
  return { ...e, pliegos };
}
