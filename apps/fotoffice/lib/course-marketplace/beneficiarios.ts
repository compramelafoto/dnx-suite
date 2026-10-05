import { BPS_TOTAL, MAX_RECEPTORES_SPLIT, formatoPorcentaje, type BeneficiarioEntrada } from "./reparto";

/**
 * Reglas de los beneficiarios de un curso. Puras.
 *
 * Un curso sin filas, o con una sola que es su dueño al 100%, es "sin reparto": se vende como hoy,
 * sin split. Cualquier otro caso necesita el split de Mercado Pago (apagado hasta que MP lo
 * habilite) y que todos hayan aceptado y conectado su Mercado Pago.
 */

export type RolBeneficiario = "DOCENTE" | "PRODUCTOR" | "INSTITUCION" | "OTRO";

export type BeneficiarioRegistrado = {
  id: string;
  workspaceId: string | null;
  invitedEmail: string | null;
  nombre: string;
  role: RolBeneficiario;
  shareBps: number;
  absorbsProcessorFee: boolean;
  status: "INVITADO" | "ACEPTADO" | "RECHAZADO";
  mpConectado: boolean;
};

export type FilaBeneficiario = {
  id?: string;
  workspaceId: string | null;
  invitedEmail: string | null;
  role: RolBeneficiario;
  shareBps: number;
  absorbsProcessorFee: boolean;
};

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Tope, porcentajes enteros y positivos, suma 100% y un solo absorbente. Sin mirar quién es cada fila. */
function validarPorcentajes(filas: Array<Pick<FilaBeneficiario, "shareBps" | "absorbsProcessorFee">>): string[] {
  const errores: string[] = [];
  if (filas.length === 0) return ["Tiene que haber al menos un beneficiario."];
  if (filas.length > MAX_RECEPTORES_SPLIT) {
    errores.push(`Un curso puede tener ${MAX_RECEPTORES_SPLIT} beneficiarios como máximo.`);
  }
  if (filas.some((f) => !Number.isInteger(f.shareBps) || f.shareBps <= 0)) {
    errores.push("Cada beneficiario tiene que tener un porcentaje mayor que cero.");
  }
  const suma = filas.reduce((s, f) => s + f.shareBps, 0);
  if (suma !== BPS_TOTAL) errores.push(`Los porcentajes suman ${formatoPorcentaje(suma)}: tienen que sumar 100%.`);
  if (filas.filter((f) => f.absorbsProcessorFee).length !== 1) {
    errores.push("Un beneficiario, y sólo uno, tiene que absorber la comisión de Mercado Pago.");
  }
  return errores;
}

export function validarFilas(filas: FilaBeneficiario[]): string[] {
  const errores = validarPorcentajes(filas);
  const vistos = new Set<string>();
  for (const f of filas) {
    const tieneNegocio = Boolean(f.workspaceId);
    const tieneCorreo = Boolean(f.invitedEmail?.trim());
    if (tieneNegocio === tieneCorreo) {
      errores.push("Cada beneficiario es un negocio o un correo invitado, uno de los dos.");
      continue;
    }
    if (tieneCorreo && !CORREO.test(f.invitedEmail!.trim())) {
      errores.push(`"${f.invitedEmail}" no parece un correo.`);
    }
    const clave = tieneNegocio ? `ws:${f.workspaceId}` : `mail:${f.invitedEmail!.trim().toLowerCase()}`;
    if (vistos.has(clave)) errores.push("Hay un beneficiario repetido.");
    vistos.add(clave);
  }
  return [...new Set(errores)];
}

export function esSinReparto(
  ownerWorkspaceId: string,
  registrados: Array<Pick<BeneficiarioRegistrado, "workspaceId" | "shareBps">>,
): boolean {
  if (registrados.length === 0) return true;
  return registrados.length === 1 && registrados[0].workspaceId === ownerWorkspaceId && registrados[0].shareBps === BPS_TOTAL;
}

type EstadoBeneficiario = "INVITADO" | "ACEPTADO" | "RECHAZADO";

/**
 * Estado de una fila al guardar la lista. El dueño siempre acepta; una fila nueva, o cualquier
 * cambio que le mueva plata o condiciones (%, rol, negocio, correo, quién absorbe la comisión de
 * Mercado Pago), vuelve a pedir su aceptación. Sin cambios conserva el estado.
 */
export function estadoTrasGuardar(
  previo: {
    status: EstadoBeneficiario;
    shareBps: number;
    role: string;
    workspaceId: string | null;
    invitedEmail: string | null;
    absorbsProcessorFee: boolean;
  } | null,
  fila: FilaBeneficiario,
  esDueno: boolean,
): { status: EstadoBeneficiario; cambiaron: boolean } {
  const cambiaron =
    !previo ||
    previo.shareBps !== fila.shareBps ||
    previo.role !== fila.role ||
    previo.workspaceId !== fila.workspaceId ||
    previo.invitedEmail !== fila.invitedEmail ||
    previo.absorbsProcessorFee !== fila.absorbsProcessorFee;
  if (esDueno) return { status: "ACEPTADO", cambiaron };
  return { status: cambiaron ? "INVITADO" : previo!.status, cambiaron };
}

export function beneficiariosParaMotor(
  owner: { workspaceId: string; nombre: string },
  registrados: Array<Pick<BeneficiarioRegistrado, "id" | "workspaceId" | "nombre" | "shareBps" | "absorbsProcessorFee">>,
): BeneficiarioEntrada[] {
  if (registrados.length === 0) {
    return [{ id: owner.workspaceId, nombre: owner.nombre, bps: BPS_TOTAL, absorbeMp: true }];
  }
  return registrados.map((r) => ({
    id: r.workspaceId ?? r.id,
    nombre: r.nombre,
    bps: r.shareBps,
    // Con un solo beneficiario, él absorbe: el motor siempre necesita alguien que absorba.
    absorbeMp: registrados.length === 1 ? true : r.absorbsProcessorFee,
  }));
}

export type EstadoDeVenta = { tipo: "SIN_REPARTO" } | { tipo: "CON_REPARTO"; listo: boolean; faltantes: string[] };

export function estadoDeVenta(ownerWorkspaceId: string, registrados: BeneficiarioRegistrado[]): EstadoDeVenta {
  if (esSinReparto(ownerWorkspaceId, registrados)) return { tipo: "SIN_REPARTO" };
  const faltantes: string[] = [];
  for (const r of registrados) {
    if (!r.workspaceId) faltantes.push(`${r.nombre} todavía no tiene su negocio en FOTOFFICE.`);
    if (r.status === "RECHAZADO") faltantes.push(`${r.nombre} rechazó ser beneficiario.`);
    else if (r.status === "INVITADO") faltantes.push(`${r.nombre} todavía no aceptó.`);
    else if (!r.mpConectado) faltantes.push(`${r.nombre} no conectó Mercado Pago.`);
  }
  faltantes.push(...validarPorcentajes(registrados));
  return { tipo: "CON_REPARTO", listo: faltantes.length === 0, faltantes };
}
