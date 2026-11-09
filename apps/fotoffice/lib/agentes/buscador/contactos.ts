/**
 * Escritura de Contactos DNX: el camino por el que todos los agentes (Buscador, Muestras, Radar,
 * carga inicial) y el panel guardan contactos sin duplicarlos. Empareja por claves normalizadas,
 * completa sólo lo vacío, deja cada valor visto como `DnxContactoDato` con su fuente y anota todo
 * en `DnxContactoEvento`.
 *
 * `NO_CONTACTAR` es permanente: ningún proceso automático lo cambia; sólo una persona, forzando.
 */
import "server-only";
import { prisma, type Prisma } from "@repo/db";
import {
  ESTADOS_CONTACTO, FUENTES_DATO, plataformasPorTipo,
  type EstadoContacto, type FuenteDato, type Region, type TipoContacto,
} from "./tipos";
import {
  claveDominio, claveEmail, claveInstagram, claveNombreCiudad, claveTelefono, clavesDe, type ClavesContacto,
} from "./normalizar";

type Db = Prisma.TransactionClient;

/** Workspace de DNX Estudio: sus clientes son los «conocidos» (vínculo `CONOCIDO_DNX_ESTUDIO`). */
export const WORKSPACE_DNX_ESTUDIO = "cmv5z6qxwwmmhf0q5gp8qja1j";

export const CAMPOS_DATO = ["web", "instagram", "facebook", "email", "telefono", "whatsapp"] as const;
export type CampoDato = (typeof CAMPOS_DATO)[number];

export type DatoConFuente = { valor: string; fuente: FuenteDato; fuenteUrl: string | null };

export type Candidato = {
  tipo: TipoContacto;
  nichos: string[];
  nombre: string;
  ciudad: string | null;
  provincia: string | null;
  region: Region | null;
  googlePlaceId?: string | null;
  lat?: number | null;
  lng?: number | null;
  datos: Partial<Record<CampoDato, DatoConFuente>>;
  creadoPor: "BUSCADOR" | "MUESTRAS" | "RADAR" | "CARGA_INICIAL" | "MANUAL";
};

/** Un `autor` es una persona cuando es un `userId` (número); los agentes firman con su nombre. */
export function esAutorUsuario(autor: string): boolean {
  return /^\d+$/.test(autor.trim());
}

/** Cantidad de ciudades distintas a partir de la cual un correo o teléfono deja de identificar a alguien. */
const CIUDADES_PARA_DEJAR_DE_SER_LLAVE = 3;

type FilaContacto = Record<string, unknown> & { id: string };

// ---------------------------------------------------------------------------------------------
// Claves

/** La columna de clave que corresponde a cada campo (facebook no tiene). */
function columnaClave(campo: CampoDato): keyof ClavesContacto | null {
  if (campo === "web") return "claveDominio";
  if (campo === "instagram") return "claveInstagram";
  if (campo === "email") return "claveEmail";
  if (campo === "telefono" || campo === "whatsapp") return "claveTelefono";
  return null;
}

function claveDeCampo(campo: CampoDato, valor: string | null): string | null {
  if (campo === "web") return claveDominio(valor);
  if (campo === "instagram") return claveInstagram(valor);
  if (campo === "email") return claveEmail(valor);
  if (campo === "telefono" || campo === "whatsapp") return claveTelefono(valor);
  return null;
}

/** Dos valores de un campo son el mismo si coinciden sus claves o, sin clave, el texto limpio. */
function mismoValor(campo: CampoDato, a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const ka = claveDeCampo(campo, a), kb = claveDeCampo(campo, b);
  if (ka !== null && kb !== null) return ka === kb;
  const limpio = (s: string) => s.trim().toLowerCase().replace(/\/+$/, "");
  return limpio(a) === limpio(b);
}

function ciudadLimpia(c: unknown): string | null {
  if (typeof c !== "string") return null;
  const t = c.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return t === "" ? null : t;
}

