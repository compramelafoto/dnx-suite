/**
 * Consulta interna para FOTOFFICE: ¿cuáles de estos correos o teléfonos ya son usuarios de CLF?
 *
 * Responde sólo coincidencias `{ clave, userId, rol, creadoEn, baja }`: nunca nombres, correos ni
 * teléfonos de la base. `creadoEn` es el alta del usuario (ISO) y `baja` dice si se dio de baja de
 * los correos de CLF (`unsubscribedAt`); los usa el agente Vendedor y el Buscador los ignora. La `clave` es el valor que FOTOFFICE mandó, normalizado (correo en minúsculas; teléfono
 * como `+54` + área + número), para que lo pueda asociar a su contacto.
 *
 * El acceso a la base se inyecta (`BuscarUsuarios`) para poder probar la lógica sin base; la ruta
 * `app/api/internal/usuarios/existentes` conecta el Prisma real.
 *
 * El modelo `User` no tiene marca de borrado ni de prueba (no hay `deletedAt`, `isTest` ni
 * `isDemo`), así que no se filtra nada por eso. Los bloqueados (`isBlocked`) se devuelven igual:
 * siguen siendo usuarios conocidos.
 */
import { timingSafeEqual } from "node:crypto";

/** Tope de claves (correos + teléfonos) por pedido. */
export const MAX_CLAVES = 200;

/** Lo mínimo que la búsqueda trae de cada usuario candidato (nada de esto sale en la respuesta salvo id y rol). */
export type UsuarioCandidato = {
  id: number;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  role: string;
  createdAt: Date;
  unsubscribedAt: Date | null;
};

/**
 * Filtro grueso en la base: correos exactos (sin importar mayúsculas) o teléfonos que contengan
 * alguna de las `colas` (últimos dígitos). La comparación fina se hace acá en código.
 */
export type BuscarUsuarios = (filtro: { emails: string[]; colas: string[] }) => Promise<UsuarioCandidato[]>;

export type Coincidencia = { clave: string; userId: number; rol: string; creadoEn: string; baja: boolean };

// ---------------------------------------------------------------------------------------------
// Normalización (copia de FOTOFFICE: no hay paquete compartido)

/**
 * Espejo de `telefonoAr(v, false)` de `apps/fotoffice/lib/alboom/carga/normalizar.ts`: sólo
 * dígitos, sin el 0 de larga distancia ni el 15 de los móviles, sin el 54 y el 9 de WhatsApp.
 * Devuelve el número nacional de 10 dígitos o `null`. Si cambia allá, hay que cambiarlo acá.
 */
function nacionalAr(v: string): string | null {
  let d = v.replace(/\D/g, "");
  if (d === "") return null;
  if (d.startsWith("00")) d = d.slice(2);
  let n = d;
  if (n.startsWith("54") && n.length >= 12) {
    n = n.slice(2);
    if (n.startsWith("9") && n.length === 11) n = n.slice(1);
  }
  if (n.startsWith("0")) n = n.slice(1);
  if (n.length === 12) {
    // Área de 2 a 4 dígitos seguida del 15 de los móviles: "341 15 1234567".
    for (const area of [2, 3, 4]) {
      if (n.slice(area, area + 2) === "15") {
        n = n.slice(0, area) + n.slice(area + 2);
        break;
      }
    }
  }
  return n.length === 10 ? n : null;
}

/**
 * Espejo de `claveTelefono` de `apps/fotoffice/lib/agentes/buscador/normalizar.ts`: teléfono
 * argentino como `+54` + área + número (sin 9 ni 15); `null` si no es legible.
 */
export function claveTelefono(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const n = nacionalAr(tel);
  return n ? `+54${n}` : null;
}

/** Correo en minúsculas y sin espacios; `null` si no parece un correo. */
export function claveEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/**
 * Últimos 4 dígitos del número: alcanzan para filtrar en la base aunque el teléfono esté escrito
 * con espacios o guiones ("341 15-555-1234" termina en "1234"); la comparación exacta es en código.
 */
function cola(clave: string): string {
  return clave.slice(-4);
}

// ---------------------------------------------------------------------------------------------
// Lógica

export async function usuariosExistentes(
  input: { emails: string[]; telefonos: string[] },
  buscar: BuscarUsuarios,
): Promise<Coincidencia[]> {
  const emails = [...new Set(input.emails.map(claveEmail).filter((x): x is string => !!x))];
  const telefonos = [...new Set(input.telefonos.map(claveTelefono).filter((x): x is string => !!x))];
  if (emails.length === 0 && telefonos.length === 0) return [];

  const candidatos = await buscar({ emails, colas: [...new Set(telefonos.map(cola))] });
  const emailsPedidos = new Set(emails);
  const telefonosPedidos = new Set(telefonos);

  const vistas = new Set<string>();
  const out: Coincidencia[] = [];
  const anotar = (clave: string, u: UsuarioCandidato) => {
    const k = `${clave}|${u.id}`;
    if (vistas.has(k)) return;
    vistas.add(k);
    // Sólo clave, id, rol, alta y baja: nunca nombre, correo ni teléfono de la base.
    out.push({ clave, userId: u.id, rol: String(u.role), creadoEn: u.createdAt.toISOString(), baja: u.unsubscribedAt != null });
  };
  for (const u of candidatos) {
    const e = claveEmail(u.email);
    if (e && emailsPedidos.has(e)) anotar(e, u);
    for (const tel of [u.phone, u.whatsapp]) {
      const t = claveTelefono(tel);
      if (t && telefonosPedidos.has(t)) anotar(t, u);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Handler de la ruta

function json(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

/** Compara en tiempo constante; largos distintos ya son distintos (sin comparar contenido). */
export function mismoSecreto(recibido: string, esperado: string): boolean {
  const a = Buffer.from(recibido, "utf8");
  const b = Buffer.from(esperado, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function listaDeTextos(v: unknown): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return null;
  return v as string[];
}

/**
 * `POST /api/internal/usuarios/existentes`. Header `Authorization: Bearer <secreto>`.
 * Sin secreto configurado → 503; secreto incorrecto → 401; JSON inválido o más de 200 claves → 400.
 */
export async function consultarUsuariosExistentes(
  req: Request,
  deps: { secreto: string | undefined; buscar: BuscarUsuarios },
): Promise<Response> {
  const secreto = deps.secreto?.trim();
  if (!secreto) return json({ error: "Consulta no configurada" }, 503);

  const auth = req.headers.get("authorization") ?? "";
  const recibido = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!recibido || !mismoSecreto(recibido, secreto)) return json({ error: "No autorizado" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Cuerpo inválido" }, 400);
  const emails = listaDeTextos((body as Record<string, unknown>).emails);
  const telefonos = listaDeTextos((body as Record<string, unknown>).telefonos);
  if (!emails || !telefonos) return json({ error: "emails y telefonos deben ser listas de textos" }, 400);
  if (emails.length + telefonos.length > MAX_CLAVES) return json({ error: `Más de ${MAX_CLAVES} claves` }, 400);

  try {
    const coincidencias = await usuariosExistentes({ emails, telefonos }, deps.buscar);
    return json({ coincidencias }, 200);
  } catch (e) {
    console.error("[usuarios/existentes] falló la consulta", e instanceof Error ? e.name : "");
    return json({ error: "Error interno" }, 500);
  }
}
