import { z } from "@repo/dnx-bot";
import { ACCIONES_PERMITIDAS, ACCIONES_QUE_MODIFICAN } from "@/lib/soporte/acciones-catalogo";

export const CATEGORIAS = ["FALTA_INFO_BOT", "SE_ACLARA_CON_DATOS", "PROBABLE_ERROR_CODIGO", "OPERATIVO", "OTRO"] as const;

/** Lo que la IA tiene que devolver: un único objeto JSON con esta forma. */
export const DiagnosticoIA = z.strictObject({
  categoria: z.enum(CATEGORIAS),
  // La IA se pasa de largo seguido: recortar es mejor que perder el diagnóstico entero.
  resumen: z
    .string()
    .min(1)
    .transform((s) => (s.length > 140 ? `${s.slice(0, 139)}…` : s)),
  // En la práctica la IA devuelve los hallazgos como lista (tickets #46–#63 fallaron por eso).
  hallazgos: z.union([z.string(), z.array(z.string()).transform((l) => l.map((h) => `- ${h}`).join("\n"))]),
  respuestaSugerida: z.string(),
  acciones: z
    .array(
      z.strictObject({
        herramienta: z.enum(ACCIONES_PERMITIDAS),
        input: z.record(z.string(), z.unknown()),
        motivo: z.string(),
        tildada: z.boolean(),
      }),
    )
    .max(3),
  confianza: z.enum(["ALTA", "MEDIA", "BAJA"]),
});

export type ResultadoDiagnostico = z.infer<typeof DiagnosticoIA>;

/** Saca el objeto JSON del texto final (entre la primera "{" y la última "}") y lo valida. Si no sirve, dice por qué. */
export function analizarDiagnostico(texto: string): { ok: true; data: ResultadoDiagnostico } | { ok: false; motivo: string } {
  const i = texto.indexOf("{");
  const j = texto.lastIndexOf("}");
  if (i < 0 || j <= i) return { ok: false, motivo: "la respuesta no trae un objeto JSON" };
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto.slice(i, j + 1));
  } catch (e) {
    return { ok: false, motivo: `JSON mal formado (${e instanceof Error ? e.message : String(e)})` };
  }
  const r = DiagnosticoIA.safeParse(crudo);
  if (!r.success) {
    return { ok: false, motivo: r.error.issues.map((x) => `${x.path.join(".") || "(raíz)"}: ${x.message}`).join("; ") };
  }
  // Lo que cambia datos lo decide el admin: el texto del cliente podría haber inducido a la IA.
  return { ok: true, data: { ...r.data, acciones: r.data.acciones.map((a) => (ACCIONES_QUE_MODIFICAN.includes(a.herramienta) ? { ...a, tildada: false } : a)) } };
}

export function leerDiagnostico(texto: string): ResultadoDiagnostico | null {
  const r = analizarDiagnostico(texto);
  return r.ok ? r.data : null;
}
