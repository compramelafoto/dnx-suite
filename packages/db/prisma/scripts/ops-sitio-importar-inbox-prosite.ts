/**
 * Importa los envíos del Inbox de Alboom Prosite («Inbox» → «Exportar» → XLS) a la bandeja de
 * formularios del sitio de FOTOFFICE (Sitio web → Formularios), agrupados por formulario.
 *
 * La interpretación del archivo vive en `apps/fotoffice/lib/sitio-formularios/importar-prosite.ts`
 * (probada con archivos de ejemplo); acá sólo se lee el archivo, se arma el informe y se escribe.
 *
 * ── Archivos de entrada ──
 *
 *   La exportación real de Prosite es UN CSV POR FORMULARIO, sin columna de formulario, con
 *   nombre `NNN__<nombre del formulario>__<cantidad>.csv` (encabezado tipo
 *   `E-mail,Instagram,Nombre,Enviado em`, fecha ISO en UTC `2025-04-26T17:41:32.944Z`).
 *   Se le puede pasar la CARPETA con todos (o varios archivos sueltos): el nombre del formulario
 *   sale del nombre de cada archivo y el informe compara la cantidad esperada con la leída.
 *   Un archivo que no sigue ese patrón usa su columna de formulario, si tiene, o `--formulario`.
 *
 *   Acepta .csv, .xls y .xlsx. Mira el contenido, no la extensión:
 *     - CSV (coma, punto y coma o tabulación; UTF-8 o Windows-1252);
 *     - «XLS» que en realidad es una tabla HTML o XML de Excel 2003 (lo más común en paneles web);
 *     - .xlsx o .xls binario de verdad: se lee con SheetJS (`xlsx`), que FOTOFFICE no tiene como
 *       dependencia; el script lo toma de otra app del monorepo (CompraMeLaFoto o FotoRank). Si no
 *       lo encuentra, abrí el archivo en Excel y guardalo como «CSV UTF-8 (delimitado por comas)».
 *   Columnas esperadas: una de fecha («Fecha», «Data»…), una con el nombre del formulario
 *   («Formulario»…) y los campos (Nombre, Correo, Teléfono, Instagram, Mensaje…). Si no hay
 *   columna de formulario, todo va a `--formulario "<nombre>"` (por omisión «Inbox de Prosite»).
 *   Fechas sin zona = hora argentina.
 *
 * ── Modos ──
 *
 *   (nada)      SIMULACIÓN: lee e interpreta el archivo y muestra el informe. NO abre la base.
 *   --aplicar   escribe en la base de FOTOFFICE. Idempotente (huella de fecha + formulario +
 *               datos): repetirlo no duplica. Los envíos quedan como LEÍDOS.
 *
 * Otros: `--slug <slug>` (workspace por su dirección pública; por omisión `dnx-estudio`),
 * `--formulario <nombre>` (ver arriba), `--estado LEIDO|ARCHIVADO` (cómo entran los envíos; por
 * omisión LEIDO).
 *
 * ── Cómo correrlo (desde apps/fotoffice) ──
 *
 *   Simulación:
 *     pnpm sitio:importar-inbox-prosite ~/Downloads/inbox-prosite/
 *
 *   De verdad (con las tablas de 20261230120000_fotoffice_sitio_formularios ya aplicadas):
 *     set -a && . ./.env.local && set +a
 *     DATABASE_URL_FOTOFFICE="$DATABASE_URL" pnpm sitio:importar-inbox-prosite ~/Downloads/inbox-prosite/ --aplicar
 *
 * Variable para --aplicar: DATABASE_URL_FOTOFFICE (no DATABASE_URL: el cliente de @repo/db puede
 * cargar packages/db/.env, que apunta a otra base). El informe no muestra datos de las personas:
 * sólo cantidades, columnas y fechas.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join, resolve } from "node:path";

type Opciones = { archivos: string[]; aplicar: boolean; slug: string; formulario: string; estado: "LEIDO" | "ARCHIVADO" };

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

function leerOpciones(argv: string[]): Opciones {
  const o: Opciones = { archivos: [], aplicar: false, slug: "dnx-estudio", formulario: "Inbox de Prosite", estado: "LEIDO" };
  const entradas: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const [a, pegado] = argv[i].includes("=") && argv[i].startsWith("--") ? [argv[i].slice(0, argv[i].indexOf("=")), argv[i].slice(argv[i].indexOf("=") + 1)] : [argv[i], undefined];
    const valor = () => pegado ?? argv[++i] ?? salir(`Falta el valor de ${a}`);
    if (a === "--aplicar") o.aplicar = true;
    else if (a === "--slug") o.slug = valor();
    else if (a === "--formulario") o.formulario = valor();
    else if (a === "--estado") {
      const e = valor().toUpperCase();
      if (e !== "LEIDO" && e !== "ARCHIVADO") salir("--estado tiene que ser LEIDO o ARCHIVADO.");
      o.estado = e;
    } else if (a.startsWith("--")) salir(`No conozco la opción ${a}. Ver el encabezado del script.`);
    else entradas.push(resolve(process.cwd(), a));
  }
  if (entradas.length === 0) salir("Falta la carpeta o los archivos exportados del Inbox de Prosite. Ver el encabezado del script.");
  for (const e of entradas) {
    if (!existsSync(e)) salir(`No encuentro ${e}`);
    if (statSync(e).isDirectory()) {
      const dentro = readdirSync(e)
        .filter((n) => /\.(csv|xlsx?|txt)$/i.test(n) && !n.startsWith("."))
        .sort((x, y) => x.localeCompare(y, "es", { numeric: true }))
        .map((n) => join(e, n));
      if (dentro.length === 0) salir(`La carpeta ${e} no tiene archivos .csv, .xls ni .xlsx.`);
      o.archivos.push(...dentro);
    } else o.archivos.push(e);
  }
  if (!/^[a-z0-9-]{2,80}$/.test(o.slug)) salir("--slug no parece una dirección pública de workspace.");
  return o;
}

/** SheetJS de otra app del monorepo (no se agrega como dependencia de FOTOFFICE). */
function cargarSheetJs(): unknown {
  for (const app of ["compramelafoto", "fotorank"]) {
    try {
      const req = createRequire(new URL(`../../../../apps/${app}/package.json`, import.meta.url));
      return req("xlsx");
    } catch {
      // probar la siguiente
    }
  }
  return null;
}

