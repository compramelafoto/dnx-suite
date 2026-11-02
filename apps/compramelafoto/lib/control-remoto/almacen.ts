import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@repo/db";
import {
  DURACION_SESION_MS,
  SIN_LATIDO_MS,
  type Comando,
  type ComandoNumerado,
  type EstadoPantalla,
} from "./protocolo";

/**
 * Sesiones del control remoto, guardadas en `SystemSettings` (clave `control-remoto:<id>`, el
 * valor es JSON). Es una tabla que ya existe en todas las bases: así el control no necesita una
 * migración en el schema compartido. Las sesiones vencen solas y las viejas se borran al abrir una.
 *
 * Seguridad: la base guarda sólo el hash de cada secreto.
 * - `pantalla`: la clave de la pantalla que abrió la sesión (la tiene sólo esa pestaña).
 * - `codigo`: el código del QR. Sirve UNA vez: al escanearlo se borra y el celular recibe su propia
 *   clave en una cookie. Quien fotografíe el QR después no puede usarlo.
 * - `celular`: la clave del celular vinculado. Pedir un código nuevo desconecta al anterior.
 *
 * Copia idéntica en FOTOFFICE (`apps/fotoffice/lib/control-remoto/almacen.ts`).
 */

const PREFIJO = "control-remoto:";
const MAX_COMANDOS = 30;
/** Cada cuánto se anota el latido de la pantalla aunque no cambie nada (para no escribir de más). */
const LATIDO_MS = 3000;

type Sesion = {
  v: 1;
  ambito: string;
  ref: string;
  vence: number;
  pantalla: string;
  codigo: string | null;
  celular: string | null;
  estado: EstadoPantalla | null;
  latidoPantalla: number;
  latidoCelular: number;
  seq: number;
  comandos: ComandoNumerado[];
};

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const secreto = () => randomBytes(24).toString("base64url");

