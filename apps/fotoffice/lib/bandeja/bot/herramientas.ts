import { defineTool, z, type BotTool } from "@repo/dnx-bot";
import { prisma } from "@repo/db";
import { precioDeLista } from "@/lib/presupuestos/lista-precios";
import { listProducts } from "@/lib/sales/repository";

/**
 * Herramientas del bot que atiende a los clientes por WhatsApp. Son de LECTURA salvo
 * `preparar_presupuesto` (spec 2026-10-25), que da de alta la consulta y deja el presupuesto
 * armado esperando la aprobación de una persona: el bot nunca dice el precio. `pasar_a_persona` tampoco tiene efectos: deja anotado el
 * motivo y quien orquesta el turno (`responder.ts`) pasa el chat después de enviar la respuesta.
 * El `workspaceId` va por closure: nunca sale del modelo.
 */

export type ProductoAtencion = {
  name: string;
  priceMinor: number;
  categoryName: string | null;
  variants: { name: string; priceMinor: number }[];
};
export type EstudioAtencion = { nombre: string; direccion: string | null; horario: string | null; ciudad: string | null };
/** Un curso publicado del estudio (módulo Cursos), con el enlace público para inscribirse o comprarlo. */
export type CursoAtencion = {
  titulo: string;
  modalidad: "GRABADO" | "PRESENCIAL";
  resumen: string | null;
  /** Precio del grabado. En los presenciales el precio va en cada edición. */
  precio: number | null;
  url: string | null;
  proximas: { fecha: string; lugar: string; precio: number }[];
};

/** El chat que atiende el bot (para `preparar_presupuesto`). */
export type ChatAtencion = { id: string; waId: string; clientId: string | null; nombre: string | null };
export type DatosPresupuestoBot = {
  tipo: string;
  nombre: string;
  fecha?: string | null;
  lugar?: string | null;
  invitados?: number | null;
  /** Horas de cobertura (presupuesto por horas). */
  horas?: number | null;
  email?: string | null;
  detalle?: string | null;
};

export type DepsAtencion = {
  productos: (workspaceId: string) => Promise<ProductoAtencion[]>;
  estudio: (workspaceId: string) => Promise<EstudioAtencion | null>;
  /** Da de alta la consulta y arma el presupuesto para aprobar (spec 2026-10-25). */
  prepararPresupuesto: (workspaceId: string, chat: ChatAtencion, datos: DatosPresupuestoBot) => Promise<{ ok: boolean; message: string }>;
  cursos: (workspaceId: string) => Promise<CursoAtencion[]>;
};

const FECHA_CURSO = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

const DEPS: DepsAtencion = {
  productos: (workspaceId) => listProducts(workspaceId, { onlyActive: true, onlyVendible: true }),
  estudio: async (workspaceId) => {
    const b = await prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId },
      select: { commercialName: true, atencionDireccion: true, atencionHorario: true, city: true },
    });
    return b ? { nombre: b.commercialName, direccion: b.atencionDireccion, horario: b.atencionHorario, ciudad: b.city } : null;
  },
  cursos: async (workspaceId) => {
    const ahora = new Date();
    const [branding, cursos] = await Promise.all([
      prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } }),
      prisma.course.findMany({
        where: { workspaceId, status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          title: true, slug: true, shortDescription: true, deliveryMode: true, priceArs: true,
          instances: { where: { status: "ACTIVE", startDateTime: { gte: ahora } }, orderBy: { startDateTime: "asc" }, take: 3, select: { startDateTime: true, locationName: true, priceArs: true } },
        },
      }),
    ]);
    const { appUrl } = await import("@/lib/app-url");
    const base = appUrl();
    return cursos.map((c) => ({
      titulo: c.title,
      modalidad: c.deliveryMode === "RECORDED" ? ("GRABADO" as const) : ("PRESENCIAL" as const),
      resumen: c.shortDescription,
      precio: c.priceArs !== null ? Number(c.priceArs) : null,
      url: base && branding?.publicSlug ? `${base}/w/${branding.publicSlug}/cursos/${c.slug}` : null,
      proximas: c.instances.map((i) => ({ fecha: FECHA_CURSO.format(i.startDateTime), lugar: i.locationName, precio: Number(i.priceArs) })),
    }));
  },
  prepararPresupuesto: async (workspaceId, chat, datos) => {
    // Se carga recién acá: el alta de consultas y Presupuestos no hacen falta para contestar precios.
    const { prepararDesdeWhatsapp } = await import("@/lib/presupuesto-automatico/whatsapp");
    return prepararDesdeWhatsapp(workspaceId, chat, datos);
  },
};

