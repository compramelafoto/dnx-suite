/**
 * Consultas internas del agente Vendedor de FOTOFFICE a CLF (`POST /api/internal/vendedor`).
 *
 * FOTOFFICE no lee la base de CLF: pregunta por acá, con el mismo secreto que la consulta de
 * usuarios existentes (`CLF_CONSULTA_USUARIOS_SECRET`). Cuatro consultas:
 * - `atribuciones`: qué registros llegaron con la cookie `clf_dnxv` de cada token de hilo;
 * - `ventas`: cuántos pedidos pagados (y cuántos pesos) tuvo cada usuario en un período;
 * - `campana-escolar`: los correos de los colegios de la campaña escolar de octubre;
 * - `conocimiento`: el conocimiento del DNX Bot (`CONOCIMIENTO_CLF`), lo único que el Vendedor
 *   puede afirmar.
 *
 * Los accesos a la base se inyectan para probar la lógica sin base; la ruta conecta Prisma.
 */
import { createHash } from "node:crypto";
import { CONOCIMIENTO_CLF } from "../bot/guia/conocimiento";
import { mismoSecreto } from "../usuarios-existentes";

/** Tope de tokens o usuarios por pedido. */
export const MAX_ITEMS_CONSULTA = 500;

/** La campaña escolar de octubre (`SchoolOutreachProspect.campaignKey`). */
export const CAMPANA_ESCOLAR = "dnx-escolar-2026-10";

// ---------------------------------------------------------------------------------------------
// Atribuciones

export type AtribucionFila = { token: string; userId: number; rol: string; creadoEn: Date };
export type BuscarAtribuciones = (tokens: string[]) => Promise<AtribucionFila[]>;
export type Atribucion = { token: string; userId: number; rol: string; creadoEn: string };

export async function atribucionesPorToken(tokens: string[], buscar: BuscarAtribuciones): Promise<Atribucion[]> {
  const unicos = [...new Set(tokens.map((t) => t.trim()).filter((t) => t !== ""))];
  if (unicos.length === 0) return [];
  const filas = await buscar(unicos);
  return filas.map((f) => ({ token: f.token, userId: f.userId, rol: String(f.rol), creadoEn: f.creadoEn.toISOString() }));
}

// ---------------------------------------------------------------------------------------------
// Ventas

/**
 * Un pedido candidato. `userIds` son los usuarios ligados al pedido: dueño del álbum, creador del
 * evento del álbum y organizadores activos de la escuela del álbum (puede repetir).
 */
export type PedidoCandidato = {
  id: number;
  userIds: number[];
  status: string;
  createdAt: Date;
  totalCents: number;
  currency: string;
  checkoutPaymentSource: string;
  isTest: boolean;
};
export type BuscarPedidos = (f: { desde: Date; hasta: Date; userIds: number[] }) => Promise<PedidoCandidato[]>;
export type VentasUsuario = { userId: number; ventas: number; totalPesos: number };

/**
 * Ventas de cada usuario pedido en `[desde, hasta)`. Cuenta sólo pedidos `PAID`, que no sean de
 * prueba, cobrados por Mercado Pago (el canje de un pack prepago no es dinero nuevo: contaría dos
 * veces) y hechos desde el registro de ese usuario.
 *
 * `Order` no tiene fecha de pago, así que el mes de un pedido es su `createdAt`.
 *
 * `totalCents` de CLF ya son pesos enteros (no centavos); se suman sólo los pedidos en ARS.
 * Devuelve una fila por usuario pedido, también con 0, en el orden en que llegaron.
 */
export async function ventasDelPeriodo(
  input: { desde: string; hasta: string; usuarios: Array<{ userId: number; registradoEn: string }> },
  buscar: BuscarPedidos,
): Promise<VentasUsuario[]> {
  const desde = new Date(input.desde);
  const hasta = new Date(input.hasta);
  const registro = new Map<number, number>();
  for (const u of input.usuarios) {
    const t = new Date(u.registradoEn).getTime();
    // Si un usuario llega dos veces, vale el registro más temprano.
    const previo = registro.get(u.userId);
    registro.set(u.userId, previo === undefined ? t : Math.min(previo, t));
  }
  const userIds = [...registro.keys()];
  if (userIds.length === 0) return [];

  const acumulado = new Map<number, VentasUsuario>(userIds.map((id) => [id, { userId: id, ventas: 0, totalPesos: 0 }]));
  const pedidos = await buscar({ desde, hasta, userIds });
  for (const p of pedidos) {
    if (p.status !== "PAID" || p.isTest || p.checkoutPaymentSource !== "MERCADO_PAGO") continue;
    const t = p.createdAt.getTime();
    if (t < desde.getTime() || t >= hasta.getTime()) continue;
    for (const id of new Set(p.userIds)) {
      const fila = acumulado.get(id);
      const registradoEn = registro.get(id);
      if (!fila || registradoEn === undefined || t < registradoEn) continue;
      fila.ventas++;
      if (p.currency === "ARS") fila.totalPesos += p.totalCents;
    }
  }
  return [...acumulado.values()];
}

