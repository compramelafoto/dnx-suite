/**
 * Consultas del Vendedor a CompraMeLaFoto. FOTOFFICE nunca lee la base de CLF: va por sus rutas
 * internas con `Authorization: Bearer <CLF_CONSULTA_USUARIOS_SECRET>`, con la misma configuración
 * que `buscador/clf.ts` (host con `www`, `redirect: "error"` y 10 s de espera).
 *
 * - `POST /api/internal/vendedor`: atribuciones por token, ventas, campaña escolar y conocimiento.
 * - `POST /api/internal/usuarios/existentes`: usuarios por correo o teléfono, con alta y baja.
 * - `GET /clubes`: si la página de clubes ya está publicada.
 *
 * El conocimiento y la campaña escolar se guardan en `SystemSettings` una vez por día argentino
 * (`consultaDiaria`), para no depender de CLF en cada correo. Nada de esto lanza: si CLF falla, se
 * devuelve `{ error }`.
 */
import "server-only";
import { prisma } from "@repo/db";
import { ROLES_PLATAFORMA } from "../buscador/clf";
import { cambiarEstado } from "../buscador/contactos";
import { claveEmail, claveTelefono } from "../buscador/normalizar";
import { diaArgentino } from "../periodista/horario";
import { guardarAjustesVendedor, leerAjustesVendedor } from "./ajustes";
import { AUTOR_VENDEDOR, URL_CLF } from "./tipos";

export type DepsClfVendedor = { fetch?: typeof fetch; url?: string; secreto?: string };

export const CLAVE_CONOCIMIENTO = "fotoffice_vendedor_conocimiento";
export const CLAVE_CAMPANA_ESCOLAR = "fotoffice_vendedor_campana_escolar";

const TIMEOUT_MS = 10_000;
/** Lo mismo que acepta CLF por pedido en cada ruta. */
const MAX_CLAVES_POR_LOTE = 200;
const MAX_ITEMS_POR_LOTE = 500;
/** La consulta diaria corre desde las 8 argentinas. */
const HORA_CONSULTA_AR = 8;
const DESFASE_AR_MS = 3 * 60 * 60 * 1000;

type Cfg = { fetch: typeof fetch; url: string; secreto: string };
type Error_ = { error: string };

export type Atribucion = { token: string; userId: number; rol: string; creadoEn: string };
export type UsuarioClf = { clave: string; userId: number; rol: string; creadoEn: string; baja: boolean };
export type VentasUsuario = { userId: number; ventas: number; totalPesos: number };

function configurar(deps: DepsClfVendedor): Cfg | Error_ {
  const secreto = (deps.secreto ?? process.env.CLF_CONSULTA_USUARIOS_SECRET ?? "").trim();
  if (!secreto) return { error: "Falta CLF_CONSULTA_USUARIOS_SECRET" };
  // Con `www`: sin él CLF redirige y `fetch` descarta el `Authorization` (ver `buscador/clf.ts`).
  const url = (deps.url ?? process.env.CLF_BASE_URL ?? URL_CLF).replace(/\/+$/, "");
  return { fetch: deps.fetch ?? fetch, url, secreto };
}

function comoObjeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function esError(x: unknown): x is Error_ {
  return !!x && typeof x === "object" && !Array.isArray(x) && !(x instanceof Set) && typeof (x as Error_).error === "string";
}

/** Un POST a CLF. Devuelve el cuerpo como objeto o un motivo de error propio (nunca el texto crudo). */
async function postClf(ruta: string, cuerpo: unknown, cfg: Cfg): Promise<Record<string, unknown> | Error_> {
  try {
    const res = await cfg.fetch(`${cfg.url}${ruta}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.secreto}` },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Una redirección perdería el secreto: mejor que falle a la vista que un 401 silencioso.
      redirect: "error",
    });
    if (!res.ok) return { error: `CLF respondió ${res.status}` };
    return comoObjeto(await res.json());
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "";
    if (nombre === "TimeoutError" || nombre === "AbortError") return { error: "CLF no respondió a tiempo" };
    return { error: "No se pudo consultar CLF (¿la dirección redirige? revisá CLF_BASE_URL)" };
  }
}

async function consultaVendedor(cuerpo: Record<string, unknown>, deps: DepsClfVendedor): Promise<Record<string, unknown> | Error_> {
  const cfg = configurar(deps);
  if (esError(cfg)) return cfg;
  return postClf("/api/internal/vendedor", cuerpo, cfg);
}

function enPartes<T>(lista: T[], tam: number): T[][] {
  const partes: T[][] = [];
  for (let i = 0; i < lista.length; i += tam) partes.push(lista.slice(i, i + tam));
  return partes;
}

