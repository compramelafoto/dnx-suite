import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { createBlogPost } from "@/lib/blog/admin-queries";
import { blogWhere } from "@/lib/blog/scope";
import { crearTestimonioImportado } from "@/lib/testimonios/repositorio";
import { agregarFotos, crearCategoria, crearTrabajo, publicarTrabajo } from "@/lib/trabajos/repositorio";
import { ensureWebsiteDraft } from "@/lib/website/draft";
import { olvidarRedirecciones } from "@/lib/website/redirecciones";
import type { DestinoImportacion } from "./destino";
import { ORIGEN_IMPORTACION } from "./dnx";

/**
 * El destino de verdad del importador (sólo con `--aplicar`): escribe en la base de FOTOFFICE por
 * los repositorios de cada módulo — el blog por el motor de `@repo/content` (`createBlogPost`),
 * Trabajos y Testimonios por los suyos, el borrador del sitio (`sectionsJson` / `navJson`, nunca la
 * versión publicada) y las redirecciones. Todo filtrado por `workspaceId`.
 */
export function crearDestinoPrisma(workspaceId: string): DestinoImportacion {
  const enBlog = blogWhere(workspaceId);
  const fallo = (r: { ok: false; error: string }) => new Error(r.error);

  return {
    async slugPublico() {
      const b = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } });
      return b?.publicSlug ?? null;
    },

    async autorBlog(nombre, slug) {
      const hay = await prisma.blogAuthor.findFirst({ where: { ...enBlog, slug }, select: { id: true } });
      if (hay) return { id: hay.id, creado: false };
      const a = await prisma.blogAuthor.create({ data: { ...enBlog, name: nombre, slug }, select: { id: true } });
      return { id: a.id, creado: true };
    },

    async categoriaBlog(nombre, slug) {
      const hay = await prisma.blogCategory.findFirst({ where: { ...enBlog, slug }, select: { id: true } });
      if (hay) return { id: hay.id, creada: false };
      const c = await prisma.blogCategory.create({ data: { ...enBlog, name: nombre, slug }, select: { id: true } });
      return { id: c.id, creada: true };
    },

    async articuloPorSlug(slug) {
      return prisma.blogPost.findFirst({ where: { ...enBlog, slug }, select: { id: true } });
    },

    async crearArticulo({ data, createdAt }) {
      const post = await createBlogPost(workspaceId, data);
      // El motor no deja elegir `createdAt`: se corrige después para que el orden sea el de Alboom.
      await prisma.blogPost.updateMany({ where: { id: post.id, ...enBlog }, data: { createdAt } });
      return { id: post.id };
    },

    async registrarMediaBlog(m) {
      const hay = await prisma.blogMedia.findFirst({ where: { ...enBlog, r2Key: m.r2Key }, select: { id: true } });
      if (hay) return false;
      await prisma.blogMedia.create({ data: { ...enBlog, ...m } });
      return true;
    },

    async categoriaTrabajo(nombre, slug) {
      const hay = await prisma.fotofficeTrabajoCategoria.findFirst({ where: { workspaceId, slug }, select: { id: true } });
      if (hay) return { id: hay.id, creada: false };
      const r = await crearCategoria(workspaceId, { nombre, slug });
      if (!r.ok) throw fallo(r);
      return { id: r.valor.id, creada: true };
    },

    async trabajoPorOrigen(origenExternoId) {
      const t = await prisma.fotofficeTrabajo.findFirst({
        where: { workspaceId, origenExterno: ORIGEN_IMPORTACION, origenExternoId },
        select: { id: true, slug: true, categoriaId: true, portadaUrl: true, estado: true },
      });
      if (!t) return null;
      const fotos = await prisma.fotofficeTrabajoFoto.findMany({ where: { trabajoId: t.id, workspaceId }, select: { origenUrl: true, url: true } });
      return { ...t, origenesFotos: fotos.map((f) => f.origenUrl ?? f.url) };
    },

    async slugsDeTrabajos() {
      const filas = await prisma.fotofficeTrabajo.findMany({ where: { workspaceId }, select: { slug: true } });
      return filas.map((f) => f.slug);
    },

    async crearTrabajo(t) {
      const r = await crearTrabajo(workspaceId, {
        titulo: t.titulo,
        slug: t.slug,
        categoriaId: t.categoriaId,
        lugar: t.lugar,
        fecha: t.fecha,
        descripcionHtml: t.descripcionHtml,
        destacado: t.destacado,
        origenExterno: ORIGEN_IMPORTACION,
        origenExternoId: t.origenExternoId,
      });
      if (!r.ok) throw fallo(r);
      return { id: r.valor.id };
    },

    async agregarFotosTrabajo(trabajoId, fotos) {
      const r = await agregarFotos(workspaceId, trabajoId, fotos);
      if (!r.ok) throw fallo(r);
      return r.valor.agregadas;
    },

    async publicarTrabajo(trabajoId) {
      const r = await publicarTrabajo(workspaceId, trabajoId);
      if (!r.ok) throw fallo(r);
    },

    async testimonioPorOrigen(origenExternoId) {
      return prisma.fotofficeTestimonio.findFirst({ where: { workspaceId, origenExternoId }, select: { id: true } });
    },

    async crearTestimonio(t) {
      const r = await crearTestimonioImportado(workspaceId, t.datos, {
        consentimientoTexto: t.consentimientoTexto,
        origenExternoId: t.origenExternoId,
        trabajoId: t.trabajoId,
        autorFotoUrl: t.autorFotoUrl,
        autorFotoKey: t.autorFotoKey,
        orden: t.orden,
      });
      return { id: r.id };
    },

    async leerBorrador() {
      const d = await ensureWebsiteDraft(workspaceId);
      return { sectionsJson: d.sectionsJson, navJson: d.navJson };
    },

    async guardarBorrador(cambios) {
      // Sólo el borrador: la versión publicada no se toca (publicar lo hace Daniel desde el panel).
      await prisma.fotofficeWorkspaceWebsite.update({
        where: { workspaceId },
        data: {
          ...(cambios.sectionsJson !== undefined ? { sectionsJson: cambios.sectionsJson as Prisma.InputJsonValue } : {}),
          ...(cambios.navJson !== undefined ? { navJson: cambios.navJson as Prisma.InputJsonValue } : {}),
        },
      });
    },

    async logoActual() {
      const b = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { logoUrl: true } });
      return b?.logoUrl ?? null;
    },

    async guardarLogo(url) {
      await prisma.fotofficeWorkspaceBranding.update({ where: { workspaceId }, data: { logoUrl: url } });
    },

    async crearRedirecciones(reglas, origen) {
      if (reglas.length === 0) return 0;
      const r = await prisma.fotofficeSitioRedireccion.createMany({
        data: reglas.map((x) => ({ workspaceId, desde: x.desde, hacia: x.hacia, codigo: x.codigo, origen })),
        skipDuplicates: true,
      });
      olvidarRedirecciones(workspaceId);
      return r.count;
    },
  };
}