const MAX_RESULTADOS = 15;
const VACIAS = new Set(["de", "la", "el", "los", "las", "un", "una", "unos", "unas", "para", "por", "con", "que", "quiero", "tienen", "hacen", "cuanto", "sale", "precio"]);

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const palabras = (s: string) => normalizar(s).split(/[^a-z0-9]+/).filter((p) => p.length >= 2 && !VACIAS.has(p));
/** Raíz: las primeras 5 letras ("digitalizar" y "digitalización" comparten "digit"). */
const raiz = (p: string) => p.slice(0, 5);

/** PURO. Productos con precio que comparten palabras con el texto, de más a menos coincidencias. */
export function buscarEnCatalogo<T extends ProductoAtencion>(productos: readonly T[], texto: string): T[] {
  const raices = [...new Set(palabras(texto).map(raiz))];
  if (raices.length === 0) return [];
  return productos
    .filter((p) => p.priceMinor > 0)
    .map((p) => {
      const suyas = palabras(p.name);
      const puntos = raices.filter((r) => suyas.some((s) => s.startsWith(r))).length;
      return { p, puntos };
    })
    .filter((x) => x.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || a.p.name.localeCompare(b.p.name, "es"))
    .slice(0, MAX_RESULTADOS)
    .map((x) => x.p);
}

const pesos = (minor: number) => precioDeLista(Math.round(minor) / 100);

function lineaDe(p: ProductoAtencion): string {
  const variantes = p.variants.filter((v) => v.priceMinor > 0);
  if (variantes.length === 0) return `- ${p.name}: ${pesos(p.priceMinor)}`;
  return `- ${p.name}: ${variantes.map((v) => `${v.name} ${pesos(v.priceMinor)}`).join(" · ")}`;
}

