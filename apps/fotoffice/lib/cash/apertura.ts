/**
 * Saldo de apertura de las cuentas de Caja al arrancar (etapa E, spec 7.5). Módulo PURO.
 *
 * Es el mismo **saldo inicial** que se carga a mano en Caja → Configuración
 * (`lib/cash/opening-balance.ts`): un INGRESO con `sourceModule = "saldo-inicial"`, sin turno ni
 * categoría, que suma al saldo de la cuenta y que los informes saltean (no es plata que entró al
 * negocio: ya estaba). Este módulo sólo arma el plan para cargarlo de una vez desde un archivo,
 * creando las cuentas que falten. Las reglas son las de la pantalla: a lo sumo un saldo inicial
 * vigente por cuenta, y para cambiarlo se anula (queda a la vista) y se vuelve a cargar.
 *
 * Un saldo que todavía no se sabe queda "pendiente": no se crea nada, y se carga después con el
 * mismo archivo o desde Configuración. Reemplazar un saldo ya cargado es a propósito (`--reemplazar`).
 */
import { z } from "zod";

export type CuentaApertura = {
  nombre: string;
  tipo: "EFECTIVO" | "DIGITAL";
  esBoveda: boolean;
  /** `null` = todavía no se sabe. */
  saldoCentavos: number | null;
  /** Otros nombres con que puede existir la cuenta (p. ej. "Mostrador" = "Caja diaria"). */
  tambien?: string[];
};

export type CuentaExistente = { id: string; name: string; kind: string; isVault: boolean; isActive: boolean };
/** El saldo inicial vigente de una cuenta (`openingBalancesByAccount`). */
export type AperturaExistente = { accountId: string; movementId: string; centavos: number };

export type PasoApertura =
  | { tipo: "crear-cuenta"; cuenta: string; kind: "EFECTIVO" | "DIGITAL"; isVault: boolean }
  /** `cuentaId` null = la cuenta se crea en el paso anterior. */
  | { tipo: "registrar-saldo"; cuenta: string; cuentaId: string | null; centavos: number }
  /** Anula el saldo inicial vigente y carga el nuevo (`aCentavos` 0 = sólo anularlo). */
  | { tipo: "reemplazar-saldo"; cuenta: string; cuentaId: string; movimientoId: string; deCentavos: number; aCentavos: number }
  | { tipo: "pendiente"; cuenta: string; cuentaId: string | null; motivo: string }
  | { tipo: "sin-cambios"; cuenta: string; cuentaId: string | null; motivo: string }
  | { tipo: "conflicto"; cuenta: string; motivo: string };

function igual(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");
}

export function planDeApertura(
  pedido: readonly CuentaApertura[],
  existentes: readonly CuentaExistente[],
  aperturas: readonly AperturaExistente[],
  opciones: { reemplazar?: boolean } = {},
): PasoApertura[] {
  const pasos: PasoApertura[] = [];
  for (const c of pedido) {
    const nombres = [c.nombre, ...(c.tambien ?? [])];
    const cuenta = nombres.map((n) => existentes.find((e) => igual(e.name, n))).find(Boolean) ?? null;
    const comoOtra = cuenta && !igual(cuenta.name, c.nombre) ? ` (es la cuenta "${cuenta.name}")` : "";
    if (c.saldoCentavos !== null && (c.saldoCentavos < 0 || !Number.isSafeInteger(c.saldoCentavos))) {
      pasos.push({ tipo: "conflicto", cuenta: c.nombre, motivo: "El saldo de apertura no puede ser negativo." });
      continue;
    }
    if (cuenta && cuenta.kind !== c.tipo) {
      pasos.push({ tipo: "conflicto", cuenta: c.nombre, motivo: `La cuenta existe como ${cuenta.kind}, no como ${c.tipo}.` });
      continue;
    }
    if (cuenta && !cuenta.isActive) {
      pasos.push({ tipo: "conflicto", cuenta: c.nombre, motivo: "La cuenta está dada de baja: reactivarla primero en Caja → Cuentas y categorías." });
      continue;
    }
    if (!cuenta) pasos.push({ tipo: "crear-cuenta", cuenta: c.nombre, kind: c.tipo, isVault: c.esBoveda });
    const id = cuenta?.id ?? null;
    if (c.saldoCentavos === null) {
      pasos.push({ tipo: "pendiente", cuenta: c.nombre, cuentaId: id, motivo: `Saldo sin informar${comoOtra}: se carga cuando se sepa.` });
      continue;
    }
    const previa = id ? aperturas.find((a) => a.accountId === id) : undefined;
    if (!previa) {
      if (c.saldoCentavos === 0) pasos.push({ tipo: "sin-cambios", cuenta: c.nombre, cuentaId: id, motivo: `Arranca en $0${comoOtra}: no hace falta asiento.` });
      else pasos.push({ tipo: "registrar-saldo", cuenta: c.nombre, cuentaId: id, centavos: c.saldoCentavos });
      continue;
    }
    if (previa.centavos === c.saldoCentavos) {
      pasos.push({ tipo: "sin-cambios", cuenta: c.nombre, cuentaId: id, motivo: "El saldo inicial ya está cargado con ese importe." });
    } else if (!opciones.reemplazar) {
      pasos.push({
        tipo: "conflicto",
        cuenta: c.nombre,
        motivo: "Ya tiene otro saldo inicial. Para cambiarlo, correr con --reemplazar (se anula el actual y se carga el nuevo).",
      });
    } else {
      pasos.push({ tipo: "reemplazar-saldo", cuenta: c.nombre, cuentaId: id!, movimientoId: previa.movementId, deCentavos: previa.centavos, aCentavos: c.saldoCentavos });
    }
  }
  return pasos;
}

const PedidoSchema = z.object({
  /** Día de arranque (AAAA-MM-DD, Argentina). */
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cuentas: z.array(
    z.object({
      nombre: z.string().trim().min(1),
      tipo: z.enum(["EFECTIVO", "DIGITAL"]),
      esBoveda: z.boolean().optional(),
      /** Pesos; `null` = todavía no se sabe. */
      saldo: z.number().nullable(),
      tambien: z.array(z.string()).optional(),
    }),
  ),
});

/** Lee el archivo de cuentas de apertura (JSON). */
export function leerPedidoApertura(entrada: unknown): { ok: true; fecha: string; cuentas: CuentaApertura[] } | { ok: false; error: string } {
  const p = PedidoSchema.safeParse(entrada);
  if (!p.success) return { ok: false, error: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return {
    ok: true,
    fecha: p.data.fecha,
    cuentas: p.data.cuentas.map((c) => ({
      nombre: c.nombre,
      tipo: c.tipo,
      esBoveda: c.esBoveda ?? false,
      saldoCentavos: c.saldo === null ? null : Math.round(c.saldo * 100),
      tambien: c.tambien ?? [],
    })),
  };
}

/** Medianoche de Argentina (UTC−3, sin horario de verano) del día de arranque. */
export function instanteDeApertura(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000-03:00`);
}