function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(dirección ilegible)";
  }
}

const fecha = (d: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short" }).format(d);

async function main() {
  const o = leerOpciones(process.argv.slice(2));

  if (o.aplicar) {
    const url = process.env.DATABASE_URL_FOTOFFICE?.trim();
    if (!url) salir("Falta DATABASE_URL_FOTOFFICE (la base de FOTOFFICE). Ver el encabezado del script.");
    process.env.DATABASE_URL = url;
    console.log(`Base: ${hostDe(url)}`);
  } else {
    // La simulación no abre la base: si algo la pidiera por error, falla en vez de leer otra.
    process.env.DATABASE_URL = "postgresql://simulacion-sin-base@127.0.0.1:1/simulacion";
    process.env.DATABASE_URL_FOTOFFICE = "";
  }

  const lib = await import("../../../../apps/fotoffice/lib/sitio-formularios/importar-prosite");
  type Celda = import("../../../../apps/fotoffice/lib/sitio-formularios/importar-prosite").Celda;

  const leidos: Array<{ archivo: string; filas: Celda[][]; formato: string }> = [];
  for (const archivo of o.archivos) {
    const bytes = new Uint8Array(readFileSync(archivo));
    let { formato, filas } = lib.filasDeArchivoDeTexto(bytes) as { formato: string; filas: Celda[][] };
    if (formato === "xlsx" || formato === "xls-binario") {
      const xlsx = cargarSheetJs();
      if (!xlsx) salir(`${basename(archivo)} es un Excel de verdad y no encontré SheetJS (xlsx) en el monorepo. Guardalo como «CSV UTF-8» y pasá ese archivo.`);
      filas = lib.filasConSheetJs(xlsx as import("../../../../apps/fotoffice/lib/sitio-formularios/importar-prosite").LectorSheetJs, bytes);
    }
    leidos.push({ archivo, filas, formato });
  }
  console.log(`Archivos: ${leidos.length}`);
  const { envios, repetidas, descartadas, porArchivo } = lib.combinarArchivos(leidos, o.formulario);
  porArchivo.forEach((a, i) => {
    const r = a.resultado;
    const leidas = r.envios.length + r.repetidas + r.descartadas.length;
    const aviso = a.esperados !== null && a.esperados !== leidas ? ` · ¡el nombre dice ${a.esperados} y hay ${leidas} filas!` : "";
    console.log("");
    console.log(`· ${basename(a.archivo)} (${leidos[i].formato}) → «${a.formulario}»`);
    console.log(`  fecha: ${r.columnas.fecha ?? "(no hay)"} · campos: ${r.columnas.campos.join(", ") || "(ninguno)"}${r.columnas.ignoradas.length ? ` · no se importan: ${r.columnas.ignoradas.join(", ")}` : ""}`);
    console.log(`  válidos: ${a.nuevos} · repetidos: ${r.repetidas + r.envios.length - a.nuevos} · descartados: ${r.descartadas.length}${aviso}`);
    for (const d of r.descartadas.slice(0, 10)) console.log(`    fila ${d.fila}: ${d.motivo}`);
  });
  const grupos = lib.agruparPorFormulario(envios);

  console.log("");
  console.log(`Total: ${envios.length} envíos válidos · repetidos: ${repetidas} · descartados: ${descartadas}`);
  console.log(`Con correo: ${envios.filter((e) => e.contacto.email).length} · con teléfono: ${envios.filter((e) => e.contacto.telefono).length} · con nombre: ${envios.filter((e) => e.contacto.nombre).length}`);
  console.log(`Entran como: ${o.estado === "LEIDO" ? "leídos" : "archivados"}`);
  console.log("");
  console.log("Formularios:");
  for (const g of grupos) {
    const rango = g.desde && g.hasta ? `${fecha(g.desde)} a ${fecha(g.hasta)}` : "sin fechas";
    console.log(`  · ${g.nombre}: ${g.envios.length} envíos (${rango}${g.sinFecha ? `; ${g.sinFecha} sin fecha` : ""})`);
  }

  if (!o.aplicar) {
    console.log("");
    console.log("Simulación: no se escribió nada. Para importar, repetí con --aplicar (ver el encabezado del script).");
    return;
  }

  const { prisma } = await import("@repo/db");
  const { asegurarFormulario, ORIGEN_IMPORTADO_PROSITE } = await import("../../../../apps/fotoffice/lib/website/formularios.server");
  const { datosDeEnvioJson } = await import("../../../../apps/fotoffice/lib/website/formularios");
  // Los envíos sin fecha entran con la de hoy (la columna es obligatoria) y marcados «sin fecha»;
  // su huella no incluye esta fecha, así que repetir la importación no los duplica.
  const ahora = new Date();
  try {
    const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { publicSlug: o.slug }, select: { workspaceId: true, commercialName: true } });
    if (!branding) salir(`No hay ningún workspace con la dirección /w/${o.slug} en esa base.`);
    try {
      await prisma.fotofficeSitioFormularioEnvio.count({ where: { workspaceId: branding.workspaceId } });
    } catch {
      salir("Faltan las tablas de formularios: aplicá antes el SQL 20261230120000_fotoffice_sitio_formularios.");
    }
    console.log("");
    console.log(`Workspace: ${branding.commercialName} (/w/${o.slug})`);

    let nuevos = 0;
    for (const g of grupos) {
      const formularioId = await asegurarFormulario(prisma, branding.workspaceId, g.clave, g.nombre, ORIGEN_IMPORTADO_PROSITE);
      let delGrupo = 0;
      for (let i = 0; i < g.envios.length; i += 500) {
        const tanda = g.envios.slice(i, i + 500);
        const res = await prisma.fotofficeSitioFormularioEnvio.createMany({
          data: tanda.map((e) => ({
            workspaceId: branding.workspaceId,
            formularioId,
            datosJson: datosDeEnvioJson(e.pares, e.fecha === null),
            nombre: e.contacto.nombre,
            email: e.contacto.email,
            telefono: e.contacto.telefono,
            estado: o.estado,
            claveImportacion: e.clave,
            createdAt: e.fecha ?? ahora,
          })),
          // La huella es única por workspace: lo ya importado se saltea.
          skipDuplicates: true,
        });
        delGrupo += res.count;
      }
      nuevos += delGrupo;
      console.log(`  · ${g.nombre}: ${delGrupo} nuevos, ${g.envios.length - delGrupo} ya estaban`);
    }
    console.log("");
    console.log(`Listo: ${nuevos} envíos nuevos, ${envios.length - nuevos} ya estaban.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
