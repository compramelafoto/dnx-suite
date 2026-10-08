/**
 * Plantillas de checklist de los pedidos (Entrega B1, Task 5). Módulo PURO (sin base): lo usan el
 * servidor, las pruebas y el editor de Configuración → Pedidos.
 *
 * Forma guardada en `FotofficePedidoAjustes.checklistTemplates`: `[{ name, tasks: string[] }]`.
 * Topes: hasta 10 plantillas; nombre de hasta 80 caracteres, único (sin distinguir mayúsculas) y
 * con al menos una tarea; hasta 40 tareas por plantilla de hasta 200 caracteres. Todo se recorta
 * (trim) y nada puede quedar vacío.
 */

export const MAX_PLANTILLAS = 10;
export const MAX_TAREAS_PLANTILLA = 40;
export const MAX_TEXTO_TAREA = 200;
export const MAX_NOMBRE_PLANTILLA = 80;
/** Tope de tareas de un pedido (las de la plantilla más las que se agreguen a mano). */
export const MAX_TAREAS_PEDIDO = 100;

export type PlantillaChecklist = { name: string; tasks: string[] };

export const MENSAJES_CHECKLIST = {
  sinPermiso: "Sólo el dueño o un administrador pueden configurar los pedidos.",
  forma: "Las plantillas de checklist no son válidas.",
  demasiadasPlantillas: `Podés tener hasta ${MAX_PLANTILLAS} plantillas de checklist.`,
  nombre: `Cada plantilla necesita un nombre de hasta ${MAX_NOMBRE_PLANTILLA} caracteres.`,
  nombreRepetido: "Dos plantillas tienen el mismo nombre.",
  sinTareas: "Cada plantilla necesita al menos una tarea.",
  demasiadasTareas: `Cada plantilla puede tener hasta ${MAX_TAREAS_PLANTILLA} tareas.`,
  tarea: `Cada tarea necesita un texto de hasta ${MAX_TEXTO_TAREA} caracteres.`,
  plantillaNoExiste: "No encontramos esa plantilla de checklist.",
  tareaNoExiste: "No encontramos esa tarea.",
  yaTieneTareas: "El pedido ya tiene tareas: quitalas antes de aplicar una plantilla.",
  demasiadasEnPedido: `El pedido puede tener hasta ${MAX_TAREAS_PEDIDO} tareas.`,
  fallo: "No se pudo guardar el checklist.",
} as const;

export type ResultadoPlantillas = { ok: true; valor: PlantillaChecklist[] } | { ok: false; error: string };

export function validarTituloTarea(raw: unknown): { ok: true; valor: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: MENSAJES_CHECKLIST.tarea };
  const t = raw.trim();
  if (t.length === 0 || t.length > MAX_TEXTO_TAREA) return { ok: false, error: MENSAJES_CHECKLIST.tarea };
  return { ok: true, valor: t };
}

/** Valida lo que llega del editor. Estricto: cualquier falla corta con un mensaje. */
export function validarPlantillas(raw: unknown): ResultadoPlantillas {
  if (!Array.isArray(raw)) return { ok: false, error: MENSAJES_CHECKLIST.forma };
  if (raw.length > MAX_PLANTILLAS) return { ok: false, error: MENSAJES_CHECKLIST.demasiadasPlantillas };
  const vistos = new Set<string>();
  const valor: PlantillaChecklist[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object" || Array.isArray(p)) return { ok: false, error: MENSAJES_CHECKLIST.forma };
    const { name, tasks } = p as Record<string, unknown>;
    if (typeof name !== "string") return { ok: false, error: MENSAJES_CHECKLIST.nombre };
    const nombre = name.trim();
    if (nombre.length === 0 || nombre.length > MAX_NOMBRE_PLANTILLA) return { ok: false, error: MENSAJES_CHECKLIST.nombre };
    const clave = nombre.toLowerCase();
    if (vistos.has(clave)) return { ok: false, error: MENSAJES_CHECKLIST.nombreRepetido };
    vistos.add(clave);
    if (!Array.isArray(tasks)) return { ok: false, error: MENSAJES_CHECKLIST.forma };
    if (tasks.length === 0) return { ok: false, error: MENSAJES_CHECKLIST.sinTareas };
    if (tasks.length > MAX_TAREAS_PLANTILLA) return { ok: false, error: MENSAJES_CHECKLIST.demasiadasTareas };
    const titulos: string[] = [];
    for (const t of tasks) {
      const v = validarTituloTarea(t);
      if (!v.ok) return v;
      titulos.push(v.valor);
    }
    valor.push({ name: nombre, tasks: titulos });
  }
  return { ok: true, valor };
}

/**
 * Lee lo guardado con tolerancia (un JSON viejo o dañado no rompe la pantalla): descarta lo que no
 * tiene forma y recorta a los topes. Lo que escribe el editor ya pasó por `validarPlantillas`.
 */
export function leerPlantillas(json: unknown): PlantillaChecklist[] {
  if (!Array.isArray(json)) return [];
  const salida: PlantillaChecklist[] = [];
  for (const p of json) {
    if (salida.length >= MAX_PLANTILLAS) break;
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const { name, tasks } = p as Record<string, unknown>;
    if (typeof name !== "string" || !Array.isArray(tasks)) continue;
    const nombre = name.trim().slice(0, MAX_NOMBRE_PLANTILLA);
    if (!nombre) continue;
    const titulos = tasks
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().slice(0, MAX_TEXTO_TAREA))
      .filter((t) => t.length > 0)
      .slice(0, MAX_TAREAS_PLANTILLA);
    salida.push({ name: nombre, tasks: titulos });
  }
  return salida;
}

/**
 * Plantillas de DNX Estudio (semilla). Según `docs/alboom/09`, Alboom lista dos veces «Recoger firma
 * del contrato» (una por plantilla, error de origen): acá va una sola vez en cada una.
 */
export const PLANTILLAS_CHECKLIST_DNX: readonly PlantillaChecklist[] = [
  {
    name: "Pedidos con Contrato",
    tasks: ["Enviar contrato", "Recoger firma del contrato", "Cobrar seña", "Confirmar horarios y lugar", "Asignar equipo", "Evento realizado", "Entregar material"],
  },
  {
    name: "Pedidos Simple",
    tasks: ["Cobrar seña", "Confirmar horarios y lugar", "Asignar equipo", "Evento realizado", "Entregar material"],
  },
];
