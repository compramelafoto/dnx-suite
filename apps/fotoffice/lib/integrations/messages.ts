/**
 * Lo que lee el dueño cuando algo sale bien o mal al conectar una cuenta.
 *
 * Un mensaje nunca nombra una variable de entorno ni menciona tokens: quien está mirando
 * esta pantalla no puede hacer nada con esa información, y a quien no debería estar
 * mirándola le estaría contando cómo está armado el sistema. El detalle técnico va al log
 * del servidor, sanitizado.
 *
 * Módulo PURO: sin base y sin red.
 */

const ERRORES: Record<string, string> = {
  sin_permiso: "No tenés permiso para conectar cuentas de esta institución.",
  integracion_desconocida: "Esa integración no está disponible.",
  falta_configuracion:
    "La conexión con Google todavía no está habilitada en la plataforma. Escribinos y lo resolvemos.",
  cancelado: "Cancelaste la conexión con Google. No se guardó nada.",
  respuesta_incompleta: "Google devolvió una respuesta incompleta. Probá conectar de nuevo.",
  estado_vencido:
    "La conexión tardó demasiado y venció por seguridad. Volvé a empezar desde el botón Conectar.",
  permisos_incompletos:
    "Google no otorgó todos los permisos necesarios. Volvé a conectar y aceptá todos los pedidos.",
  no_se_pudo_conectar: "No se pudo completar la conexión con Google. Probá de nuevo en un rato.",
  no_se_pudo_desconectar: "No se pudo desconectar la cuenta. Probá de nuevo en un rato.",
};

const GENERICO = "No se pudo completar la operación. Probá de nuevo en un rato.";

export function integrationErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return ERRORES[code] ?? GENERICO;
}

const EXITOS: Record<string, string> = {
  conectado: "Cuenta conectada. Ya podés usar lo que depende de ella.",
  desconectado: "Cuenta desconectada. Lo que dependía de ella deja de sincronizar.",
};

export function integrationOkMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return EXITOS[code] ?? null;
}