function coincide(valor: string | null | undefined, hashGuardado: string | null): boolean {
  if (!valor || !hashGuardado) return false;
  const a = Buffer.from(hash(valor), "hex");
  const b = Buffer.from(hashGuardado, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

const idValido = (id: string) => /^[A-Za-z0-9_-]{16,40}$/.test(id);

async function leer(id: string): Promise<{ sesion: Sesion; crudo: string } | null> {
  if (!idValido(id)) return null;
  const fila = await prisma.systemSettings.findUnique({ where: { key: PREFIJO + id } });
  if (!fila) return null;
  try {
    const sesion = JSON.parse(fila.value) as Sesion;
    if (sesion.v !== 1 || sesion.vence < Date.now()) return null;
    return { sesion, crudo: fila.value };
  } catch {
    return null;
  }
}

/**
 * Lee, cambia y guarda sin pisar lo que otro escribió en el medio (la pantalla y el celular
 * escriben a la vez): si la fila cambió desde la lectura, se vuelve a intentar.
 */
async function modificar<T>(id: string, cambio: (s: Sesion) => { guardar: boolean; resultado: T }): Promise<T | null> {
  for (let intento = 0; intento < 6; intento++) {
    const actual = await leer(id);
    if (!actual) return null;
    const { guardar, resultado } = cambio(actual.sesion);
    if (!guardar) return resultado;
    const { count } = await prisma.systemSettings.updateMany({
      // El valor leído hace de candado: si otro escribió en el medio, no coincide y se reintenta.
      where: { key: PREFIJO + id, value: actual.crudo },
      data: { value: JSON.stringify(actual.sesion) },
    });
    if (count === 1) return resultado;
  }
  return null;
}

export type SesionNueva = { id: string; clave: string; codigo: string; vence: number };

export async function crearSesion(ambito: string, ref: string): Promise<SesionNueva> {
  const ahora = Date.now();
  // Limpieza de paso: las sesiones vencidas no sirven para nada.
  await prisma.systemSettings
    .deleteMany({ where: { key: { startsWith: PREFIJO }, updatedAt: { lt: new Date(ahora - DURACION_SESION_MS - 60 * 60 * 1000) } } })
    .catch(() => {});
  const id = randomBytes(12).toString("base64url");
  const clave = secreto();
  const codigo = secreto();
  const sesion: Sesion = {
    v: 1,
    ambito,
    ref,
    vence: ahora + DURACION_SESION_MS,
    pantalla: hash(clave),
    codigo: hash(codigo),
    celular: null,
    estado: null,
    latidoPantalla: ahora,
    latidoCelular: 0,
    seq: 0,
    comandos: [],
  };
  await prisma.systemSettings.create({
    data: { key: PREFIJO + id, value: JSON.stringify(sesion), description: "Control remoto (temporal)" },
  });
  return { id, clave, codigo, vence: sesion.vence };
}

export type RespuestaPantalla = {
  comandos: ComandoNumerado[];
  seq: number;
  celular: "esperando" | "conectado" | "desconectado";
  vence: number;
};

function estadoCelular(s: Sesion, ahora: number): RespuestaPantalla["celular"] {
  if (!s.celular) return "esperando";
  return ahora - s.latidoCelular < SIN_LATIDO_MS ? "conectado" : "desconectado";
}

/**
 * La pantalla consulta: publica su estado (si cambió) y se lleva las órdenes posteriores a
 * `desde`. Con `desde` negativo sólo se entera del número actual, sin órdenes viejas.
 */
export async function consultaDePantalla(
  id: string,
  clave: string,
  desde: number,
  estado: EstadoPantalla | null,
): Promise<RespuestaPantalla | null> {
  return modificar(id, (s) => {
    if (!coincide(clave, s.pantalla)) return { guardar: false, resultado: null };
    const ahora = Date.now();
    let guardar = false;
    if (estado) {
      s.estado = estado;
      guardar = true;
    }
    if (ahora - s.latidoPantalla > LATIDO_MS) guardar = true;
    if (guardar) s.latidoPantalla = ahora;
    return {
      guardar,
      resultado: {
        comandos: desde < 0 ? [] : s.comandos.filter((c) => c.seq > desde),
        seq: s.seq,
        celular: estadoCelular(s, ahora),
        vence: s.vence,
      },
    };
  });
}

/** Código nuevo para el QR: el celular que estaba vinculado queda afuera. */
export async function renovarCodigo(id: string, clave: string): Promise<string | null> {
  const codigo = secreto();
  return modificar(id, (s) => {
    if (!coincide(clave, s.pantalla)) return { guardar: false, resultado: null };
    s.codigo = hash(codigo);
    s.celular = null;
    s.latidoCelular = 0;
    return { guardar: true, resultado: codigo };
  });
}

export async function cerrarSesion(id: string, clave: string): Promise<boolean> {
  const actual = await leer(id);
  if (!actual || !coincide(clave, actual.sesion.pantalla)) return false;
  await prisma.systemSettings.deleteMany({ where: { key: PREFIJO + id } });
  return true;
}

/** El celular canjea el código del QR (una sola vez) por su clave propia. */
export async function vincularCelular(id: string, codigo: string): Promise<{ clave: string; vence: number } | null> {
  const clave = secreto();
  return modificar(id, (s) => {
    if (!coincide(codigo, s.codigo)) return { guardar: false, resultado: null };
    s.codigo = null;
    s.celular = hash(clave);
    s.latidoCelular = Date.now();
    return { guardar: true, resultado: { clave, vence: s.vence } };
  });
}

export type RespuestaCelular = { estado: EstadoPantalla | null; pantallaConectada: boolean; ambito: string; ref: string };

export async function consultaDeCelular(id: string, clave: string): Promise<RespuestaCelular | null> {
  return modificar(id, (s) => {
    if (!coincide(clave, s.celular)) return { guardar: false, resultado: null };
    const ahora = Date.now();
    const guardar = ahora - s.latidoCelular > LATIDO_MS;
    if (guardar) s.latidoCelular = ahora;
    return {
      guardar,
      resultado: {
        estado: s.estado,
        pantallaConectada: ahora - s.latidoPantalla < SIN_LATIDO_MS,
        ambito: s.ambito,
        ref: s.ref,
      },
    };
  });
}

export async function ordenDeCelular(id: string, clave: string, comando: Comando): Promise<boolean> {
  const r = await modificar(id, (s) => {
    if (!coincide(clave, s.celular)) return { guardar: false, resultado: false };
    s.seq += 1;
    s.comandos = [...s.comandos, { seq: s.seq, comando }].slice(-MAX_COMANDOS);
    s.latidoCelular = Date.now();
    return { guardar: true, resultado: true };
  });
  return r === true;
}

/** La cookie del celular: sólo viaja a la API de esa sesión. */
export const cookieCelular = (id: string) => ({ nombre: `cr_${id}`, ruta: `/api/control-remoto/${id}` });