export function herramientasDeAtencion(
  workspaceId: string,
  parciales: Partial<DepsAtencion> = {},
  chat: ChatAtencion | null = null,
): { tools: BotTool[]; pedidoDePersona: () => string | null } {
  const deps: DepsAtencion = { ...DEPS, ...parciales };
  let motivoPersona: string | null = null;

  const tools: BotTool[] = [
    defineTool({
      name: "buscar_productos",
      description:
        "Busca en el catálogo del estudio productos y servicios con su precio (copias, ampliaciones, cuadros, portarretratos, digitalización de VHS/DVD/CD/casetes, revelado de rollos, foto carnet, etc.). Usala SIEMPRE antes de decir un precio. Buscá con palabras simples (\"vhs\", \"copia 15x21\", \"cuadro canvas\").",
      input: z.object({ texto: z.string().min(1).max(120) }),
      kind: "read",
      run: async ({ texto }) => {
        const encontrados = buscarEnCatalogo(await deps.productos(workspaceId), texto);
        if (encontrados.length === 0) {
          return { ok: true, message: `No encontré nada en el catálogo para "${texto}". No inventes un precio: probá con otra palabra o pasá el chat a una persona.` };
        }
        return { ok: true, message: `Precios del catálogo (en pesos):\n${encontrados.map(lineaDe).join("\n")}` };
      },
    }),
    defineTool({
      name: "cursos_del_estudio",
      description:
        "Los cursos y talleres que ofrece el estudio (grabados o presenciales), con precio y el enlace para inscribirse o comprarlos. Usala cuando pregunten por cursos, talleres o clases de fotografía. No armes presupuesto para un curso: pasale el enlace.",
      input: z.object({}),
      kind: "read",
      run: async () => {
        const cursos = await deps.cursos(workspaceId);
        if (cursos.length === 0) return { ok: true, message: "Ahora no hay cursos publicados. Si el cliente quiere saber de próximos cursos, usá pasar_a_persona." };
        const lineas = cursos.map((c) => {
          const partes = [`- ${c.titulo} (${c.modalidad === "GRABADO" ? "grabado, para ver a su ritmo" : "presencial"})`];
          if (c.precio !== null && c.precio > 0) partes.push(`precio ${precioDeLista(c.precio)}`);
          for (const e of c.proximas) partes.push(`próxima fecha: ${e.fecha} en ${e.lugar}, ${precioDeLista(e.precio)}`);
          if (c.modalidad === "PRESENCIAL" && c.proximas.length === 0) partes.push("sin fechas abiertas por ahora");
          if (c.url) partes.push(`enlace: ${c.url}`);
          if (c.resumen) partes.push(`de qué trata: ${c.resumen}`);
          return partes.join(" · ");
        });
        return { ok: true, message: `Cursos del estudio:\n${lineas.join("\n")}` };
      },
    }),
    defineTool({
      name: "datos_del_estudio",
      description: "Nombre, dirección y horario de atención del estudio. Usala cuando el cliente tenga que venir, traer material o retirar.",
      input: z.object({}),
      kind: "read",
      run: async () => {
        const e = await deps.estudio(workspaceId);
        if (!e) return { ok: true, message: "No hay datos del estudio cargados. Si el cliente necesita la dirección, pasá el chat a una persona." };
        return {
          ok: true,
          message: [
            `Estudio: ${e.nombre}`,
            `Dirección: ${e.direccion ?? "no cargada"}${e.ciudad && e.direccion && !e.direccion.includes(e.ciudad) ? `, ${e.ciudad}` : ""}`,
            `Horario: ${e.horario ?? "no cargado"}`,
          ].join("\n"),
        };
      },
    }),
    defineTool({
      name: "preparar_presupuesto",
      description:
        "Para cualquier evento o sesión de fotos (XV / 15 años, casamientos, cumpleaños, bautismos, comuniones, eventos corporativos, sesiones, books…): registra la consulta y el estudio arma el presupuesto (te lo aprueba una persona y le llega al cliente por WhatsApp y correo). Usala cuando ya sepas el tipo, el nombre del cliente y cuántas horas dura (horas, de a media hora); si podés, también la fecha (aaaa-mm-dd), el lugar (salón o dirección y localidad), los invitados y el correo. No digas precios: el presupuesto lo manda el estudio. Si la herramienta te dice que no hay presupuesto automático para ese tipo, usá pasar_a_persona.",
      input: z.object({
        tipo: z.string().min(2).max(80),
        nombre: z.string().min(2).max(80),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        lugar: z.string().max(200).optional(),
        invitados: z.number().int().min(1).max(100000).optional(),
        horas: z.number().min(0.5).max(24).optional(),
        email: z.string().email().max(200).optional(),
        detalle: z.string().max(500).optional(),
      }),
      kind: "read",
      run: async (datos) => {
        if (!chat) return { ok: true, message: "Ahora no puedo registrar la consulta. Usá pasar_a_persona con un resumen de lo que pide." };
        return deps.prepararPresupuesto(workspaceId, chat, datos);
      },
    }),
    defineTool({
      name: "pasar_a_persona",
      description:
        "Deja el chat para que lo atienda una persona del estudio. Usala para presupuestos de eventos cuando preparar_presupuesto no los arma; reclamos; pedidos de descuento; cuando el cliente pide hablar con alguien; cuando quiere encargar algo (todavía no podés armar pedidos ni cobrar); o cuando no sabés la respuesta. Después de usarla, avisale al cliente que en breve le escribe alguien del estudio.",
      input: z.object({ motivo: z.string().min(3).max(200) }),
      kind: "read",
      run: async ({ motivo }) => {
        motivoPersona = motivo.trim();
        return { ok: true, message: "Listo: cuando termines este mensaje el chat pasa a una persona del estudio." };
      },
    }),
  ];

  return { tools, pedidoDePersona: () => motivoPersona };
}