// ---------------------------------------------------------------------------------------------
// Campaña escolar y conocimiento

export type BuscarEmailsCampana = () => Promise<string[]>;

export async function emailsCampanaEscolar(buscar: BuscarEmailsCampana): Promise<string[]> {
  const emails = (await buscar()).map((e) => e.trim().toLowerCase()).filter((e) => e !== "");
  return [...new Set(emails)];
}

/** El conocimiento del DNX Bot, sin la identidad ni las reglas del bot del panel (no son del Vendedor). */
export function conocimientoVendedor(): { texto: string; version: string } {
  return { texto: CONOCIMIENTO_CLF, version: createHash("sha256").update(CONOCIMIENTO_CLF).digest("hex").slice(0, 16) };
}

// ---------------------------------------------------------------------------------------------
// Handler de la ruta

export type DepsConsultaVendedor = {
  secreto: string | undefined;
  buscarAtribuciones: BuscarAtribuciones;
  buscarPedidos: BuscarPedidos;
  buscarEmailsCampana: BuscarEmailsCampana;
};

function json(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

function fechaValida(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return Number.isNaN(new Date(v).getTime()) ? null : v;
}

/**
 * `POST /api/internal/vendedor`, con `Authorization: Bearer <secreto>` y
 * `{ consulta: "atribuciones" | "ventas" | "campana-escolar" | "conocimiento", ... }`.
 * Sin secreto configurado → 503; secreto incorrecto → 401; consulta desconocida, cuerpo inválido
 * o más de 500 tokens o usuarios → 400.
 */
export async function manejarConsultaVendedor(req: Request, deps: DepsConsultaVendedor): Promise<Response> {
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
  const b = body as Record<string, unknown>;

  try {
    switch (b.consulta) {
      case "atribuciones": {
        const tokens = b.tokens;
        if (!Array.isArray(tokens) || tokens.some((t) => typeof t !== "string")) return json({ error: "tokens debe ser una lista de textos" }, 400);
        if (tokens.length > MAX_ITEMS_CONSULTA) return json({ error: `Más de ${MAX_ITEMS_CONSULTA} tokens` }, 400);
        return json({ atribuciones: await atribucionesPorToken(tokens as string[], deps.buscarAtribuciones) }, 200);
      }
      case "ventas": {
        const desde = fechaValida(b.desde);
        const hasta = fechaValida(b.hasta);
        if (!desde || !hasta) return json({ error: "desde y hasta deben ser fechas" }, 400);
        const usuarios = b.usuarios;
        if (!Array.isArray(usuarios)) return json({ error: "usuarios debe ser una lista" }, 400);
        if (usuarios.length > MAX_ITEMS_CONSULTA) return json({ error: `Más de ${MAX_ITEMS_CONSULTA} usuarios` }, 400);
        const validos: Array<{ userId: number; registradoEn: string }> = [];
        for (const u of usuarios) {
          const o = u && typeof u === "object" ? (u as Record<string, unknown>) : {};
          const registradoEn = fechaValida(o.registradoEn);
          if (typeof o.userId !== "number" || !Number.isInteger(o.userId) || !registradoEn) {
            return json({ error: "Cada usuario necesita userId y registradoEn" }, 400);
          }
          validos.push({ userId: o.userId, registradoEn });
        }
        return json({ ventas: await ventasDelPeriodo({ desde, hasta, usuarios: validos }, deps.buscarPedidos) }, 200);
      }
      case "campana-escolar":
        return json({ emails: await emailsCampanaEscolar(deps.buscarEmailsCampana) }, 200);
      case "conocimiento":
        return json(conocimientoVendedor(), 200);
      default:
        return json({ error: "Consulta desconocida" }, 400);
    }
  } catch (e) {
    console.error("[vendedor] falló la consulta", e instanceof Error ? e.name : "");
    return json({ error: "Error interno" }, 500);
  }
}
