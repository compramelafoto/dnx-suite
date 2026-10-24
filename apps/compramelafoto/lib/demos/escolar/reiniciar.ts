/**
 * «Reiniciar» de la demo escolar: deja la demo como recién preparada para volver a recorrerla.
 *
 * Borra lo que se genera al recorrerla (pedidos, preventas, selecciones, diseños, links de canje,
 * comisiones, consultas, accesos por selfie) y lo que se creó en vivo (otros colegios, alumnos y
 * usuarios del colegio). Conserva lo que cuesta armar: plantillas, fotos, escuela y alumnos
 * sembrados. Antes de borrar nada, verifica que todo sea del fotógrafo demo y de un álbum de prueba.
 */

import { prisma } from "@/lib/prisma";
import { esUsuarioDemo } from "@/lib/demos/identidad";
import { DEMO_ESCOLAR } from "@/lib/demos/escolar/datos";
import { ocultarFotosDeLaToma } from "@/lib/demos/escolar/fotos-toma";

export type ResumenReinicio = { borrados: Record<string, number>; avisos: string[] };

export async function reiniciarDemoEscolar(): Promise<ResumenReinicio> {
  const borrados: Record<string, number> = {};
  const avisos: string[] = [];

  const fotografo = await prisma.user.findUnique({
    where: { email: DEMO_ESCOLAR.fotografo.email },
    select: { id: true, tags: true },
  });
  if (!fotografo || !esUsuarioDemo(fotografo)) {
    return { borrados, avisos: ["La demo todavía no está preparada."] };
  }
  const album = await prisma.album.findUnique({
    where: { publicSlug: DEMO_ESCOLAR.album.slug },
    select: { id: true, userId: true, isTest: true, schoolId: true },
  });
  if (!album || album.userId !== fotografo.id || !album.isTest) {
    return { borrados, avisos: ["No se encontró el álbum demo de prueba: no se borra nada."] };
  }
  const albumId = album.id;

  async function paso(nombre: string, fn: () => Promise<{ count: number } | number>) {
    try {
      const r = await fn();
      borrados[nombre] = typeof r === "number" ? r : r.count;
    } catch (err) {
      avisos.push(`${nombre}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const orderIds = (
    await prisma.order.findMany({ where: { albumId }, select: { id: true } })
  ).map((o) => o.id);
  const tagsEspejo = orderIds.map((id) => `ALBUM_ORDER:${id}`);

  // Diseños: primero se suelta la revisión vigente, que apunta al proyecto sin cascada.
  const disenoWhere = {
    OR: [
      { albumId },
      { photographerUserId: fotografo.id },
      ...(orderIds.length ? [{ albumOrderId: { in: orderIds } }] : []),
    ],
  };
  await paso("diseños", async () => {
    await prisma.designProject.updateMany({ where: disenoWhere, data: { currentRevisionId: null } });
    return prisma.designProject.deleteMany({ where: disenoWhere });
  });
  if (orderIds.length) {
    await paso("links de canje", () => prisma.packAccessToken.deleteMany({ where: { orderId: { in: orderIds } } }));
    await paso("pedidos de impresión espejo", () =>
      prisma.printOrder.deleteMany({ where: { tags: { hasSome: tagsEspejo } } }),
    );
  }
  await paso("comisiones del colegio", () => prisma.organizerCommission.deleteMany({ where: { albumId } }));
  await paso("compras de pack", () => prisma.packPurchaseEntitlement.deleteMany({ where: { albumId } }));
  await paso("pedidos", () => prisma.order.deleteMany({ where: { albumId } }));
  await paso("preventas", async () => {
    await prisma.subject.updateMany({ where: { albumId }, data: { createdByOrderId: null } });
    return prisma.preCompraOrder.deleteMany({ where: { albumId } });
  });
  await paso("alumnos de preventa", () => prisma.subject.deleteMany({ where: { albumId } }));
  await paso("accesos por selfie", async () => {
    const a = await prisma.hiddenAlbumGrant.deleteMany({ where: { albumId } });
    const b = await prisma.hiddenAlbumAttempt.deleteMany({ where: { albumId } });
    return a.count + b.count;
  });
  await paso("consultas de la landing", () =>
    prisma.schoolLead.deleteMany({ where: { referredByUserId: fotografo.id } }),
  );

  await paso("fotos vueltas a ocultar", () => ocultarFotosDeLaToma(albumId));

  // Lo creado en vivo: colegios nuevos, alumnos cargados a mano, usuarios del colegio sumados.
  const escuelaSembrada = album.schoolId;
  await paso("colegios creados en vivo", async () => {
    const extra = await prisma.school.findMany({
      where: { ownerId: fotografo.id, id: { not: escuelaSembrada ?? -1 }, albums: { none: {} } },
      select: { id: true },
    });
    if (!extra.length) return 0;
    return prisma.school.deleteMany({ where: { id: { in: extra.map((s) => s.id) } } });
  });
  if (escuelaSembrada) {
    await paso("alumnos cargados en vivo", async () => {
      const r = await prisma.albumStudentRosterEntry.deleteMany({
        where: { albumId, student: { NOT: { externalStudentId: { startsWith: "demo-" } } } },
      });
      await prisma.schoolStudent.deleteMany({
        where: {
          schoolId: escuelaSembrada,
          OR: [{ externalStudentId: null }, { NOT: { externalStudentId: { startsWith: "demo-" } } }],
        },
      });
      return r;
    });
    await paso("usuarios del colegio sumados en vivo", () =>
      prisma.schoolOrganizer.deleteMany({
        where: { schoolId: escuelaSembrada, user: { email: { not: DEMO_ESCOLAR.colegioUsuario.email } } },
      }),
    );
    await paso("invitaciones del colegio", () =>
      prisma.schoolOrganizerInvitation.deleteMany({ where: { schoolId: escuelaSembrada } }),
    );
  }

  return { borrados, avisos };
}