/** Sigue la cadena de fusiones hasta el contacto que quedó. */
async function contactoFinal(db: Db, id: string): Promise<string> {
  let actual = id;
  for (let i = 0; i < 10; i++) {
    const f = await db.dnxContacto.findUnique({ where: { id: actual }, select: { fusionadoEnId: true } });
    if (!f?.fusionadoEnId) return actual;
    actual = f.fusionadoEnId;
  }
  return actual;
}

/**
 * El contacto que ya tiene alguna de estas claves, en orden: Google Place → dominio → Instagram →
 * correo → teléfono → nombre+ciudad. Un correo o teléfono presente en contactos de 3 o más ciudades
 * distintas (la central de una cadena, el correo de una federación) no cuenta como llave.
 * Si el que coincide se fusionó en otro, devuelve el que quedó.
 */
export async function buscarExistente(claves: ClavesContacto, googlePlaceId: string | null, db: Db = prisma): Promise<string | null> {
  if (googlePlaceId) {
    const f = await db.dnxContacto.findFirst({ where: { googlePlaceId }, select: { id: true } });
    if (f) return contactoFinal(db, f.id);
  }
  const orden: Array<keyof ClavesContacto> = ["claveDominio", "claveInstagram", "claveEmail", "claveTelefono", "claveNombreCiudad"];
  for (const col of orden) {
    const valor = claves[col];
    if (!valor) continue;
    const filas = await db.dnxContacto.findMany({
      where: { [col]: valor },
      select: { id: true, ciudad: true },
      orderBy: { creadoEn: "asc" },
    });
    if (filas.length === 0) continue;
    if (col === "claveEmail" || col === "claveTelefono") {
      const ciudades = new Set(filas.map((f) => ciudadLimpia(f.ciudad)).filter((c) => c !== null));
      if (ciudades.size >= CIUDADES_PARA_DEJAR_DE_SER_LLAVE) continue;
    }
    return contactoFinal(db, filas[0]!.id);
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Guardar

function validarFuentes(c: Candidato) {
  for (const [campo, d] of Object.entries(c.datos)) {
    if (!d) continue;
    // Las condiciones de Google Maps no permiten guardar sus datos: el tipo no lo deja, pero
    // un agente podría mandarlo igual en tiempo de ejecución.
    if (!(FUENTES_DATO as readonly string[]).includes(d.fuente)) {
      throw new Error(`Contactos DNX: fuente no admitida para ${campo}: ${String(d.fuente)} (nunca se guardan datos de GOOGLE_PLACES)`);
    }
    if (!(CAMPOS_DATO as readonly string[]).includes(campo)) throw new Error(`Contactos DNX: campo desconocido ${campo}`);
  }
}

function entradas(c: Candidato): Array<[CampoDato, DatoConFuente]> {
  return CAMPOS_DATO.flatMap((campo) => {
    const d = c.datos[campo];
    if (!d || typeof d.valor !== "string" || d.valor.trim() === "") return [];
    return [[campo, { ...d, valor: d.valor.trim() }] as [CampoDato, DatoConFuente]];
  });
}

function unir(a: unknown, b: readonly string[]): string[] {
  const base = Array.isArray(a) ? (a as string[]) : [];
  return [...base, ...b.filter((x) => !base.includes(x))];
}

async function crear(db: Db, c: Candidato, ahora: Date): Promise<{ contactoId: string; datosNuevos: number }> {
  const lista = entradas(c);
  const valor = (campo: CampoDato) => c.datos[campo]?.valor.trim() || null;
  const claves = clavesDe({
    web: valor("web"), instagram: valor("instagram"), email: valor("email"),
    telefono: valor("telefono") ?? valor("whatsapp"), nombre: c.nombre, ciudad: c.ciudad,
  });
  const creado = await db.dnxContacto.create({
    data: {
      tipo: c.tipo, nichos: unir([], c.nichos), plataformas: plataformasPorTipo(c.tipo),
      nombre: c.nombre.trim(), ciudad: c.ciudad, provincia: c.provincia, region: c.region,
      lat: c.lat ?? null, lng: c.lng ?? null, googlePlaceId: c.googlePlaceId ?? null,
      web: valor("web"), instagram: valor("instagram"), facebook: valor("facebook"),
      email: valor("email"), telefono: valor("telefono"), whatsapp: valor("whatsapp"),
      creadoPor: c.creadoPor, ...claves,
    },
    select: { id: true },
  });
  for (const [campo, d] of lista) {
    await db.dnxContactoDato.create({ data: { contactoId: creado.id, campo, valor: d.valor, fuente: d.fuente, fuenteUrl: d.fuenteUrl, vistoEn: ahora } });
  }
  await db.dnxContactoEvento.create({ data: { contactoId: creado.id, tipo: "CREADO", datos: { creadoPor: c.creadoPor }, autor: c.creadoPor, creadoEn: ahora } });
  return { contactoId: creado.id, datosNuevos: lista.length };
}

/** Completa sólo lo vacío, suma datos nuevos, nichos y plataformas. No toca `estado`. */
async function completar(db: Db, id: string, c: Candidato, ahora: Date): Promise<number> {
  const actual = (await db.dnxContacto.findUnique({ where: { id } })) as FilaContacto | null;
  if (!actual) throw new Error(`Contactos DNX: no existe el contacto ${id}`);
  const cambios: Record<string, unknown> = {};
  const vacio = (k: string) => actual[k] === null || actual[k] === undefined;

  for (const k of ["ciudad", "provincia", "region", "lat", "lng", "googlePlaceId"] as const) {
    const v = k === "lat" || k === "lng" || k === "googlePlaceId" ? (c[k] ?? null) : c[k];
    if (vacio(k) && v !== null && v !== undefined) cambios[k] = v;
  }
  if (vacio("claveNombreCiudad")) {
    const k = claveNombreCiudad(String(actual.nombre), (cambios.ciudad as string | undefined) ?? (actual.ciudad as string | null));
    if (k) cambios.claveNombreCiudad = k;
  }

  const previos = await db.dnxContactoDato.findMany({ where: { contactoId: id }, select: { id: true, campo: true, valor: true } });
  let nuevos = 0;
  for (const [campo, d] of entradas(c)) {
    if (vacio(campo) && cambios[campo] === undefined) {
      cambios[campo] = d.valor;
      const col = columnaClave(campo);
      const k = claveDeCampo(campo, d.valor);
      if (col && k && vacio(col) && cambios[col] === undefined) cambios[col] = k;
    }
    const visto = previos.find((p) => p.campo === campo && mismoValor(campo, p.valor, d.valor));
    if (visto) {
      await db.dnxContactoDato.update({ where: { id: visto.id }, data: { vistoEn: ahora } });
      continue;
    }
    // El valor ya estaba en la ficha aunque nunca se haya anotado su fuente: no es nuevo.
    if (mismoValor(campo, (actual[campo] as string | null) ?? null, d.valor)) continue;
    await db.dnxContactoDato.create({ data: { contactoId: id, campo, valor: d.valor, fuente: d.fuente, fuenteUrl: d.fuenteUrl, vistoEn: ahora } });
    previos.push({ id: "", campo, valor: d.valor });
    await db.dnxContactoEvento.create({
      data: { contactoId: id, tipo: "DATO_NUEVO", datos: { campo, valor: d.valor, fuente: d.fuente, fuenteUrl: d.fuenteUrl }, autor: c.creadoPor, creadoEn: ahora },
    });
    nuevos++;
  }

  const nichos = unir(actual.nichos, c.nichos);
  const plataformas = unir(actual.plataformas, plataformasPorTipo(c.tipo));
  if (nichos.length !== (actual.nichos as string[] | null)?.length) cambios.nichos = nichos;
  if (plataformas.length !== (actual.plataformas as string[] | null)?.length) cambios.plataformas = plataformas;
  if (Object.keys(cambios).length > 0) await db.dnxContacto.update({ where: { id }, data: cambios });
  return nuevos;
}

function esChoqueUnico(e: unknown): boolean {
  return (e as { code?: unknown })?.code === "P2002";
}

/**
 * Guarda un candidato: si ya existe (por sus claves), lo completa; si no, lo crea y lo intenta
 * vincular con un cliente de DNX Estudio. Todo en una transacción. Lanza si algún dato viene de
 * una fuente no admitida (en particular `GOOGLE_PLACES`).
 */
export async function guardarCandidato(
  c: Candidato,
  deps: { ahora?: () => Date } = {},
): Promise<{ contactoId: string; nuevo: boolean; datosNuevos: number }> {
  validarFuentes(c);
  const ahora = (deps.ahora ?? (() => new Date()))();
  const v = (campo: CampoDato) => c.datos[campo]?.valor ?? null;
  const claves = clavesDe({
    web: v("web"), instagram: v("instagram"), email: v("email"), telefono: v("telefono") ?? v("whatsapp"),
    nombre: c.nombre, ciudad: c.ciudad,
  });

  const intentar = () =>
    prisma.$transaction(async (tx) => {
      const existente = await buscarExistente(claves, c.googlePlaceId ?? null, tx);
      if (existente) return { contactoId: existente, nuevo: false, datosNuevos: await completar(tx, existente, c, ahora) };
      const r = await crear(tx, c, ahora);
      return { ...r, nuevo: true };
    });

  let r: { contactoId: string; nuevo: boolean; datosNuevos: number };
  try {
    r = await intentar();
  } catch (e) {
    // Otra corrida creó el mismo lugar de Google al mismo tiempo: la segunda vuelta lo encuentra.
    if (!esChoqueUnico(e)) throw e;
    r = await intentar();
  }
  if (r.nuevo) await vincularDnxEstudio(r.contactoId);
  return r;
}

// ---------------------------------------------------------------------------------------------
// Estado, notas y edición

export async function cambiarEstado(
  id: string,
  estado: EstadoContacto,
  autor: string,
  opciones: { forzar?: boolean } = {},
): Promise<{ ok: boolean; motivo?: string }> {
  if (!(ESTADOS_CONTACTO as readonly string[]).includes(estado)) return { ok: false, motivo: `Estado desconocido: ${estado}` };
  return prisma.$transaction(async (tx) => {
    const c = await tx.dnxContacto.findUnique({ where: { id }, select: { estado: true } });
    if (!c) return { ok: false, motivo: "El contacto no existe." };
    if (c.estado === estado) return { ok: true };
    const forzado = c.estado === "NO_CONTACTAR";
    if (forzado && !(opciones.forzar && esAutorUsuario(autor))) {
      return { ok: false, motivo: "Pidió no ser contactado: sólo una persona puede cambiarlo, y confirmándolo." };
    }
    await tx.dnxContacto.update({ where: { id }, data: { estado } });
    await tx.dnxContactoEvento.create({
      data: { contactoId: id, tipo: "ESTADO", datos: forzado ? { de: c.estado, a: estado, forzado: true } : { de: c.estado, a: estado }, autor },
    });
    return { ok: true };
  });
}

export async function agregarNota(id: string, texto: string, autor: string): Promise<void> {
  const t = texto.trim();
  if (t === "") throw new Error("Contactos DNX: la nota está vacía");
  await prisma.dnxContactoEvento.create({ data: { contactoId: id, tipo: "NOTA", datos: { texto: t }, autor } });
}

/** Corrige un dato a mano (fuente `MANUAL`). Con `null` lo borra de la ficha (el historial queda). */
export async function editarDato(id: string, campo: CampoDato, valor: string | null, autor: string): Promise<void> {
  if (!(CAMPOS_DATO as readonly string[]).includes(campo)) throw new Error(`Contactos DNX: campo desconocido ${campo}`);
  const nuevo = valor?.trim() || null;
  await prisma.$transaction(async (tx) => {
    const c = (await tx.dnxContacto.findUnique({ where: { id } })) as FilaContacto | null;
    if (!c) throw new Error(`Contactos DNX: no existe el contacto ${id}`);
    const data: Record<string, unknown> = { [campo]: nuevo };
    const col = columnaClave(campo);
    if (campo === "telefono" || campo === "whatsapp") {
      const tel = campo === "telefono" ? nuevo : ((c.telefono as string | null) ?? null);
      const wa = campo === "whatsapp" ? nuevo : ((c.whatsapp as string | null) ?? null);
      data.claveTelefono = claveTelefono(tel ?? wa);
    } else if (col) {
      data[col] = claveDeCampo(campo, nuevo);
    }
    await tx.dnxContacto.update({ where: { id }, data });
    if (nuevo) await tx.dnxContactoDato.create({ data: { contactoId: id, campo, valor: nuevo, fuente: "MANUAL", fuenteUrl: null } });
    await tx.dnxContactoEvento.create({
      data: { contactoId: id, tipo: "DATO_NUEVO", datos: { campo, valor: nuevo, anterior: (c[campo] as string | null) ?? null, fuente: "MANUAL" }, autor },
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Fusión

/**
 * Fusiona `origen` en `destino`: mueve datos y eventos, completa lo vacío del destino, deja el
 * origen `DESCARTADO` con `fusionadoEnId` y anota `FUSIONADO` en los dos. Si el origen había
 * pedido no ser contactado, el destino queda `NO_CONTACTAR` (el pedido no se pierde en la fusión).
 */
export async function fusionar(origenId: string, destinoId: string, autor: string): Promise<void> {
  if (origenId === destinoId) throw new Error("Contactos DNX: no se puede fusionar un contacto consigo mismo");
  await prisma.$transaction(async (tx) => {
    const o = (await tx.dnxContacto.findUnique({ where: { id: origenId } })) as FilaContacto | null;
    const d = (await tx.dnxContacto.findUnique({ where: { id: destinoId } })) as FilaContacto | null;
    if (!o || !d) throw new Error("Contactos DNX: alguno de los contactos no existe");
    if (o.fusionadoEnId || d.fusionadoEnId) throw new Error("Contactos DNX: alguno de los contactos ya estaba fusionado");

    await tx.dnxContactoDato.updateMany({ where: { contactoId: origenId }, data: { contactoId: destinoId } });
    await tx.dnxContactoEvento.updateMany({ where: { contactoId: origenId }, data: { contactoId: destinoId } });

    const vacio = (k: string) => d[k] === null || d[k] === undefined;
    const cambios: Record<string, unknown> = {};
    for (const k of [
      ...CAMPOS_DATO, "ciudad", "provincia", "region", "lat", "lng", "vinculo", "vinculoId",
      "claveDominio", "claveInstagram", "claveEmail", "claveTelefono", "claveNombreCiudad",
    ]) {
      if (vacio(k) && o[k] !== null && o[k] !== undefined) cambios[k] = o[k];
    }
    // El vínculo va completo o no va.
    if (!vacio("vinculo")) { delete cambios.vinculo; delete cambios.vinculoId; }
    cambios.nichos = unir(d.nichos, (o.nichos as string[] | null) ?? []);
    cambios.plataformas = unir(d.plataformas, (o.plataformas as string[] | null) ?? []);
    if (o.compradorClf) cambios.compradorClf = true;
    if (o.estado === "NO_CONTACTAR" && d.estado !== "NO_CONTACTAR") cambios.estado = "NO_CONTACTAR";

    // El lugar de Google es único: primero se suelta del origen.
    const moverPlace = vacio("googlePlaceId") && o.googlePlaceId;
    await tx.dnxContacto.update({
      where: { id: origenId },
      data: { estado: "DESCARTADO", fusionadoEnId: destinoId, ...(moverPlace ? { googlePlaceId: null } : {}) },
    });
    if (moverPlace) cambios.googlePlaceId = o.googlePlaceId;
    await tx.dnxContacto.update({ where: { id: destinoId }, data: cambios });

    if (cambios.estado === "NO_CONTACTAR") {
      await tx.dnxContactoEvento.create({
        data: { contactoId: destinoId, tipo: "ESTADO", datos: { de: d.estado as string, a: "NO_CONTACTAR", porFusionCon: origenId }, autor },
      });
    }
    await tx.dnxContactoEvento.create({ data: { contactoId: origenId, tipo: "FUSIONADO", datos: { en: destinoId }, autor } });
    await tx.dnxContactoEvento.create({ data: { contactoId: destinoId, tipo: "FUSIONADO", datos: { desde: origenId }, autor } });
  });
}

// ---------------------------------------------------------------------------------------------
// Vínculo con DNX Estudio

/** Últimos 4 dígitos del número nacional: filtran en la base; la comparación exacta se hace acá. */
function cola(tel: string): string {
  return tel.replace(/\D/g, "").slice(-4);
}

/**
 * Busca el contacto entre los clientes de DNX Estudio por correo (`email`, `email2` del perfil) o
 * teléfono (`phone`, `mobile` del perfil), comparando claves normalizadas. Si lo encuentra, lo
 * marca `CONOCIDO_DNX_ESTUDIO`. No pisa un vínculo que ya tenga.
 */
export async function vincularDnxEstudio(contactoId: string): Promise<boolean> {
  const c = await prisma.dnxContacto.findUnique({
    where: { id: contactoId },
    select: { email: true, telefono: true, whatsapp: true, vinculo: true },
  });
  if (!c) return false;
  if (c.vinculo) return c.vinculo === "CONOCIDO_DNX_ESTUDIO";

  const datos = await prisma.dnxContactoDato.findMany({
    where: { contactoId, campo: { in: ["email", "telefono", "whatsapp"] } },
    select: { campo: true, valor: true },
  });
  const emails = new Set([c.email, ...datos.filter((d) => d.campo === "email").map((d) => d.valor)].map((x) => claveEmail(x ?? null)).filter((x): x is string => !!x));
  const telefonos = new Set(
    [c.telefono, c.whatsapp, ...datos.filter((d) => d.campo !== "email").map((d) => d.valor)].map((x) => claveTelefono(x ?? null)).filter((x): x is string => !!x),
  );

  let encontrado: { clientId: string; por: "email" | "telefono" } | null = null;
  for (const e of emails) {
    const clientes = await prisma.client.findMany({
      where: { workspaceId: WORKSPACE_DNX_ESTUDIO, email: { contains: e, mode: "insensitive" } },
      select: { id: true, email: true },
    });
    const cl = clientes.find((x) => claveEmail(x.email) === e);
    if (cl) { encontrado = { clientId: cl.id, por: "email" }; break; }
    const perfiles = await prisma.fotofficeContactoPerfil.findMany({
      where: { workspaceId: WORKSPACE_DNX_ESTUDIO, email2: { contains: e, mode: "insensitive" } },
      select: { clientId: true, email2: true },
    });
    const p = perfiles.find((x) => claveEmail(x.email2) === e);
    if (p) { encontrado = { clientId: p.clientId, por: "email" }; break; }
  }
  if (!encontrado) {
    for (const t of telefonos) {
      const clientes = await prisma.client.findMany({
        where: { workspaceId: WORKSPACE_DNX_ESTUDIO, phone: { contains: cola(t) } },
        select: { id: true, phone: true },
      });
      const cl = clientes.find((x) => claveTelefono(x.phone) === t);
      if (cl) { encontrado = { clientId: cl.id, por: "telefono" }; break; }
      const perfiles = await prisma.fotofficeContactoPerfil.findMany({
        where: { workspaceId: WORKSPACE_DNX_ESTUDIO, mobile: { contains: cola(t) } },
        select: { clientId: true, mobile: true },
      });
      const p = perfiles.find((x) => claveTelefono(x.mobile) === t);
      if (p) { encontrado = { clientId: p.clientId, por: "telefono" }; break; }
    }
  }
  if (!encontrado) return false;

  const hallado = encontrado;
  await prisma.$transaction(async (tx) => {
    await tx.dnxContacto.update({ where: { id: contactoId }, data: { vinculo: "CONOCIDO_DNX_ESTUDIO", vinculoId: hallado.clientId } });
    await tx.dnxContactoEvento.create({
      data: { contactoId, tipo: "VINCULADO", datos: { vinculo: "CONOCIDO_DNX_ESTUDIO", clientId: hallado.clientId, por: hallado.por }, autor: "SISTEMA" },
    });
  });
  return true;
}
