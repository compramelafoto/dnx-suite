import "server-only";
import { prisma } from "@repo/db";
import { crearClienteConNumero } from "@/lib/clients/alta";
import { crearPedidoManual } from "@/lib/pedidos/pedidos";
import type { CtxPedidos } from "@/lib/pedidos/acceso";
import { MENSAJES_PROYECTO, puedeGestionarProyectos, type CtxProyectos } from "./acceso";
import { moverAFase } from "./avance";
import {
  MARCA_IMPORTACION,
  mismoTelefono,
  restaDeFila,
  TIPOS_IMPORTACION,
  type FilaImportacion,
  type TipoImportacion,
} from "./importar-trabajos";

/**
 * Importa los trabajos abiertos de una planilla: por cada fila busca al cliente (por teléfono, o
 * por nombre si no hay teléfono) o lo da de alta, arma el pedido por lo que RESTA (la seña ya se
 * cobró antes de FOTOFFICE y no entra a Caja), le pone proveedor y entrega a sus trabajos y los
 * deja en la etapa de la planilla. No manda correos. Una fila ya importada (misma huella) se salta.
 */

export type ResultadoFila = { renglon: number; cliente: string; estado: "IMPORTADO" | "YA_ESTABA" | "ERROR"; detalle: string };

const MAX_FILAS = 200;

function pesos(n: number): string {
  return `$ ${new Intl.NumberFormat("es-AR").format(n)}`;
}

