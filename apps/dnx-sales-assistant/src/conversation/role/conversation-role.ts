/**
 * Rol conversacional activo.
 * Extensible: futuros PHOTOGRAPHER | ORGANIZER | STUDENT | EDITOR.
 */
export type ConversationRole = "OWNER" | "CLIENT";

export type ConversationRoleEnteredBy =
  | "NATURAL_LANGUAGE"
  | "SYSTEM"
  | "CONVERSATION_END";

/** Estado persistido del rol en la conversación. */
export type ConversationRoleState = {
  role: ConversationRole;
  enteredAt: string;
  enteredBy: ConversationRoleEnteredBy;
  previousRole?: ConversationRole;
};

export const DEFAULT_CONVERSATION_ROLE: ConversationRole = "OWNER";

export function createDefaultRoleState(
  at: string = new Date().toISOString(),
): ConversationRoleState {
  return {
    role: "OWNER",
    enteredAt: at,
    enteredBy: "SYSTEM",
  };
}

export function resolveConversationRole(
  state?: ConversationRoleState,
): ConversationRole {
  return state?.role ?? DEFAULT_CONVERSATION_ROLE;
}

export function transitionConversationRole(input: {
  current?: ConversationRoleState;
  nextRole: ConversationRole;
  at: string;
  enteredBy: ConversationRoleEnteredBy;
}): ConversationRoleState {
  const previous = resolveConversationRole(input.current);
  return {
    role: input.nextRole,
    enteredAt: input.at,
    enteredBy: input.enteredBy,
    previousRole: previous !== input.nextRole ? previous : input.current?.previousRole,
  };
}

/** Roles futuros documentados (no implementados en esta etapa). */
export const FUTURE_CONVERSATION_ROLES = [
  "PHOTOGRAPHER",
  "ORGANIZER",
  "STUDENT",
  "EDITOR",
] as const;
