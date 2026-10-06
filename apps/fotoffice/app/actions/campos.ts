"use server";

import { revalidatePath } from "next/cache";
import { puedeEnContexto } from "@/lib/access/policy";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { contextoDeCampos } from "@/lib/campos/acceso";
import { MAX_TEXTO_LARGO } from "@/lib/campos/constantes";
import { esTipoRegistroActivo } from "@/lib/campos/definiciones";
import { guardarValores, registroDelWorkspace, MENSAJES_VALORES, type ResultadoGuardado } from "@/lib/campos/valores";

// Archivo "use server": sólo exporta funciones async. La acción valida la forma de lo que
// recibe, arma el contexto (sesión + workspace), verifica que el módulo del tipo esté
// encendido, exige `operar` y que el registro sea del workspace, y recién ahí guarda.

type Falla = { ok: false; error: string };

const DATOS_INVALIDOS: Falla = { ok: false, error: "Los datos no son válidos." };
const SIN_ACCESO: Falla = { ok: false, error: MENSAJES_VALORES.sinPermiso };
const MODULO_APAGADO: Falla = { ok: false, error: "Ese módulo no está activo." };
const NO_ENCONTRADO: Falla = { ok: false, error: MENSAJES_VALORES.noEncontrado };

const MODULO = { CLIENTE: CLIENTS_MODULE_KEY, SOCIO: MEMBERS_MODULE_KEY, CONSULTA: SERVICE_LEADS_MODULE_KEY } as const;

function rutaFicha(entityType: keyof typeof MODULO, id: string): string {
  const seguro = encodeURIComponent(id);
  if (entityType === "CLIENTE") return `/clientes/${seguro}`;
  if (entityType === "SOCIO") return `/members/${seguro}`;
  return `/consultas/${seguro}`;
}

const MAX_CLAVES = 100;

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 100;
}
function valorValido(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v === "string") return v.length <= MAX_TEXTO_LARGO + 100;
  return typeof v === "number" && Number.isFinite(v);
}
function valoresValidos(v: unknown): v is Record<string, string | number | null> {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) return false;
  const entradas = Object.entries(v);
  return entradas.length <= MAX_CLAVES && entradas.every(([k, x]) => idValido(k) && valorValido(x));
}

export async function guardarValoresAction(datos: {
  entityType: string;
  entityId: string;
  valores: Record<string, string | number | null>;
}): Promise<ResultadoGuardado> {
  if (
    !datos || typeof datos !== "object" || !esTipoRegistroActivo(datos.entityType) || !idValido(datos.entityId)
    || !valoresValidos(datos.valores)
  ) {
    return DATOS_INVALIDOS;
  }
  const { entityType, entityId } = datos;
  const ctx = await contextoDeCampos();
  if (!ctx) return SIN_ACCESO;
  if (!(await isModuleEnabledForWorkspace(ctx.workspaceId, MODULO[entityType]))) return MODULO_APAGADO;
  if (!puedeEnContexto(ctx, "operar", MODULO[entityType])) return SIN_ACCESO;
  if (!(await registroDelWorkspace(ctx.workspaceId, entityType, entityId))) return NO_ENCONTRADO;
  const r = await guardarValores(ctx, entityType, entityId, datos.valores);
  if (r.ok) revalidatePath(rutaFicha(entityType, entityId));
  return r;
}