const esTexto = (v: unknown): v is string => typeof v === "string";
const esEntero = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

// ---------------------------------------------------------------------------------------------
// Consultas sueltas

export async function traerConocimiento(deps: DepsClfVendedor = {}): Promise<{ texto: string; version: string } | Error_> {
  const r = await consultaVendedor({ consulta: "conocimiento" }, deps);
  if (esError(r)) return r;
  if (!esTexto(r.texto) || r.texto.trim() === "" || !esTexto(r.version)) return { error: "CLF respondió algo inesperado" };
  return { texto: r.texto, version: r.version };
}

export async function traerCampanaEscolar(deps: DepsClfVendedor = {}): Promise<string[] | Error_> {
  const r = await consultaVendedor({ consulta: "campana-escolar" }, deps);
  if (esError(r)) return r;
  if (!Array.isArray(r.emails)) return { error: "CLF respondió algo inesperado" };
  return [...new Set(r.emails.filter(esTexto).map((e) => e.trim().toLowerCase()).filter((e) => e !== ""))];
}

export async function traerAtribuciones(tokens: string[], deps: DepsClfVendedor = {}): Promise<Atribucion[] | Error_> {
  const out: Atribucion[] = [];
  for (const parte of enPartes([...new Set(tokens)], MAX_ITEMS_POR_LOTE)) {
    const r = await consultaVendedor({ consulta: "atribuciones", tokens: parte }, deps);
    if (esError(r)) return r;
    if (!Array.isArray(r.atribuciones)) return { error: "CLF respondió algo inesperado" };
    for (const a of r.atribuciones.map(comoObjeto)) {
      if (esTexto(a.token) && esEntero(a.userId) && esTexto(a.rol) && esTexto(a.creadoEn)) {
        out.push({ token: a.token, userId: a.userId, rol: a.rol, creadoEn: a.creadoEn });
      }
    }
  }
  return out;
}

/** Ventas por usuario en `[desde, hasta)`, contadas desde el registro de cada uno (las reglas viven en CLF). */
export async function traerVentas(
  input: { desde: Date; hasta: Date; usuarios: Array<{ userId: number; registradoEn: Date }> },
  deps: DepsClfVendedor = {},
): Promise<VentasUsuario[] | Error_> {
  const out: VentasUsuario[] = [];
  for (const parte of enPartes(input.usuarios, MAX_ITEMS_POR_LOTE)) {
    const r = await consultaVendedor(
      {
        consulta: "ventas",
        desde: input.desde.toISOString(),
        hasta: input.hasta.toISOString(),
        usuarios: parte.map((u) => ({ userId: u.userId, registradoEn: u.registradoEn.toISOString() })),
      },
      deps,
    );
    if (esError(r)) return r;
    if (!Array.isArray(r.ventas)) return { error: "CLF respondió algo inesperado" };
    for (const v of r.ventas.map(comoObjeto)) {
      // Una fila a medias no se descarta en silencio: el informe contaría de menos sin avisar.
      if (!(esEntero(v.userId) && esEntero(v.ventas) && typeof v.totalPesos === "number" && Number.isFinite(v.totalPesos))) {
        return { error: "CLF respondió algo inesperado" };
      }
      out.push({ userId: v.userId, ventas: v.ventas, totalPesos: v.totalPesos });
    }
  }
  return out;
}

/** Usuarios de CLF por correo o teléfono (claves ya normalizadas), en lotes de 200. */
export async function consultarUsuarios(emails: string[], telefonos: string[], deps: DepsClfVendedor = {}): Promise<UsuarioClf[] | Error_> {
  const cfg = configurar(deps);
  if (esError(cfg)) return cfg;
  const todas = [...new Set(emails)].map((v) => ({ v, e: true })).concat([...new Set(telefonos)].map((v) => ({ v, e: false })));
  const out: UsuarioClf[] = [];
  for (const parte of enPartes(todas, MAX_CLAVES_POR_LOTE)) {
    const lote = { emails: parte.filter((x) => x.e).map((x) => x.v), telefonos: parte.filter((x) => !x.e).map((x) => x.v) };
    const r = await postClf("/api/internal/usuarios/existentes", lote, cfg);
    if (esError(r)) return r;
    if (!Array.isArray(r.coincidencias)) return { error: "CLF respondió algo inesperado" };
    for (const c of r.coincidencias.map(comoObjeto)) {
      // Sin `creadoEn` no se puede saber si se registró después del correo: se descarta.
      if (esTexto(c.clave) && esEntero(c.userId) && esTexto(c.rol) && esTexto(c.creadoEn)) {
        out.push({ clave: c.clave, userId: c.userId, rol: c.rol, creadoEn: c.creadoEn, baja: c.baja === true });
      }
    }
  }
  return out;
}

