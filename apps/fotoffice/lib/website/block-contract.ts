/**
 * Contrato que cualquier módulo futuro (Cursos, Socios, Beneficios, Premios, Eventos,
 * Portfolio, Noticias, Sponsors, etc.) debe resolver ANTES de ofrecer contenido al
 * módulo Website. Ningún módulo lo implementa todavía — es solo el tipo del contrato.
 *
 * Antes de implementar `WebsiteBlockSource` para un módulo, responder:
 * 1. Qué información de ese módulo es privada siempre.
 * 2. Qué información puede ser pública.
 * 3. Qué información nunca debe publicarse.
 * 4. Qué bloque (`WebsiteBlock.type`, ver `./blocks.ts`) ofrece.
 * 5. Qué rutas públicas necesita.
 * 6. Qué permisos/consentimiento del dueño de esos datos requiere publicarlos
 *    (ej. un Member no queda público solo porque el módulo Socios esté habilitado).
 * 7. Qué pasa con ese bloque si el módulo se desactiva (debe dejar de ofrecer datos,
 *    Website no debe romperse ni mostrar contenido stale).
 *
 * Regla de private-by-default: `loadPublicData` debe devolver un `select` explícito y
 * acotado — nunca el modelo interno completo (ver ejemplos documentados en el plan de
 * la etapa "base arquitectónica del módulo website": Cursos vía `Course`+`CourseInstance`
 * con `select` explícito y conteo de cupos por agregación; Socios NO tiene todavía ningún
 * campo con opt-in de publicación, así que hoy no puede implementar este contrato).
 */
export interface WebsiteBlockSource<TConfig = unknown> {
  /** Debe matchear un `WebsiteBlock.type` (ver `./blocks.ts`). */
  type: string;
  /** Ej.: su propio módulo está `enabled` para este workspace. */
  isAvailable(ctx: { workspaceId: string }): Promise<boolean>;
  /** Debe devolver únicamente datos ya filtrados por whitelist explícita. */
  loadPublicData(ctx: { workspaceId: string }, config: TConfig): Promise<unknown>;
}
