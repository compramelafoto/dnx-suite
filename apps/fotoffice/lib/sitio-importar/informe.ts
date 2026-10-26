import type { Contador, Informe } from "./cargar";

/**
 * El informe del importador en español, para leerlo sin abrir el JSON: qué se trajo, qué ya estaba,
 * qué falló (con las fotos que no se pudieron copiar, por artículo o trabajo) y las landings que no
 * se migraron, para que Daniel marque las que quiera conservar.
 */

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function linea(nombre: string, c: Contador, extra = ""): string {
  return `- **${nombre}:** ${plural(c.creados, "nuevo", "nuevos")}, ${plural(c.existentes, "ya estaba", "ya estaban")}, ${plural(c.fallidos, "falló", "fallaron")}${extra}`;
}

function fechaArgentina(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));
}

export function informeEnMarkdown(i: Informe): string {
  const out: string[] = [];
  const simulacion = i.modo === "simulacion";
  out.push(`# Importación del sitio de Alboom — ${simulacion ? "Simulación" : "Aplicada"}`);
  out.push("");
  out.push(`${fechaArgentina(i.fecha)} (hora argentina). Origen: ${i.base}. Sitio: \`/w/${i.slugPublico}\` (workspace \`${i.workspaceId}\`).`);
  out.push("");
  if (simulacion) {
    out.push("> **Simulación:** se leyó y transformó todo, pero no se escribió nada en la base ni se subió ninguna foto. Los «nuevos» son lo que se crearía.");
    out.push("");
  }

  out.push("## Resumen");
  out.push("");
  out.push(linea("Artículos del blog (en borrador)", i.articulos));
  out.push(`- **Autor del blog:** ${i.autorBlog === "creado" ? "se creó «Daniel Cuart»" : "ya estaba"}`);
  out.push(linea("Categorías del blog", i.categoriasBlog));
  out.push(linea("Categorías de trabajos", i.categoriasTrabajos));
  out.push(linea("Trabajos y galerías (publicados)", i.trabajos, i.trabajos.completados ? `, ${plural(i.trabajos.completados, "completado con fotos que faltaban", "completados con fotos que faltaban")}` : ""));
  out.push(linea("Testimonios (publicados)", i.testimonios));
  out.push(linea("Páginas propias (borrador del sitio)", i.paginas));
  out.push(`- **Portada del borrador:** ${i.portada.estado === "creada" ? `armada${i.portada.bloquesAnteriores ? ` (reemplazó ${plural(i.portada.bloquesAnteriores, "bloque", "bloques")})` : ""}` : "ya estaba importada"}`);
  out.push(`- **Menú del borrador:** ${i.menu === "creado" ? "armado" : "ya estaba importado"}`);
  out.push(`- **Logo:** ${i.logo}`);
  out.push(`- **Redirecciones:** ${plural(i.redirecciones.total, "regla", "reglas")}, ${plural(i.redirecciones.creadas, "nueva", "nuevas")}`);
  out.push(`- **Fotos:** ${plural(i.fotos.copiadas, "copiada", "copiadas")}${simulacion ? " (simuladas)" : ""}, ${plural(i.fotos.fallidas.length, "falló", "fallaron")}`);
  out.push("");
  out.push("Los artículos quedan en borrador: se publican con «Publicar contenido importado» en Sitio web → Blog. El sitio no se publicó: revisalo en la vista previa y publicalo vos.");
  out.push("");

  if (i.avisos.length) {
    out.push("## Avisos");
    out.push("");
    for (const a of i.avisos) out.push(`- ${a}`);
    out.push("");
  }

  const fallidos = [
    ...i.articulos.detalle.filter((d) => d.estado === "fallido").map((d) => `- Artículo ${d.alboomId}${d.titulo ? ` «${d.titulo}»` : ""}: ${d.error}`),
    ...i.trabajos.detalle.filter((d) => d.estado === "fallido").map((d) => `- Trabajo ${d.ruta}: ${d.error}`),
    ...i.testimonios.detalle.filter((d) => d.estado === "fallido").map((d) => `- Testimonio de ${d.nombre}: ${d.error}`),
    ...i.paginas.detalle.filter((d) => d.estado === "fallido").map((d) => `- Página ${d.alboom} → /${d.slug}: ${d.error}`),
  ];
  if (fallidos.length) {
    out.push("## Lo que no se pudo traer");
    out.push("");
    out.push(...fallidos);
    out.push("");
  }

  if (i.fotos.fallidas.length) {
    out.push("## Fotos que no se pudieron copiar");
    out.push("");
    const porDonde = new Map<string, Array<{ url: string; error: string }>>();
    for (const f of i.fotos.fallidas) porDonde.set(f.donde, [...(porDonde.get(f.donde) ?? []), f]);
    for (const [donde, fotos] of porDonde) {
      out.push(`- **${donde}**`);
      for (const f of fotos) out.push(`  - ${f.url} — ${f.error}`);
    }
    out.push("");
  }

  out.push("## Landings no migradas");
  out.push("");
  if (i.landingsNoMigradas.length) {
    out.push("Redirigen a `/trabajos`. Marcá las que quieras conservar como página propia:");
    out.push("");
    for (const l of i.landingsNoMigradas) out.push(`- [ ] [${l.ruta}](${l.url})`);
  } else {
    out.push("Ninguna.");
  }
  out.push("");

  out.push("## Detalle");
  out.push("");
  out.push("### Artículos");
  out.push("");
  for (const d of i.articulos.detalle) out.push(`- ${d.alboomId} → \`/blog/${d.slug}\` · ${d.estado}${d.titulo ? ` · ${d.titulo}` : ""}`);
  out.push("");
  out.push("### Trabajos y galerías");
  out.push("");
  for (const d of i.trabajos.detalle) {
    out.push(`- ${d.ruta} → \`/trabajos/${d.categoria}/${d.slug}\` · ${d.estado} · ${plural(d.fotos, "foto", "fotos")}${d.videos ? `, ${plural(d.videos, "video", "videos")}` : ""}`);
  }
  out.push("");
  out.push("### Páginas");
  out.push("");
  for (const d of i.paginas.detalle) out.push(`- ${d.alboom} → \`/${d.slug}\` · ${d.estado}${d.bloques ? ` · ${plural(d.bloques, "bloque", "bloques")}` : ""}`);
  out.push("");
  return out.join("\n");
}