/** `GET <url>/clubes` sin seguir redirecciones: publicada sólo si responde 200. */
export async function paginaClubesPublicada(deps: DepsClfVendedor = {}): Promise<boolean> {
  const url = (deps.url ?? process.env.CLF_BASE_URL ?? URL_CLF).replace(/\/+$/, "");
  try {
    const res = await (deps.fetch ?? fetch)(`${url}/clubes`, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.status === 200;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Cachés en SystemSettings

async function guardarCache(key: string, valor: unknown, description: string): Promise<void> {
  const value = JSON.stringify(valor);
  await prisma.systemSettings.upsert({ where: { key }, create: { key, value, description }, update: { value } });
}

async function leerCache(key: string): Promise<Record<string, unknown> | null> {
  const fila = await prisma.systemSettings.findUnique({ where: { key }, select: { value: true } });
  if (!fila?.value) return null;
  try {
    const v = JSON.parse(fila.value) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function leerConocimiento(): Promise<{ texto: string; version: string } | null> {
  const c = await leerCache(CLAVE_CONOCIMIENTO);
  if (!c || !esTexto(c.texto) || c.texto.trim() === "" || !esTexto(c.version)) return null;
  return { texto: c.texto, version: c.version };
}

export async function leerCampanaEscolar(): Promise<Set<string> | null> {
  const c = await leerCache(CLAVE_CAMPANA_ESCOLAR);
  if (!c || !Array.isArray(c.emails)) return null;
  return new Set(c.emails.filter(esTexto));
}

// ---------------------------------------------------------------------------------------------
// Contactos y registros

const esRolPlataforma = (rol: string) => (ROLES_PLATAFORMA as readonly string[]).includes(rol);

/** Las claves (correo y teléfonos) de cada contacto, y el índice clave → contactos. */
function indexar(contactos: Array<{ id: string; email: string | null; telefonos: Array<string | null> }>) {
  const porClave = new Map<string, Set<string>>();
  const emails = new Set<string>();
  const telefonos = new Set<string>();
  const anotar = (clave: string | null, id: string, conjunto: Set<string>) => {
    if (!clave) return;
    conjunto.add(clave);
    if (!porClave.has(clave)) porClave.set(clave, new Set());
    porClave.get(clave)!.add(id);
  };
  for (const c of contactos) {
    anotar(claveEmail(c.email), c.id, emails);
    for (const t of c.telefonos) anotar(claveTelefono(t), c.id, telefonos);
  }
  return { porClave, emails: [...emails], telefonos: [...telefonos] };
}

/** Coincidencias de CLF agrupadas por contacto. */
function porContacto(coincidencias: UsuarioClf[], porClave: Map<string, Set<string>>): Map<string, UsuarioClf[]> {
  const m = new Map<string, UsuarioClf[]>();
  for (const u of coincidencias) {
    for (const id of porClave.get(u.clave) ?? []) {
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push(u);
    }
  }
  return m;
}

/** Ids de los contactos que ya son usuarios de plataforma en CLF o que se dieron de baja allá. */
export async function bloqueadosEnClf(
  contactos: Array<{ id: string; email: string | null; telefono: string | null }>,
  deps: DepsClfVendedor = {},
): Promise<Set<string> | Error_> {
  const { porClave, emails, telefonos } = indexar(contactos.map((c) => ({ id: c.id, email: c.email, telefonos: [c.telefono] })));
  if (emails.length === 0 && telefonos.length === 0) return new Set();
  const r = await consultarUsuarios(emails, telefonos, deps);
  if (esError(r)) return r;
  const bloqueados = new Set<string>();
  for (const [id, us] of porContacto(r, porClave)) {
    if (us.some((u) => u.baja || esRolPlataforma(u.rol))) bloqueados.add(id);
  }
  return bloqueados;
}

/** Hilos ya cerrados por CLF: no se vuelven a mirar. */
/**
 * Hilos que ya no cambian: cerrados por CLF, o por una baja (el contacto ya está en NO_CONTACTAR).
 * Los demás cerrados (REBOTE, NO_INTERESA…) se siguen mirando sólo para detectar una baja en CLF.
 */
const CIERRES_FINALES = ["YA_ERA_USUARIO", "BAJA_CLF", "BAJA"];
/** Sólo un hilo abierto y sin respuesta puede cerrarlo CLF; uno con respuesta o esperando a Daniel, no. */
const ESTADOS_CERRABLES_POR_CLF = ["PENDIENTE_ENVIO", "ENVIADO", "RECORDADO"];

/**
 * Busca en CLF los registros de los hilos enviados que todavía no se registraron:
 * - **Cookie** (`clf_dnxv` con el token del hilo): cuenta, con la fecha de la atribución.
 * - **Correo o teléfono** de un usuario de plataforma: cuenta si el alta es posterior al primer
 *   correo; si es anterior, ya era usuario: el hilo se cierra `YA_ERA_USUARIO` y no cuenta.
 * - **Baja en CLF**: el contacto pasa a `NO_CONTACTAR` y el hilo a `BAJA` con `BAJA_CLF`.
 * Cada registro nuevo pasa el contacto a `SE_SUMO`. Si CLF falla, se usa lo que sí respondió y se
 * devuelve el error.
 *
 * Nunca pisa el cierre de otro motivo ni cierra un hilo que respondió o espera a Daniel: los cierres
 * de CLF (`YA_ERA_USUARIO`, `BAJA_CLF`) van sólo sobre hilos sin cierre en PENDIENTE_ENVIO, ENVIADO o
 * RECORDADO. Un registro nuevo se anota en cualquier hilo sin cierre, sin cambiarle el estado. En un
 * hilo ya cerrado sólo se mira la baja, que pasa el contacto a NO_CONTACTAR sin tocar el hilo.
 */
export async function actualizarRegistros(
  _ahora: Date,
  deps: DepsClfVendedor = {},
): Promise<{ nuevos: Array<{ hiloId: string; via: "COOKIE" | "EMAIL" }>; error?: string }> {
  const nuevos: Array<{ hiloId: string; via: "COOKIE" | "EMAIL" }> = [];
  const errores: string[] = [];
  try {
    const hilos = (
      await prisma.dnxVendedorHilo.findMany({
        // `cierre: null` aparte: `notIn` solo dejaría afuera las filas con cierre NULL.
        where: { enviadoEn: { not: null }, registradoEn: null, OR: [{ cierre: null }, { cierre: { notIn: CIERRES_FINALES } }] },
        select: { id: true, contactoId: true, token: true, enviadoEn: true, estado: true, cierre: true },
      })
    ).filter((h) => !CIERRES_FINALES.includes(h.cierre ?? ""));
    if (hilos.length === 0) return { nuevos };

    const contactos = await prisma.dnxContacto.findMany({
      where: { id: { in: hilos.map((h) => h.contactoId) } },
      select: { id: true, email: true, telefono: true, whatsapp: true },
    });
    const { porClave, emails, telefonos } = indexar(contactos.map((c) => ({ id: c.id, email: c.email, telefonos: [c.telefono, c.whatsapp] })));

    const atribuciones = await traerAtribuciones(hilos.map((h) => h.token), deps);
    if (esError(atribuciones)) errores.push(atribuciones.error);
    const porToken = new Map<string, Atribucion>();
    for (const a of esError(atribuciones) ? [] : atribuciones) {
      const previa = porToken.get(a.token);
      if (!previa || a.creadoEn < previa.creadoEn) porToken.set(a.token, a);
    }

    let usuarios: UsuarioClf[] = [];
    if (emails.length > 0 || telefonos.length > 0) {
      const r = await consultarUsuarios(emails, telefonos, deps);
      if (esError(r)) errores.push(r.error);
      else usuarios = r;
    }
    const deContacto = porContacto(usuarios, porClave);

    for (const h of hilos) {
      const enviadoEn = h.enviadoEn!.getTime();
      const us = deContacto.get(h.contactoId) ?? [];
      const atr = porToken.get(h.token);
      const sinCierre = h.cierre == null;
      const cerrablePorClf = sinCierre && ESTADOS_CERRABLES_POR_CLF.includes(h.estado);
      let registrado = false;

      if (!sinCierre) {
        // Cerrado por otro motivo: no se cuenta ni se cierra de nuevo; sólo la baja de abajo.
      } else if (atr) {
        await prisma.dnxVendedorHilo.update({
          where: { id: h.id },
          data: { registradoEn: new Date(atr.creadoEn), usuarioClfId: atr.userId, rolClf: atr.rol, viaRegistro: "COOKIE" },
        });
        nuevos.push({ hiloId: h.id, via: "COOKIE" });
        registrado = true;
      } else if (!esError(atribuciones)) {
        // Sin las atribuciones no se sabe si llegó por la cookie: el correo espera a la próxima corrida.
        const plataforma = us.filter((u) => esRolPlataforma(u.rol));
        const anteriores = plataforma.filter((u) => new Date(u.creadoEn).getTime() <= enviadoEn);
        const posteriores = plataforma
          .filter((u) => new Date(u.creadoEn).getTime() > enviadoEn)
          .sort((a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime());
        if (anteriores.length > 0) {
          // Ya tenía cuenta antes del primer correo: no es mérito del Vendedor (y no cuenta aunque el
          // hilo esté esperando a Daniel; ese hilo sigue como está).
          if (cerrablePorClf) await prisma.dnxVendedorHilo.update({ where: { id: h.id }, data: { estado: "CERRADO", cierre: "YA_ERA_USUARIO" } });
        } else if (posteriores[0]) {
          const u = posteriores[0];
          await prisma.dnxVendedorHilo.update({
            where: { id: h.id },
            data: { registradoEn: new Date(u.creadoEn), usuarioClfId: u.userId, rolClf: u.rol, viaRegistro: "EMAIL" },
          });
          nuevos.push({ hiloId: h.id, via: "EMAIL" });
          registrado = true;
        }
      }
      if (registrado) await cambiarEstado(h.contactoId, "SE_SUMO", AUTOR_VENDEDOR);

      if (us.some((u) => u.baja)) {
        // La baja manda: nunca más se le escribe (el registro, si lo hubo, queda contado).
        await cambiarEstado(h.contactoId, "NO_CONTACTAR", AUTOR_VENDEDOR);
        if (cerrablePorClf) await prisma.dnxVendedorHilo.update({ where: { id: h.id }, data: { estado: "BAJA", cierre: "BAJA_CLF" } });
      }
    }
  } catch (e) {
    console.error("[vendedor] falló la actualización de registros", e instanceof Error ? e.name : "");
    errores.push("No se pudieron guardar los registros de CLF");
  }
  return errores.length > 0 ? { nuevos, error: errores.join("; ") } : { nuevos };
}

function horaArgentina(ahora: Date): number {
  return new Date(ahora.getTime() - DESFASE_AR_MS).getUTCHours();
}

/**
 * Una vez por día argentino, desde las 8: refresca el conocimiento, la campaña escolar y si la
 * página de clubes está publicada, y actualiza los registros. Marca el día aunque algo falle.
 */
export async function consultaDiaria(
  ahora: Date,
  deps: DepsClfVendedor = {},
): Promise<{ hecha: boolean; registros: Array<{ hiloId: string; via: "COOKIE" | "EMAIL" }>; errores: string[] }> {
  const hoy = diaArgentino(ahora);
  const errores: string[] = [];
  let registros: Array<{ hiloId: string; via: "COOKIE" | "EMAIL" }> = [];
  try {
    const ajustes = await leerAjustesVendedor();
    if (ajustes.consultaClfDia === hoy || horaArgentina(ahora) < HORA_CONSULTA_AR) return { hecha: false, registros, errores };
  } catch (e) {
    console.error("[vendedor] no se pudieron leer los ajustes", e instanceof Error ? e.name : "");
    return { hecha: false, registros, errores: ["No se pudieron leer los ajustes del Vendedor"] };
  }

  const traidoEn = ahora.toISOString();
  let clubes = false;
  try {
    const conocimiento = await traerConocimiento(deps);
    if (esError(conocimiento)) errores.push(`Conocimiento: ${conocimiento.error}`);
    else await guardarCache(CLAVE_CONOCIMIENTO, { ...conocimiento, traidoEn }, "Conocimiento de CLF para el agente Vendedor");

    const campana = await traerCampanaEscolar(deps);
    if (esError(campana)) errores.push(`Campaña escolar: ${campana.error}`);
    else await guardarCache(CLAVE_CAMPANA_ESCOLAR, { emails: campana, traidoEn }, "Correos de la campaña escolar de octubre (CLF)");

    clubes = await paginaClubesPublicada(deps);

    const r = await actualizarRegistros(ahora, deps);
    registros = r.nuevos;
    if (r.error) errores.push(`Registros: ${r.error}`);
  } catch (e) {
    console.error("[vendedor] falló la consulta diaria a CLF", e instanceof Error ? e.name : "");
    errores.push("Falló la consulta diaria a CLF");
  }

  try {
    await guardarAjustesVendedor({ consultaClfDia: hoy, paginaClubesPublicada: clubes });
  } catch (e) {
    console.error("[vendedor] no se pudo marcar la consulta diaria", e instanceof Error ? e.name : "");
    errores.push("No se pudo marcar la consulta diaria");
  }
  return { hecha: true, registros, errores };
}
