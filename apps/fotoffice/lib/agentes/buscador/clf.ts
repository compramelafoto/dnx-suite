/**
 * Vínculo con CompraMeLaFoto: le pregunta a CLF cuáles de estos contactos ya son usuarios suyos.
 *
 * CLF tiene su propia base; la consulta va por `POST /api/internal/usuarios/existentes` con el
 * secreto `CLF_CONSULTA_USUARIOS_SECRET`, y CLF devuelve sólo `{ clave, userId, rol }` (nunca
 * nombres). Las claves son las mismas de `normalizar.ts` (correo en minúsculas, teléfono `+54…`).
 *
 * - Rol de plataforma (fotógrafo, organizador…) → `vinculo: "USUARIO_CLF"` + evento `VINCULADO`.
 *   Nunca pisa un vínculo que ya tenga (p. ej. `CONOCIDO_DNX_ESTUDIO`): ahí sólo anota el evento.
 * - `CUSTOMER` → `compradorClf: true` + evento `VINCULADO` con `{ comprador: true }`, sin vínculo.
 *
 * Si CLF falla devuelve `error` y no lanza. Decisión: no se lleva registro de «contactos sin
 * chequear» ni se reintenta en otra corrida (queda para más adelante); el motor la llama con los
 * contactos que guardó en cada corrida.
 */
import "server-only";
import { prisma } from "@repo/db";
import { claveEmail, claveTelefono } from "./normalizar";

export const ROLES_PLATAFORMA = ["PHOTOGRAPHER", "LAB_PHOTOGRAPHER", "ORGANIZER", "SCHOOL_ORGANIZER"] as const;

/** Lo mismo que acepta CLF por pedido. */
const MAX_CLAVES_POR_LOTE = 200;
const TIMEOUT_MS = 10_000;
/**
 * Con `www`: `https://compramelafoto.com` redirige (308) a `www`, y `fetch` descarta el encabezado
 * `Authorization` al seguir una redirección a otro origen, así que CLF respondería siempre 401.
 */
const URL_POR_OMISION = "https://www.compramelafoto.com";

export type DepsClf = { fetch?: typeof fetch; url?: string; secreto?: string };
export type ResultadoClf = { vinculados: number; compradores: number; error?: string };

type Coincidencia = { clave: string; userId: number; rol: string };

function esCoincidencia(x: unknown): x is Coincidencia {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.clave === "string" && typeof o.userId === "number" && Number.isInteger(o.userId) && typeof o.rol === "string";
}

function comoObjeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Un lote a CLF. Devuelve las coincidencias o un motivo de error (propio, nunca el texto crudo). */
async function consultar(
  lote: { emails: string[]; telefonos: string[] },
  cfg: { fetch: typeof fetch; url: string; secreto: string },
): Promise<Coincidencia[] | { error: string }> {
  try {
    const res = await cfg.fetch(`${cfg.url}/api/internal/usuarios/existentes`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.secreto}` },
      body: JSON.stringify(lote),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Una redirección perdería el secreto: mejor que falle a la vista que un 401 silencioso.
      redirect: "error",
    });
    if (!res.ok) return { error: `CLF respondió ${res.status}` };
    const cuerpo = comoObjeto(await res.json());
    if (!Array.isArray(cuerpo.coincidencias)) return { error: "CLF respondió algo inesperado" };
    return cuerpo.coincidencias.filter(esCoincidencia);
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "";
    if (nombre === "TimeoutError" || nombre === "AbortError") return { error: "CLF no respondió a tiempo" };
    return { error: "No se pudo consultar CLF (¿la dirección redirige? revisá CLF_BASE_URL)" };
  }
}

/** Parte las claves en lotes de hasta 200 (correos + teléfonos). */
function enLotes(emails: string[], telefonos: string[]): Array<{ emails: string[]; telefonos: string[] }> {
  const todas = [...emails.map((v) => ({ v, e: true })), ...telefonos.map((v) => ({ v, e: false }))];
  const lotes: Array<{ emails: string[]; telefonos: string[] }> = [];
  for (let i = 0; i < todas.length; i += MAX_CLAVES_POR_LOTE) {
    const parte = todas.slice(i, i + MAX_CLAVES_POR_LOTE);
    lotes.push({ emails: parte.filter((x) => x.e).map((x) => x.v), telefonos: parte.filter((x) => !x.e).map((x) => x.v) });
  }
  return lotes;
}

export async function vincularClf(contactoIds: string[], deps: DepsClf = {}): Promise<ResultadoClf> {
  const resultado: ResultadoClf = { vinculados: 0, compradores: 0 };
  const ids = [...new Set(contactoIds)];
  if (ids.length === 0) return resultado;

  const secreto = (deps.secreto ?? process.env.CLF_CONSULTA_USUARIOS_SECRET ?? "").trim();
  if (!secreto) return { ...resultado, error: "Falta CLF_CONSULTA_USUARIOS_SECRET" };
  const url = (deps.url ?? process.env.CLF_BASE_URL ?? URL_POR_OMISION).replace(/\/+$/, "");
  const cfg = { fetch: deps.fetch ?? fetch, url, secreto };

  try {
    const contactos = (
      await prisma.dnxContacto.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true, telefono: true, whatsapp: true, vinculo: true, compradorClf: true, fusionadoEnId: true },
      })
    ).filter((c) => !c.fusionadoEnId);
    if (contactos.length === 0) return resultado;
    const datos = await prisma.dnxContactoDato.findMany({
      where: { contactoId: { in: contactos.map((c) => c.id) }, campo: { in: ["email", "telefono", "whatsapp"] } },
      select: { contactoId: true, campo: true, valor: true },
    });

    // clave → contactos que la tienen.
    const porEmail = new Map<string, Set<string>>();
    const porTelefono = new Map<string, Set<string>>();
    const anotar = (m: Map<string, Set<string>>, clave: string | null, id: string) => {
      if (!clave) return;
      if (!m.has(clave)) m.set(clave, new Set());
      m.get(clave)!.add(id);
    };
    for (const c of contactos) {
      anotar(porEmail, claveEmail(c.email), c.id);
      anotar(porTelefono, claveTelefono(c.telefono), c.id);
      anotar(porTelefono, claveTelefono(c.whatsapp), c.id);
    }
    for (const d of datos) {
      if (d.campo === "email") anotar(porEmail, claveEmail(d.valor), d.contactoId);
      else anotar(porTelefono, claveTelefono(d.valor), d.contactoId);
    }
    if (porEmail.size === 0 && porTelefono.size === 0) return resultado;

    const coincidencias: Coincidencia[] = [];
    for (const lote of enLotes([...porEmail.keys()], [...porTelefono.keys()])) {
      const r = await consultar(lote, cfg);
      if ("error" in r) {
        resultado.error = r.error;
        break;
      }
      coincidencias.push(...r);
    }

    // Por contacto: el primer usuario de plataforma y si es comprador.
    const plataforma = new Map<string, Coincidencia>();
    const comprador = new Map<string, Coincidencia>();
    for (const m of coincidencias) {
      const deContactos = new Set([...(porEmail.get(m.clave) ?? []), ...(porTelefono.get(m.clave) ?? [])]);
      for (const id of deContactos) {
        if ((ROLES_PLATAFORMA as readonly string[]).includes(m.rol)) {
          if (!plataforma.has(id)) plataforma.set(id, m);
        } else if (m.rol === "CUSTOMER") {
          if (!comprador.has(id)) comprador.set(id, m);
        }
      }
    }
    if (plataforma.size === 0 && comprador.size === 0) return resultado;

    // Eventos previos, para no repetir el mismo vínculo en cada corrida.
    const previos = await prisma.dnxContactoEvento.findMany({
      where: { contactoId: { in: [...new Set([...plataforma.keys(), ...comprador.keys()])] }, tipo: "VINCULADO" },
      select: { contactoId: true, datos: true },
    });
    const yaAnotado = (id: string, userId: number) =>
      previos.some((e) => {
        const d = comoObjeto(e.datos);
        return e.contactoId === id && d.vinculo === "USUARIO_CLF" && d.userId === userId;
      });

    for (const c of contactos) {
      const p = plataforma.get(c.id);
      if (p && c.vinculo !== "USUARIO_CLF" && !yaAnotado(c.id, p.userId)) {
        const evento = { contactoId: c.id, tipo: "VINCULADO", datos: { vinculo: "USUARIO_CLF", userId: p.userId, rol: p.rol }, autor: "SISTEMA" };
        if (c.vinculo) {
          // Ya tiene otro vínculo (p. ej. CONOCIDO_DNX_ESTUDIO): no se pisa, sólo queda el evento.
          await prisma.dnxContactoEvento.create({ data: evento });
        } else {
          await prisma.$transaction(async (tx) => {
            await tx.dnxContacto.update({ where: { id: c.id }, data: { vinculo: "USUARIO_CLF", vinculoId: String(p.userId) } });
            await tx.dnxContactoEvento.create({ data: evento });
          });
        }
        resultado.vinculados++;
      }
      const k = comprador.get(c.id);
      if (k && !c.compradorClf) {
        await prisma.$transaction(async (tx) => {
          await tx.dnxContacto.update({ where: { id: c.id }, data: { compradorClf: true } });
          await tx.dnxContactoEvento.create({
            data: { contactoId: c.id, tipo: "VINCULADO", datos: { comprador: true, userId: k.userId }, autor: "SISTEMA" },
          });
        });
        resultado.compradores++;
      }
    }
    return resultado;
  } catch (e) {
    console.error("[buscador] falló el vínculo con CLF", e instanceof Error ? e.name : "");
    return { ...resultado, error: "No se pudo guardar el vínculo con CLF" };
  }
}
