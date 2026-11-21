"use server";

import { contextoDeFicha, contextoDeLecturaDeNotas, type PersonaPedida } from "@/lib/ficha/acceso";
import { asegurarCategorias, listarCategorias } from "@/lib/ficha/categorias";
import { listarNotas } from "@/lib/ficha/notas";

/**
 * SÓLO LECTURA: las notas del cliente para la ventana del ícono de notas del tablero. Vive aparte
 * de `ficha.ts` a propósito: ahí ninguna acción puede usar el contexto de lectura (escribir exige
 * "Gestionar"). La nota nueva se guarda con `crearNotaAction` de `ficha.ts`.
 */

type Falla = { ok: false; error: string };
const SIN_ACCESO: Falla = { ok: false, error: "No tenés acceso a esta ficha." };
const DATOS_INVALIDOS: Falla = { ok: false, error: "Los datos no son válidos." };

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 100;
}

/** Cuántas notas trae la ventana del tablero: las fijadas primero y después las más recientes. */
const NOTAS_EN_VENTANA = 100;

export type NotaDeVentana = {
  id: string;
  texto: string;
  categoria: string | null;
  fijada: boolean;
  autor: string;
  /** ISO de cuándo se escribió. */
  fecha: string;
  editada: boolean;
};

export type NotasDelCliente =
  | {
      ok: true;
      notas: NotaDeVentana[];
      categorias: { id: string; nombre: string }[];
      /** Con "Gestionar" en Clientes se escribe; con "Ver", sólo se leen. */
      puedeEscribir: boolean;
    }
  | Falla;

/**
 * Las notas del cliente de una tarjeta del tablero, con los mismos permisos de la ficha: con
 * "Gestionar" en Clientes se leen y se escriben; con "Ver", sólo se leen. La nota nueva se guarda
 * con `crearNotaAction`, así queda en el historial del cliente igual que desde su ficha.
 */
export async function notasDelClienteAction(clientId: string): Promise<NotasDelCliente> {
  if (!idValido(clientId)) return DATOS_INVALIDOS;
  const persona: PersonaPedida = { tipo: "CLIENTE", id: clientId };
  const escritura = await contextoDeFicha(persona);
  const ctx = escritura ?? (await contextoDeLecturaDeNotas(persona));
  if (!ctx) return SIN_ACCESO;
  if (escritura) await asegurarCategorias(escritura.workspaceId, escritura.workspaceSlug);
  const [notas, categorias] = await Promise.all([
    listarNotas(ctx.workspaceId, ctx.persona, { take: NOTAS_EN_VENTANA }),
    escritura ? listarCategorias(ctx.workspaceId) : Promise.resolve([]),
  ]);
  return {
    ok: true,
    puedeEscribir: !!escritura,
    categorias: categorias.map((c) => ({ id: c.id, nombre: c.name })),
    notas: notas.map((n) => ({
      id: n.id,
      texto: n.body,
      categoria: n.category?.name ?? null,
      fijada: n.pinned,
      autor: n.authorLabel ?? "",
      fecha: n.createdAt.toISOString(),
      editada: n.editedAt !== null,
    })),
  };
}