export async function importarTrabajos(ctx: CtxProyectos & CtxPedidos, filas: FilaImportacion[]): Promise<{ ok: true; resultados: ResultadoFila[] } | { ok: false; error: string }> {
  if (!puedeGestionarProyectos(ctx) || ctx.userId === null) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!Array.isArray(filas) || filas.length === 0) return { ok: false, error: "No hay filas para importar." };
  if (filas.length > MAX_FILAS) return { ok: false, error: `Son muchas filas: hasta ${MAX_FILAS} por vez.` };
  const { workspaceId } = ctx;

  const [productos, proveedores, clientes, user] = await Promise.all([
    prisma.product.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, name: true, fotofficeProyectoReglas: { select: { circuit: { select: { name: true } } } } },
    }),
    prisma.fotofficeProveedor.findMany({ where: { workspaceId, active: true }, select: { id: true, name: true } }),
    prisma.client.findMany({ where: { workspaceId }, select: { id: true, firstName: true, lastName: true, businessName: true, phone: true } }),
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true } }),
  ]);
  const actor = { userId: ctx.userId, label: user?.name ?? user?.email ?? "Importación" };

  const productoDe = (tipo: TipoImportacion): string | null => {
    const t = TIPOS_IMPORTACION[tipo];
    if (t.producto) return productos.find((p) => p.name === t.producto)?.id ?? null;
    return (
      productos
        .filter((p) => p.fotofficeProyectoReglas.some((r) => r.circuit?.name === t.circuito))
        .sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? null
    );
  };
  const proveedorDe = (tipo: TipoImportacion) => {
    const nombre = TIPOS_IMPORTACION[tipo].proveedor;
    return nombre ? (proveedores.find((p) => p.name.toLowerCase() === nombre.toLowerCase())?.id ?? null) : null;
  };

  const resultados: ResultadoFila[] = [];
  for (const f of filas) {
    const r = (estado: ResultadoFila["estado"], detalle: string) => resultados.push({ renglon: f.renglon, cliente: f.cliente, estado, detalle });
    try {
      const marca = MARCA_IMPORTACION(f.clave);
      const ya = await prisma.fotofficeProyectoNota.count({ where: { workspaceId, body: { contains: marca } } });
      if (ya > 0) {
        r("YA_ESTABA", "Ya se había importado.");
        continue;
      }
      const productId = productoDe(f.tipo);
      if (!productId) {
        r("ERROR", `No hay un producto con flujo de trabajo para ${f.tipo}.`);
        continue;
      }

      // Cliente: por teléfono; sin teléfono, por nombre exacto; si no, se da de alta.
      const nombre = (c: (typeof clientes)[number]) => [c.firstName, c.lastName].filter(Boolean).join(" ") || c.businessName || "";
      let cliente =
        (f.telefono ? clientes.find((c) => mismoTelefono(c.phone, f.telefono)) : null) ??
        (!f.telefono ? clientes.find((c) => nombre(c).toLowerCase() === f.cliente.toLowerCase()) : null) ??
        null;
      let clienteNuevo = false;
      if (!cliente) {
        const [primero, ...resto] = f.cliente.split(" ");
        const id = await crearClienteConNumero(
          workspaceId,
          { kind: "PERSONA", firstName: primero ?? f.cliente, lastName: resto.join(" ") || null, phone: f.telefono },
          actor,
        );
        if (!id) {
          r("ERROR", "No se pudo dar de alta al cliente.");
          continue;
        }
        cliente = { id, firstName: primero ?? f.cliente, lastName: resto.join(" ") || null, businessName: null, phone: f.telefono };
        clientes.push(cliente);
        clienteNuevo = true;
      }

      const resta = restaDeFila(f);
      const alta = await crearPedidoManual(ctx, {
        clientId: cliente.id,
        items: [
          {
            id: "i1",
            productId,
            nombre: (f.detalle || TIPOS_IMPORTACION[f.tipo].producto || f.tipo).slice(0, 200),
            descripcion: f.sena > 0 ? `Seña de ${pesos(f.sena)} cobrada antes de FOTOFFICE. Total del trabajo: ${pesos(f.total)}.` : null,
            cantidad: 1,
            precioUnitario: resta,
            descuento: null,
            modoPrecio: "LISTA",
            calculo: null,
            seccion: null,
            opcional: false,
          },
        ],
        descuento: null,
        opcion: { tipo: "CONTADO" },
        fechaEvento: f.entrega,
        eventLabel: "Entrega",
        checklist: null,
      });
      if (!alta.ok) {
        r("ERROR", alta.error);
        continue;
      }

      const proyectos = await prisma.fotofficeProyecto.findMany({ where: { workspaceId, pedidoId: alta.pedidoId }, select: { id: true } });
      const proveedorId = proveedorDe(f.tipo);
      await prisma.fotofficeProyecto.updateMany({
        where: { workspaceId, pedidoId: alta.pedidoId },
        data: {
          ...(f.entrega ? { entregaPrometida: new Date(`${f.entrega}T12:00:00Z`) } : {}),
          ...(proveedorId ? { proveedorId, ...(f.fase === "EN_PROVEEDOR" || f.fase === "LISTO" ? { proveedorEnviadoAt: new Date() } : {}) } : {}),
        },
      });
      let etapa: string | null = null;
      for (const p of proyectos) {
        await prisma.fotofficeProyectoNota.create({
          data: {
            workspaceId,
            proyectoId: p.id,
            authorUserId: ctx.userId,
            body: `Importado de la planilla ${marca}${f.sena > 0 ? `\nSeña cobrada antes: ${pesos(f.sena)} de ${pesos(f.total)}.` : ""}`,
          },
        });
        if (f.fase !== "RECIBIDO") {
          const m = await moverAFase(ctx, p.id, f.fase, "Importado de la planilla.");
          if (m.ok && m.etapa) etapa = m.etapa;
        }
      }
      r(
        "IMPORTADO",
        [`Pedido ${alta.numero}`, resta > 0 ? `debe ${pesos(resta)}` : "pagado", etapa ? `en «${etapa}»` : null, clienteNuevo ? "cliente nuevo" : null]
          .filter(Boolean)
          .join(" · "),
      );
    } catch (e) {
      console.error("[proyectos][importar] fila falló", { renglon: f.renglon, error: e instanceof Error ? e.message : "desconocido" });
      r("ERROR", "No se pudo importar esta fila.");
    }
  }
  return { ok: true, resultados };
}
