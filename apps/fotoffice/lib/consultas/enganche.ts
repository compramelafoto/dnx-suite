import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { categoriaParaEventType } from "./categorias";
import { LOTE_ENGANCHE } from "./constantes";
import { contactoParaConsulta, MAX_NOMBRE_CONTACTO } from "./contacto";
import { asegurarCatalogosDelWorkspace } from "./semillas";

/**
 * Enganche de las consultas existentes (spec §4.1): cada `ServiceSalesLead` sin
 * `FotofficeConsulta` recibe su contacto, la categoría equivalente a su `eventType` y una copia
 * de la fecha y el lugar del evento.
 *
 * Las consultas viejas llegaron por el formulario público, así que el contacto se busca SÓLO por
 * correo (regla R3); si no aparece, se crea uno nuevo con su teléfono.
 *
 * Por lotes de `LOTE_ENGANCHE` por llamada. Cada consulta va en su propia transacción, con un
 * bloqueo por consulta y un re-chequeo adentro: dos corridas a la vez no la duplican (el único de
 * `leadId` también lo frena) y una falla no deja nada a medias (se reintenta la próxima vez).
 * Idempotente: una consulta enganchada no se vuelve a leer.
 *
 * Se llama al abrir Consultas, junto a los enganches de 0.4 (recorridos) y 0.5 (números).
 */

const ACTOR_SISTEMA = { userId: null, label: "Sistema" };

type ConsultaSinFicha = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  eventType: string;
  eventDate: Date | null;
  eventLocation: string | null;
};

function registrarFalla(donde: string, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[consultas] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

/*
 * SQL crudo: Prisma no expresa "sin FotofficeConsulta" con la base en memoria de las pruebas, que
 * reconoce estas consultas por el comentario `consultas-sin-ficha`. Los valores van como
 * parámetros. Usa el único de FotofficeConsulta.leadId.
 */
async function consultasSinFicha(workspaceId: string, limite: number): Promise<ConsultaSinFicha[]> {
  return prisma.$queryRaw<ConsultaSinFicha[]>`
    /* consultas-sin-ficha: lista */
    SELECT l."id", l."name", l."email", l."phone", l."eventType", l."eventDate", l."eventLocation"
    FROM "ServiceSalesLead" l
    WHERE l."workspaceId" = ${workspaceId}
      AND NOT EXISTS (SELECT 1 FROM "FotofficeConsulta" c WHERE c."leadId" = l."id")
    ORDER BY l."createdAt" ASC, l."id" ASC
    LIMIT ${limite}`;
}

/** Cuántas consultas del workspace siguen sin `FotofficeConsulta`. */
export async function contarSinFicha(workspaceId: string): Promise<number> {
  const [fila] = await prisma.$queryRaw<{ n: bigint | number }[]>`
    /* consultas-sin-ficha: cuenta */
    SELECT count(*) AS "n"
    FROM "ServiceSalesLead" l
    WHERE l."workspaceId" = ${workspaceId}
      AND NOT EXISTS (SELECT 1 FROM "FotofficeConsulta" c WHERE c."leadId" = l."id")`;
  return Number(fila?.n ?? 0);
}

/** Nombre para el contacto: el de la consulta, o su correo o teléfono si vino vacío. */
function nombreParaContacto(l: ConsultaSinFicha): string {
  const n = (l.name ?? "").trim().replace(/\s+/g, " ") || l.email?.trim() || l.phone?.trim() || "Sin nombre";
  return n.slice(0, MAX_NOMBRE_CONTACTO);
}

/** Engancha una consulta. false si otra corrida ya lo hizo. */
async function engancharUna(workspaceId: string, lead: ConsultaSinFicha): Promise<boolean> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-consulta-ficha:${lead.id}`}))`;
    if ((await tx.fotofficeConsulta.count({ where: { leadId: lead.id } })) > 0) return false;
    // La consulta vieja ya era de ese tipo: vale aunque su categoría equivalente esté archivada.
    const categoria = await categoriaParaEventType(tx, workspaceId, lead.eventType, { incluirArchivadas: true });
    if (!categoria) throw Object.assign(new Error("sin categoría"), { code: "SIN_CATEGORIA" });
    const contacto = await contactoParaConsulta(
      tx,
      workspaceId,
      { nombre: nombreParaContacto(lead), email: lead.email, telefono: lead.phone },
      ACTOR_SISTEMA,
      { coincidir: "correo" },
    );
    const fecha = lead.eventDate ? new Date(lead.eventDate) : null;
    await tx.fotofficeConsulta.create({
      data: {
        workspaceId,
        leadId: lead.id,
        clientId: contacto.clientId,
        categoryId: categoria.id,
        eventStartsAt: fecha,
        eventTimeKnown: false,
        venue: lead.eventLocation?.trim().slice(0, 200) || null,
      },
      select: { id: true },
    });
    return true;
  }, OPCIONES_TRANSACCION);
}

/**
 * Engancha hasta `tope` consultas sin `FotofficeConsulta`, de la más vieja a la más nueva.
 * Antes siembra los catálogos si faltan. `completo`: no quedó ninguna sin enganchar.
 */
export async function engancharConsultasExistentes(
  workspaceId: string,
  tope: number = LOTE_ENGANCHE,
): Promise<{ enganchadas: number; completo: boolean }> {
  await asegurarCatalogosDelWorkspace(workspaceId);
  const lote = await consultasSinFicha(workspaceId, tope + 1);
  if (lote.length === 0) return { enganchadas: 0, completo: true };
  let enganchadas = 0;
  let fallidas = 0;
  for (const lead of lote.slice(0, tope)) {
    try {
      if (await engancharUna(workspaceId, lead)) enganchadas++;
    } catch (error) {
      fallidas++;
      registrarFalla("engancharConsultasExistentes", error);
    }
  }
  return { enganchadas, completo: lote.length <= tope && fallidas === 0 };
}
