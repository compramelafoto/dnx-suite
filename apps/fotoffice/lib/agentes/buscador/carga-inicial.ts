/**
 * Carga inicial de Contactos DNX: los clientes de DNX Estudio con la etiqueta «Fotógrafo» entran
 * a la base de prospectos como conocidos (vínculo `CONOCIDO_DNX_ESTUDIO`), ya revisados.
 * Sólo lee `Client`: los prospectos nunca se escriben ahí. Se puede correr las veces que haga falta.
 */
import "server-only";
import { prisma } from "@repo/db";
import { cambiarEstado, guardarCandidato, WORKSPACE_DNX_ESTUDIO, type Candidato, type CampoDato, type DatoConFuente } from "./contactos";

const AUTOR = "CARGA_INICIAL";

function texto(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export async function importarConocidos(): Promise<{ importados: number; yaEstaban: number }> {
  const etiquetas = await prisma.fotofficeTag.findMany({
    where: { workspaceId: WORKSPACE_DNX_ESTUDIO, nameKey: "fotografo" },
    select: { id: true },
  });
  if (etiquetas.length === 0) return { importados: 0, yaEstaban: 0 };

  const asignaciones = await prisma.fotofficeTagAssignment.findMany({
    where: { tagId: { in: etiquetas.map((e) => e.id) } },
    select: { clientId: true },
  });
  const ids = [...new Set(asignaciones.map((a) => a.clientId).filter((x): x is string => !!x))];
  if (ids.length === 0) return { importados: 0, yaEstaban: 0 };

  const clientes = await prisma.client.findMany({
    where: { workspaceId: WORKSPACE_DNX_ESTUDIO, id: { in: ids } },
    select: { id: true, kind: true, firstName: true, lastName: true, businessName: true, email: true, phone: true, city: true },
  });
  const perfiles = await prisma.fotofficeContactoPerfil.findMany({
    where: { workspaceId: WORKSPACE_DNX_ESTUDIO, clientId: { in: ids } },
    select: { clientId: true, mobile: true, email2: true, website: true, province: true },
  });

  let importados = 0;
  let yaEstaban = 0;
  for (const cl of clientes) {
    // Ya importado antes (o ya vinculado a mano): no se toca nada.
    const previo = await prisma.dnxContacto.findFirst({
      where: { vinculo: "CONOCIDO_DNX_ESTUDIO", vinculoId: cl.id },
      select: { id: true },
    });
    if (previo) { yaEstaban++; continue; }

    const p = perfiles.find((x) => x.clientId === cl.id);
    const persona = [texto(cl.firstName), texto(cl.lastName)].filter(Boolean).join(" ");
    const nombre = texto(cl.businessName) ?? (persona || texto(cl.email) || "Sin nombre");

    const dato = (valor: string | null): DatoConFuente | null => (valor ? { valor, fuente: "ALBOOM", fuenteUrl: null } : null);
    const datos: Partial<Record<CampoDato, DatoConFuente>> = {};
    const poner = (campo: CampoDato, valor: string | null) => { const d = dato(valor); if (d) datos[campo] = d; };
    poner("web", texto(p?.website));
    poner("email", texto(cl.email) ?? texto(p?.email2));
    poner("telefono", texto(cl.phone) ?? texto(p?.mobile));

    const candidato: Candidato = {
      tipo: "FOTOGRAFO", nichos: [], nombre,
      ciudad: texto(cl.city), provincia: texto(p?.province), region: null,
      datos, creadoPor: "CARGA_INICIAL",
    };
    const r = await guardarCandidato(candidato);

    // El cliente ES la fuente: el vínculo se fija aunque el correo o teléfono no coincidan.
    const c = await prisma.dnxContacto.findUnique({ where: { id: r.contactoId }, select: { vinculo: true, vinculoId: true } });
    if (!c?.vinculo || (c.vinculo === "CONOCIDO_DNX_ESTUDIO" && !c.vinculoId)) {
      await prisma.$transaction(async (tx) => {
        await tx.dnxContacto.update({ where: { id: r.contactoId }, data: { vinculo: "CONOCIDO_DNX_ESTUDIO", vinculoId: cl.id } });
        await tx.dnxContactoEvento.create({
          data: { contactoId: r.contactoId, tipo: "VINCULADO", datos: { vinculo: "CONOCIDO_DNX_ESTUDIO", clientId: cl.id, por: "etiqueta" }, autor: AUTOR },
        });
      });
    }

    if (!r.nuevo) { yaEstaban++; continue; }
    await cambiarEstado(r.contactoId, "REVISADO", AUTOR);
    importados++;
  }
  return { importados, yaEstaban };
}
