/** Textos y formatos compartidos del centro de reclamos (hora argentina). */
export const CATEGORIAS: Record<string, string> = {
  FALTA_INFO_BOT: "Al bot le faltaba información",
  SE_ACLARA_CON_DATOS: "Se aclara con los datos",
  PROBABLE_ERROR_CODIGO: "Probable error de código",
  OPERATIVO: "Operativo (necesita a una persona)",
  OTRO: "Otro",
};

export const ACCIONES: Record<string, string> = {
  reenviar_descarga: "Reenviar el link de descarga",
  reenviar_link_pack: "Mandar un link nuevo al pack de preventa",
  reenviar_link_de_descarga: "Reenviar el link de descarga del pedido",
  extender_vencimiento: "Extender el vencimiento del álbum",
  cambiar_venta_de_foto: "Cambiar la venta de una foto",
  editar_pack: "Editar un pack",
};

const fmt = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export function fechaCorta(iso: string): string {
  return fmt.format(new Date(iso));
}

/** "vence en 5 h" / "vencido hace 2 días". */
export function textoReloj(venceEn: string, ahora: number = Date.now()): string {
  const ms = new Date(venceEn).getTime() - ahora;
  const abs = Math.abs(ms);
  const horas = Math.floor(abs / 3_600_000);
  const cuanto = horas >= 48 ? `${Math.floor(horas / 24)} días` : horas >= 1 ? `${horas} h` : `${Math.max(1, Math.floor(abs / 60_000))} min`;
  return ms >= 0 ? `vence en ${cuanto}` : `vencido hace ${cuanto}`;
}
