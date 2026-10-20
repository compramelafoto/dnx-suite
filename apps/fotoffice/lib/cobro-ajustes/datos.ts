/**
 * Ajustes de cobro de la organización (etapa B, 15/10/2026). Módulo PURO: valores de fábrica,
 * validación de lo que llega del formulario y lo que se puede mostrar en las páginas públicas.
 *
 * - `autoConfirmarPedido`: crear el pedido solo cuando el cliente acepta el presupuesto (apagado por
 *   omisión; se enciende con el OK del dueño).
 * - Datos para transferir (alias, CBU o CVU, titular, CUIT, banco): se muestran en el enlace del pedido.
 * - `montoUnico`: sumar de 1 a 99 pesos a cada transferencia esperada (para la conciliación).
 */

export type AjustesCobro = {
  autoConfirmarPedido: boolean;
  alias: string | null;
  cbuCvu: string | null;
  titular: string | null;
  cuit: string | null;
  banco: string | null;
  montoUnico: boolean;
};

export const AJUSTES_COBRO_DE_FABRICA: AjustesCobro = {
  autoConfirmarPedido: false,
  alias: null,
  cbuCvu: null,
  titular: null,
  cuit: null,
  banco: null,
  montoUnico: false,
};

export type DatosTransferencia = Pick<AjustesCobro, "alias" | "cbuCvu" | "titular" | "cuit" | "banco">;

export const MAX_TEXTO_COBRO = 120;

const ALIAS = /^[A-Za-z0-9.-]{6,20}$/;

type Resultado = { ok: true; valor: AjustesCobro } | { ok: false; error: string };

function texto(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, MAX_TEXTO_COBRO) : null;
}

const digitos = (v: string | null) => (v === null ? null : v.replace(/[\s.-]/g, ""));

export function validarAjustesCobro(raw: unknown): Resultado {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Los datos de cobro no son válidos." };
  const r = raw as Record<string, unknown>;
  const alias = texto(r.alias);
  if (alias !== null && !ALIAS.test(alias)) return { ok: false, error: "El alias tiene de 6 a 20 caracteres: letras, números, puntos y guiones." };
  const cbuCvu = digitos(texto(r.cbuCvu));
  if (cbuCvu !== null && !/^\d{22}$/.test(cbuCvu)) return { ok: false, error: "El CBU o CVU tiene que tener 22 números." };
  const cuit = digitos(texto(r.cuit));
  if (cuit !== null && !/^\d{11}$/.test(cuit)) return { ok: false, error: "El CUIT tiene que tener 11 números." };
  return {
    ok: true,
    valor: {
      autoConfirmarPedido: r.autoConfirmarPedido === true,
      alias,
      cbuCvu,
      titular: texto(r.titular),
      cuit,
      banco: texto(r.banco),
      montoUnico: r.montoUnico === true,
    },
  };
}

/** Lo que ve el cliente para transferir. null si no hay alias ni CBU/CVU (no se ofrece transferir). */
export function datosTransferenciaPublicos(a: AjustesCobro): DatosTransferencia | null {
  if (!a.alias && !a.cbuCvu) return null;
  return { alias: a.alias, cbuCvu: a.cbuCvu, titular: a.titular, cuit: a.cuit, banco: a.banco };
}
