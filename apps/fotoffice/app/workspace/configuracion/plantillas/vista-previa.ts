/**
 * Vista previa de Configuración → Plantillas, con datos de ejemplo. Pura: sólo usa los módulos puros
 * de plantillas (`motor`, `render`, `variables`, `constantes`), así corre en el navegador sin tocar
 * la base. Los campos personalizados muestran su nombre entre corchetes.
 */
import { MARCADOR_FIRMA, type Canal, type TipoPlantilla } from "@/lib/plantillas/constantes";
import { analizar, completar, type ErrorPlantilla } from "@/lib/plantillas/motor";
import { cuerpoCorreoHtml, textoWhatsapp } from "@/lib/plantillas/render";
import { clavesPermitidas, resolverVariables, type ContextoVariables } from "@/lib/plantillas/variables";

export type CampoDeEjemplo = { clave: string; nombre: string };

/** Datos ficticios para la vista previa. Nunca salen de la pantalla. */
export function contextoDeEjemplo(campos: readonly CampoDeEjemplo[], hoy = new Date()): ContextoVariables {
  return {
    persona: { nombreCompleto: "Ana Pérez", email: "ana.perez@ejemplo.com", telefono: "+54 9 341 555-0101" },
    organizacion: {
      nombre: "Estudio de ejemplo",
      email: "hola@estudio-ejemplo.com",
      telefono: "+54 9 341 555-0202",
      whatsapp: "+54 9 341 555-0202",
      web: "https://estudio-ejemplo.com",
      instagram: "@estudioejemplo",
      ciudad: "Rosario",
    },
    usuario: { nombre: "Laura Gómez", email: "laura@estudio-ejemplo.com" },
    hoy,
    consulta: {
      numero: "C-2026-0042",
      tipo: "Casamiento",
      // Medianoche UTC: se muestra como fecha de calendario, igual que las del formulario público.
      fecha: new Date(Date.UTC(2026, 11, 12)),
      lugar: "Salón Los Álamos",
      mensaje: "Hola, quería saber disponibilidad y precios para la fecha.",
      etapa: "Nueva",
    },
    socio: { numero: "0123" },
    campos: Object.fromEntries(campos.map((c) => [c.clave, `[${c.nombre}]`])),
  };
}

const FIRMA_TEXTO = "Saludos,\nLaura Gómez · Estudio de ejemplo";
const FIRMA_HTML =
  '<p style="color:#555;border-top:1px solid #ddd;padding-top:8px">Saludos,<br>Laura Gómez · Estudio de ejemplo</p>';

export type ErrorDeVista = ErrorPlantilla & { campo: "asunto" | "cuerpo" };

export type VistaPrevia =
  | { ok: true; asunto: string | null; html: string | null; texto: string | null; vacias: string[] }
  | { ok: false; errores: ErrorDeVista[] };

/**
 * Arma la vista previa del texto con los datos de ejemplo. En Correo devuelve el HTML del cuerpo
 * (escapado por el render, con la firma al final si falta); en WhatsApp, el texto.
 */
export function armarVistaPrevia(
  canal: Canal,
  tipo: TipoPlantilla,
  campos: readonly CampoDeEjemplo[],
  asunto: string,
  cuerpo: string,
  hoy = new Date(),
): VistaPrevia {
  const permitidas = clavesPermitidas(tipo, tipo === "GENERAL" ? [] : campos);
  const valores = resolverVariables(contextoDeEjemplo(campos, hoy));
  const errores: ErrorDeVista[] = [];
  const vacias: string[] = [];

  let asuntoFinal: string | null = null;
  if (canal === "EMAIL") {
    const a = analizar(asunto.replace(/\r\n?/g, "\n"), permitidas);
    if (!a.ok) errores.push(...a.errores.map((e) => ({ ...e, campo: "asunto" as const })));
    else {
      const r = completar(a.piezas, valores);
      // En el asunto la firma no tiene lugar: se quita el marcador.
      asuntoFinal = r.texto.split(MARCADOR_FIRMA).join("").replace(/\s+/g, " ").trim();
      vacias.push(...r.vacias);
    }
  }
  const c = analizar(cuerpo.replace(/\r\n?/g, "\n"), permitidas);
  if (!c.ok) errores.push(...c.errores.map((e) => ({ ...e, campo: "cuerpo" as const })));
  if (errores.length || !c.ok) return { ok: false, errores };

  const r = completar(c.piezas, valores);
  for (const v of r.vacias) if (!vacias.includes(v)) vacias.push(v);
  if (canal === "EMAIL") {
    return { ok: true, asunto: asuntoFinal, html: cuerpoCorreoHtml(r.texto, FIRMA_HTML, r.conFirma), texto: null, vacias };
  }
  return { ok: true, asunto: null, html: null, texto: textoWhatsapp(r.texto, FIRMA_TEXTO), vacias };
}

/** Documento completo para el `srcdoc` del iframe aislado de la vista previa del correo. */
export function documentoDeCorreo(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;margin:16px}a{color:#1d4ed8}</style></head><body>${html}</body></html>`;
}
