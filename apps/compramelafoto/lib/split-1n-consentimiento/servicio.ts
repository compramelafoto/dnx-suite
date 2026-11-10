/**
 * Consentimiento de Split 1:N pedido desde el panel.
 *
 * El consentimiento lo da la persona en Mercado Pago, nunca CLF: lo único que hace la
 * plataforma es pedir la invitación, guardar el `receiver_id` y consultar el estado. Este
 * archivo es la lógica pura; la base y Mercado Pago llegan como dependencias.
 */

export type EstadoMp = "PENDING" | "ACTIVE" | "REJECTED" | "CANCELED" | "EXPIRED";
export type EstadoConsentimiento = "SIN_PEDIR" | EstadoMp;

export type ConsentimientoGuardado = {
  userId: number | null;
  receiverId: string;
  correo: string | null;
  estado: EstadoMp;
  inviteUrl: string | null;
  lastCheckedAt: Date | null;
};

export type VistaConsentimiento = {
  estado: EstadoConsentimiento;
  correo: string | null;
  inviteUrl: string | null;
  actualizadoEn: string | null;
};

export interface RepositorioConsentimiento {
  buscarPorUsuario(userId: number): Promise<ConsentimientoGuardado | null>;
  buscarPorReceiver(receiverId: string): Promise<ConsentimientoGuardado | null>;
  guardar(
    userId: number,
    fila: { receiverId: string; correo: string; estado: EstadoMp; inviteUrl: string | null },
    ahora: Date,
  ): Promise<void>;
  actualizarEstado(receiverId: string, estado: EstadoMp, ahora: Date): Promise<void>;
}

export type ConsentimientoMp = {
  sellerEmail: string;
  receiverId: string;
  status: string;
  inviteUrl?: string;
};

export interface ClienteConsentimientoMp {
  invitar(correo: string): Promise<ConsentimientoMp[]>;
  listar(): Promise<ConsentimientoMp[]>;
  consultar(receiverId: string): Promise<{ status: string } | null>;
}

export type DepsConsentimiento = {
  repo: RepositorioConsentimiento;
  mp: ClienteConsentimientoMp;
  ahora: () => Date;
};

export type ResultadoInvitacion =
  | { ok: true; vista: VistaConsentimiento }
  | { ok: false; codigo: string; mensaje: string };

/** No se le pregunta a Mercado Pago más de una vez por minuto por la misma persona. */
export const INTERVALO_CONSULTA_MS = 60_000;

const MENSAJES: Record<string, string> = {
  CORREO_INVALIDO: "Revisá el correo: tiene que ser el de tu cuenta de Mercado Pago.",
  MP_RECHAZO:
    "Mercado Pago no aceptó ese correo. Revisá que sea el de tu cuenta de Mercado Pago y probá de nuevo.",
  ERROR_MP: "No pudimos pedir la invitación a Mercado Pago. Probá de nuevo en unos minutos.",
  CUENTA_DE_OTRO_USUARIO:
    "Esa cuenta de Mercado Pago ya está vinculada a otro usuario de CompraMeLaFoto. Escribinos a soporte si es tuya.",
};

function falla(codigo: string): ResultadoInvitacion {
  return { ok: false, codigo, mensaje: MENSAJES[codigo] ?? MENSAJES.ERROR_MP };
}

export function normalizarEstadoMp(status: string | null | undefined): EstadoMp | null {
  const s = String(status ?? "").toUpperCase();
  return s === "PENDING" || s === "ACTIVE" || s === "REJECTED" || s === "CANCELED" || s === "EXPIRED"
    ? s
    : null;
}

export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo);
}

function vista(
  fila: Pick<ConsentimientoGuardado, "estado" | "correo" | "inviteUrl"> | null,
  actualizado: Date | null,
): VistaConsentimiento {
  if (!fila) return { estado: "SIN_PEDIR", correo: null, inviteUrl: null, actualizadoEn: null };
  return {
    estado: fila.estado,
    correo: fila.correo,
    inviteUrl: fila.estado === "ACTIVE" ? null : fila.inviteUrl,
    actualizadoEn: actualizado ? actualizado.toISOString() : null,
  };
}

