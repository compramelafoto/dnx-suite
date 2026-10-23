/**
 * Revisión y autorización de impresión: la familia (o quien vaya a recibir la pieza) ve todos los
 * textos que se van a imprimir, corrige los suyos, avisa si algo de lo que no puede tocar está
 * mal, y autoriza la impresión tal como se ve. La autorización queda guardada como prueba:
 * cuándo, con qué frase, qué textos vio y una huella del contenido.
 *
 * Pensado para reusarse fuera del canje escolar (FOTOFFICE, por ejemplo, para que una pareja
 * apruebe su álbum de casamiento): no depende de la base, de Next ni de nada de CompraMeLaFoto.
 * Si se mueve a un paquete compartido, se lleva este archivo y `components/revision-de-impresion`.
 */

/** La frase que se tilda. Se guarda tal cual con la autorización. */
export const FRASE_DE_AUTORIZACION = "Revisé todos los datos y autorizo la impresión tal como se ve";

/** Un texto que se va a imprimir, como se le mostró a quien autoriza. */
export type TextoAImprimir = {
  /** Con qué se reconoce el texto (por ejemplo la variable de la plantilla). */
  key: string;
  /** Cómo se le mostró: «Nombre del alumno». */
  label: string;
  value: string;
  /** Si quien revisa lo puede corregir (su nombre sí; el de los compañeros no). */
  editable: boolean;
};

/** Un bloque de nombres que no se corrige a mano (el listado del curso), con su título. */
export type ListaAImprimir = { title: string; names: string[] };

/** Un aviso de error en algo que quien revisa no puede corregir: le llega a quien produce. */
export type AvisoDeError = {
  at: string;
  /** Sobre qué es el aviso («listado»). */
  scope: string;
  text: string;
};

export type CorreccionDeTexto = { key: string; from: string; to: string };

/** La prueba de que se autorizó la impresión. */
export type AutorizacionDeImpresion = {
  /** Fecha y hora (ISO, con zona) de la autorización. */
  authorizedAt: string;
  /** La frase que se tildó. */
  statement: string;
  /** Qué se autorizó («Carpeta San Patricio»). */
  subject: string;
  /** Quién (lo que se sepa: nombre, email). */
  by: { name: string | null; email: string | null };
  /** Los textos tal como se vieron al autorizar (ya con las correcciones). */
  texts: Array<{ key: string; label: string; value: string }>;
  /** Las listas de nombres tal como se vieron. */
  lists: ListaAImprimir[];
  /** Lo que corrigió quien autoriza, antes → después. */
  edits: CorreccionDeTexto[];
  /**
   * Huella (sha256) del contenido final que se va a imprimir. La calcula el servidor al guardar,
   * con `contenidoCanonico`: dos contenidos iguales dan la misma huella.
   */
  digest: string | null;
  /** La revisión del diseño que se autorizó, si se conoce. */
  revisionId: number | null;
  userAgent: string | null;
};

/** Lo que guarda el diseño de la revisión de quien lo recibe. */
export type RevisionDelCliente = {
  authorization: AutorizacionDeImpresion | null;
  reports: AvisoDeError[];
  /** Cursos que sumó al listado (claves). */
  extraCourseKeys: string[];
};

/** JSON con las claves ordenadas: el mismo contenido da siempre el mismo texto (y la misma huella). */
export function contenidoCanonico(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(contenidoCanonico).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${contenidoCanonico(v)}`).join(",")}}`;
}

/**
 * Aplica las correcciones de quien revisa sólo sobre los textos que puede tocar. Lo demás se
 * ignora: aunque alguien mande otra clave, el nombre de un compañero no se cambia así.
 */
export function aplicarCorrecciones(
  valores: Record<string, string>,
  editables: ReadonlySet<string>,
  pedidas: Record<string, string> | null | undefined,
): { values: Record<string, string>; edits: CorreccionDeTexto[] } {
  const values = { ...valores };
  const edits: CorreccionDeTexto[] = [];
  for (const [key, raw] of Object.entries(pedidas ?? {})) {
    if (!editables.has(key) || typeof raw !== "string") continue;
    const to = raw.replace(/\s+/g, " ").trim().slice(0, 200);
    const from = values[key] ?? "";
    if (!to || to === from) continue;
    values[key] = to;
    edits.push({ key, from, to });
  }
  return { values, edits };
}

/** Limpia los avisos que llegan del navegador: texto corto, sin vacíos, pocos. */
export function limpiarAvisos(avisos: readonly unknown[] | null | undefined, scope: string, at: Date): AvisoDeError[] {
  return (avisos ?? [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim().slice(0, 2000))
    .filter(Boolean)
    .slice(0, 5)
    .map((text) => ({ at: at.toISOString(), scope, text }));
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Lee la revisión guardada tolerando campos faltantes. Null si no hay. */
export function parseRevisionDelCliente(raw: unknown): RevisionDelCliente | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = asRecord(raw);
  const a = asRecord(r.authorization);
  const authorization: AutorizacionDeImpresion | null =
    typeof a.authorizedAt === "string"
      ? {
          authorizedAt: a.authorizedAt,
          statement: str(a.statement) ?? FRASE_DE_AUTORIZACION,
          subject: str(a.subject) ?? "",
          by: { name: str(asRecord(a.by).name), email: str(asRecord(a.by).email) },
          texts: (Array.isArray(a.texts) ? a.texts : [])
            .map(asRecord)
            .map((t) => ({ key: str(t.key) ?? "", label: str(t.label) ?? "", value: str(t.value) ?? "" })),
          lists: (Array.isArray(a.lists) ? a.lists : []).map(asRecord).map((l) => ({
            title: str(l.title) ?? "",
            names: (Array.isArray(l.names) ? l.names : []).filter((n): n is string => typeof n === "string"),
          })),
          edits: (Array.isArray(a.edits) ? a.edits : [])
            .map(asRecord)
            .map((e) => ({ key: str(e.key) ?? "", from: str(e.from) ?? "", to: str(e.to) ?? "" })),
          digest: str(a.digest),
          revisionId: typeof a.revisionId === "number" ? a.revisionId : null,
          userAgent: str(a.userAgent),
        }
      : null;
  const reports = (Array.isArray(r.reports) ? r.reports : [])
    .map(asRecord)
    .filter((x) => typeof x.text === "string" && x.text.trim())
    .map((x) => ({ at: str(x.at) ?? "", scope: str(x.scope) ?? "", text: (x.text as string).trim() }));
  const extraCourseKeys = (Array.isArray(r.extraCourseKeys) ? r.extraCourseKeys : []).filter(
    (k): k is string => typeof k === "string" && k !== "",
  );
  if (!authorization && reports.length === 0 && extraCourseKeys.length === 0) return null;
  return { authorization, reports, extraCourseKeys };
}

/** «Carpeta San Patricio» → «Revisá tu carpeta San Patricio». */
export function tituloDeLaRevision(producto: string | null | undefined): string {
  const p = (producto ?? "").trim();
  if (!p) return "Revisá todo antes de confirmar";
  // Sólo la primera letra en minúscula: «Carpeta San Patricio» sigue con «San Patricio».
  const primera = p.charAt(0);
  const resto = p.slice(1);
  const enMinuscula = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]/.test(p) ? primera.toLowerCase() + resto : p;
  return `Revisá tu ${enMinuscula}`;
}
