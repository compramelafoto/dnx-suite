export {
  DEFAULT_CONVERSATION_ROLE,
  FUTURE_CONVERSATION_ROLES,
  createDefaultRoleState,
  resolveConversationRole,
  transitionConversationRole,
  type ConversationRole,
  type ConversationRoleEnteredBy,
  type ConversationRoleState,
} from "./conversation-role.js";
export {
  detectRoleSignal,
  isRoleSwitchSignal,
  targetRoleFromSignal,
  type RoleSignal,
} from "./detect-role-signal.js";
export {
  textClientBlocksOwnerCommand,
  textEnterClientRole,
  textExitToOwnerRole,
} from "./role-transition-messages.js";
export {
  CLIENT_SYSTEM_PROMPT,
  OWNER_SYSTEM_PROMPT,
  getSystemPromptForRole,
} from "./role-prompts.js";
export {
  assertClientSafeText,
  composeClientSalesReply,
  sanitizeClientFacingText,
  type ClientSalesReplyInput,
  type ClientSalesReplyResult,
} from "./client-sales-reply.js";