export async function pedirInvitacion(
  deps: DepsConsentimiento,
  input: { userId: number; correo: string },
): Promise<ResultadoInvitacion> {
  const correo = input.correo.trim().toLowerCase();
  if (!correoValido(correo)) return falla("CORREO_INVALIDO");

  const actual = await deps.repo.buscarPorUsuario(input.userId);
  if (actual && actual.correo === correo) {
    if (actual.estado === "ACTIVE") return { ok: true, vista: vista(actual, actual.lastCheckedAt) };
    if (actual.estado === "PENDING" && actual.inviteUrl) {
      return { ok: true, vista: vista(actual, actual.lastCheckedAt) };
    }
  }

  let encontrado: ConsentimientoMp | undefined;
  try {
    const creados = await deps.mp.invitar(correo);
    encontrado = creados.find((c) => c.sellerEmail.trim().toLowerCase() === correo);
    // Ya invitado antes (o aceptado): Mercado Pago no lo devuelve como creado.
    if (!encontrado) {
      const existentes = await deps.mp.listar();
      encontrado = existentes.find((c) => c.sellerEmail.trim().toLowerCase() === correo);
    }
  } catch (err: unknown) {
    console.error("[split-1n-consentimiento] invitacion_fallida", {
      userId: input.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return falla("ERROR_MP");
  }
  if (!encontrado?.receiverId) return falla("MP_RECHAZO");

  const deOtro = await deps.repo.buscarPorReceiver(encontrado.receiverId);
  if (deOtro && deOtro.userId != null && deOtro.userId !== input.userId) {
    console.warn("[split-1n-consentimiento] cuenta_de_otro_usuario", {
      userId: input.userId,
      otroUserId: deOtro.userId,
    });
    return falla("CUENTA_DE_OTRO_USUARIO");
  }

  const ahora = deps.ahora();
  const fila = {
    receiverId: encontrado.receiverId,
    correo,
    estado: normalizarEstadoMp(encontrado.status) ?? "PENDING",
    inviteUrl: encontrado.inviteUrl ?? (deOtro?.inviteUrl || null),
  };
  await deps.repo.guardar(input.userId, fila, ahora);
  return { ok: true, vista: vista(fila, ahora) };
}

export async function actualizarEstado(
  deps: DepsConsentimiento,
  input: { userId: number; forzar?: boolean },
): Promise<VistaConsentimiento> {
  const actual = await deps.repo.buscarPorUsuario(input.userId);
  if (!actual) return vista(null, null);
  const ahora = deps.ahora();
  const reciente =
    actual.lastCheckedAt != null && ahora.getTime() - actual.lastCheckedAt.getTime() < INTERVALO_CONSULTA_MS;
  if (reciente && !input.forzar) return vista(actual, actual.lastCheckedAt);

  try {
    const consulta = await deps.mp.consultar(actual.receiverId);
    const estado = normalizarEstadoMp(consulta?.status);
    if (!estado) return vista(actual, actual.lastCheckedAt);
    await deps.repo.actualizarEstado(actual.receiverId, estado, ahora);
    return vista({ ...actual, estado }, ahora);
  } catch (err: unknown) {
    console.error("[split-1n-consentimiento] consulta_fallida", {
      userId: input.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return vista(actual, actual.lastCheckedAt);
  }
}

/**
 * Lo que el cobro consultó en vivo a Mercado Pago queda guardado: si alguien canceló su
 * consentimiento, el próximo pedido ya no se desvía al pago con tarjeta. Nunca lanza.
 */
export async function aplicarEstadosConsultados(
  repo: RepositorioConsentimiento,
  consultas: Array<{ receiverId: string; status: string } | null | undefined>,
  ahora: Date = new Date(),
): Promise<void> {
  for (const c of consultas) {
    const estado = normalizarEstadoMp(c?.status);
    if (!c?.receiverId || !estado) continue;
    try {
      await repo.actualizarEstado(c.receiverId, estado, ahora);
    } catch (err: unknown) {
      console.error("[split-1n-consentimiento] estado_no_guardado", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
