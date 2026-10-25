/**
 * El presupuesto de un trabajo en el portal del socio. Módulo PURO: corre en el navegador y en las
 * pruebas, con el mismo motor que los presupuestos del panel (`calcularItemDelPanel`).
 *
 * La cuenta es la que enseña el artículo de la SFPR: el valor de tu hora (lo que necesitás ganar
 * por mes para vivir de la fotografía y cubrir los gastos fijos, dividido por las horas que cobrás)
 * por las horas del trabajo, más los gastos variables de ESE evento —asistente, viáticos,
 * impresiones—, que no son de todos los meses y por eso no entran en el valor de la hora.
 *
 * Los gastos variables entran al motor como «costo directo» del servicio: suman al costo del
 * trabajo sin ganancia encima, igual que en el panel.
 */
import type { CuantoCobroPriceBuildUp, CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { parseCuantoCobroAmount } from "@repo/cuanto-cobro-core";
import { calcularItemDelPanel, trabajoVacio } from "@/lib/presupuestos/panel-cuanto-cobro";

export type GastoVariable = { id: string; concepto: string; monto: string };

export type TrabajoSocio = {
  /** Boda, 15 años, corporativo… Sólo da nombre al cálculo. */
  tipoDeTrabajo: string;
  horasCobertura: string;
  horasEdicion: string;
  horasEntrega: string;
  horasViaje: string;
  /** Reuniones, mensajes, coordinación: el tiempo que el cliente se lleva fuera del evento. */
  horasCliente: string;
  gastos: GastoVariable[];
};

let contador = 0;
export function nuevoGasto(concepto = ""): GastoVariable {
  contador += 1;
  return { id: `gasto-${contador}`, concepto, monto: "" };
}

export function trabajoSocioVacio(): TrabajoSocio {
  return {
    tipoDeTrabajo: "",
    horasCobertura: "",
    horasEdicion: "",
    horasEntrega: "",
    horasViaje: "",
    horasCliente: "",
    // Los tres que más se olvidan. Se pueden borrar o dejar en cero.
    gastos: [nuevoGasto("Asistente"), nuevoGasto("Viáticos y traslado"), nuevoGasto("Impresiones o insumos")],
  };
}

const monto = (v: string): number => {
  const n = parseCuantoCobroAmount(v);
  return n !== null && Number.isFinite(n) && n > 0 ? n : 0;
};

/** Los gastos con importe, en el orden en que se cargaron. Un renglón vacío no cuenta. */
export function gastosConImporte(gastos: readonly GastoVariable[]): { concepto: string; monto: number }[] {
  return gastos
    .map((g) => ({ concepto: g.concepto.trim() || "Gasto del evento", monto: monto(g.monto) }))
    .filter((g) => g.monto > 0);
}

export type PresupuestoSocio = {
  /** Horas del trabajo entero: evento, edición, entrega, viaje y cliente. */
  horas: number;
  valorHora: number;
  gastos: { concepto: string; monto: number }[];
  totalGastos: number;
  /** Lo que cuesta hacerlo: tus horas al costo más los gastos del evento. Cobrar menos es perder plata. */
  costo: number;
  precioMinimo: number;
  precioRecomendado: number;
  /** El que sugiere el motor, con impuestos y recargos si el perfil los tiene cargados. */
  precioSugerido: number;
  /** Lo que queda arriba del costo con el precio sugerido. */
  ganancia: number;
  desglose: CuantoCobroPriceBuildUp | null;
  advertencias: string[];
};

export type ResultadoPresupuestoSocio = { ok: true; presupuesto: PresupuestoSocio } | { ok: false; error: string; faltan: string[] };

export function presupuestarTrabajo(
  perfil: CuantoCobroProfileInput,
  trabajo: TrabajoSocio,
  ahora: Date = new Date(),
): ResultadoPresupuestoSocio {
  const gastos = gastosConImporte(trabajo.gastos);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const nombre = trabajo.tipoDeTrabajo.trim() || "Trabajo";
  const r = calcularItemDelPanel(
    perfil,
    {
      ...trabajoVacio(nombre),
      horasCobertura: trabajo.horasCobertura.trim(),
      horasEdicion: trabajo.horasEdicion.trim(),
      horasEntrega: trabajo.horasEntrega.trim(),
      horasViaje: trabajo.horasViaje.trim(),
      horasCliente: trabajo.horasCliente.trim(),
      costoDirecto: totalGastos > 0 ? String(totalGastos) : "",
    },
    nombre,
    { id: "presupuesto-socio", nombre },
    ahora,
  );
  if (!r.ok) {
    // El mensaje del panel habla «del panel de ¿Cuánto Cobro?»: acá los datos están en los pasos.
    return { ok: false, error: r.faltan.length > 0 ? "Para calcular faltan estos datos:" : r.error, faltan: r.faltan };
  }
  const c = r.item.calculo!;
  return {
    ok: true,
    presupuesto: {
      horas: c.horasTotales,
      valorHora: c.valorHora,
      gastos,
      totalGastos,
      costo: c.costoBase,
      precioMinimo: c.precioMinimo,
      precioRecomendado: c.precioRecomendado,
      precioSugerido: c.precioSugerido,
      ganancia: c.margenElegido,
      desglose: c.desglose ?? null,
      advertencias: [...c.advertencias],
    },
  };
}
