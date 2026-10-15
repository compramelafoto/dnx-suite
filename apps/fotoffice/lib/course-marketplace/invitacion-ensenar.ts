/**
 * La invitación a enseñar (spec, sección 3): en Mis cursos, en el portal del socio y en la página
 * pública de cada curso. Crear el negocio es siempre un botón explícito (`createOwnBusinessAction`);
 * desde afuera, primero se registra y la bienvenida le pregunta a qué vino.
 */
export const INVITACION_A_ENSENAR = {
  titulo: "¿Querés enseñar?",
  texto: "Creá tu espacio, subí tus cursos y que las instituciones los vendan.",
  boton: "Crear mi espacio",
  botonPublico: "Creá tu cuenta",
  aclaracion: "Crea un espacio nuevo con vos como responsable. Tu ficha y tus cursos siguen igual.",
} as const;

export function debeInvitarAEnsenar(input: { tieneNegocio: boolean }): boolean {
  return !input.tieneNegocio;
}

export function enlaceParaEnsenarDesdeAfuera(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}/login?next=${encodeURIComponent("/bienvenida")}`;
}
