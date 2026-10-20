import { defineTool, z, type BotTool } from "@repo/dnx-bot";
import { prisma } from "@repo/db";
import { precioDeLista } from "@/lib/presupuestos/lista-precios";
import { listProducts } from "@/lib/sales/repository";

/**
 * Herramientas del bot que atiende a los clientes por WhatsApp. Todas son de LECTURA: el bot no
 * crea ni cambia nada en esta etapa. `pasar_a_persona` tampoco tiene efectos: deja anotado el
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

export type DepsAtencion = {
  productos: (workspaceId: string) => Promise<ProductoAtencion[]>;
  estudio: (workspaceId: string) => Promise<EstudioAtencion | null>;
};

const DEPS: DepsAtencion = {
  productos: (workspaceId) => listProducts(workspaceId, { onlyActive: true }),
  estudio: async (workspaceId) => {
    const b = await prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId },
      select: { commercialName: true, atencionDireccion: true, atencionHorario: true, city: true },
    });
    return b ? { nombre: b.commercialName, direccion: b.atencionDireccion, horario: b.atencionHorario, ciudad: b.city } : null;
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
      name: "pasar_a_persona",
      description:
        "Deja el chat para que lo atienda una persona del estudio. Usala para presupuestos de XV, bodas, sesiones o eventos; reclamos; pedidos de descuento; cuando el cliente pide hablar con alguien; cuando quiere encargar algo (todavía no podés armar pedidos ni cobrar); o cuando no sabés la respuesta. Después de usarla, avisale al cliente que en breve le escribe alguien del estudio.",
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
