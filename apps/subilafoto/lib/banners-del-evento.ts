import "server-only";
import { prisma } from "@repo/db";
import { DURACION, enlaceParaMirar } from "./moderacion/vista";
import { enlaceDeBannerValido, esClaveDeBannerDeProveedor } from "./banner";
import type { BannerParaMostrar } from "@/app/e/[codigo]/pie-rotativo";

/**
 * Los banners de los proveedores de un evento, listos para el pie del invitado.
 *
 * Sólo los que subieron uno: un proveedor que completó la ficha sin imagen sigue
 * apareciendo al pie del álbum con su nombre, pero no ocupa un turno del pie vacío.
 *
 * El nombre sale de `DnxPartner`, que es donde viven los datos de la empresa; la
 * participación en este evento —y el banner— viven en `SubilafotoEventVendor`.
 */
export async function bannersDeProveedores(eventoId: string): Promise<BannerParaMostrar[]> {
  const vendors = await prisma.subilafotoEventVendor.findMany({
    where: { eventId: eventoId, bannerUrl: { not: null } },
    // Estable: sin un orden fijo, cada recarga los rota distinto y parece roto.
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    select: { partnerId: true, bannerUrl: true, bannerLinkUrl: true },
  });
  if (vendors.length === 0) return [];

  const empresas = await prisma.dnxPartner.findMany({
    where: { id: { in: vendors.map((v) => v.partnerId) }, archivedAt: null },
    select: { id: true, name: true },
  });
  const nombre = new Map(empresas.map((e) => [e.id, e.name]));

  const listos = await Promise.all(
    vendors.map(async (v): Promise<BannerParaMostrar | null> => {
      /*
        Sólo claves nuestras, nunca una dirección pegada a mano. Y se firma por lo que
        dura la proyección: el invitado mira esta pantalla toda la noche.
      */
      if (!esClaveDeBannerDeProveedor(v.bannerUrl)) return null;
      const url = await enlaceParaMirar(v.bannerUrl!, DURACION.proyeccion);
      // Una empresa archivada no se muestra: su ficha ya no está vigente.
      const quien = nombre.get(v.partnerId);
      if (!quien) return null;

      return {
        url,
        enlace: enlaceDeBannerValido(v.bannerLinkUrl),
        nombre: quien,
      } satisfies BannerParaMostrar;
    }),
  );

  return listos.filter((b): b is BannerParaMostrar => b !== null);
}
