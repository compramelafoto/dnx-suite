export {
  DNX_SESSION_COOKIE,
  DNX_SESSION_MAX_AGE_SECONDS,
  DNX_SESSION_REMEMBER_MAX_AGE_SECONDS,
  hashSessionToken,
  createUserSession,
  getSessionUserByRawToken,
  destroyUserSessionByRawToken,
  revokeAllUserSessions,
  getSessionIdentityByRawToken,
  type SessionUser,
  type IdentityAppAccess,
  type IdentityWorkspace,
  type SessionIdentityContext,
} from "./sessions";

export {
  hashPassword,
  verifyPassword,
  createOpaqueToken,
  hashOpaqueToken,
} from "./password";

export {
  sendIdentityEmail,
  invitationEmailContent,
  roleAssignedEmailContent,
  passwordResetEmailContent,
  type IdentityEmailResult,
  type IdentityEmailPayload,
} from "./email";

export {
  DNX_INVITATION_TTL_MS,
  DNX_APP_INFOSPOT,
  inviteOrAssignAppAccess,
  resendAppInvitation,
  revokeAppInvitation,
  getInvitationByRawToken,
  listPendingInvitations,
  findPendingAppInvitationByEmail,
  acceptAppInvitation,
  buildInviteUrl,
  type DnxInvitationRecord,
  type InviteOrAssignResult,
} from "./invitations";

export {
  DNX_PASSWORD_RESET_TTL_MS,
  requestPasswordReset,
  resetPasswordWithToken,
} from "./password-reset";

export {
  bootstrapInfoSpotDirector,
  type BootstrapInfoSpotDirectorResult,
} from "./bootstrap-director";

export {
  grantGlobalRole,
  ensureGlobalSuperAdmin,
  isGlobalSuperAdmin,
  type GlobalRoleName,
  type GrantGlobalRoleResult,
} from "./global-role";

export {
  DNX_GOOGLE_OAUTH_COOKIE,
  DNX_GOOGLE_OAUTH_COOKIE_MAX_AGE,
  getGoogleOAuthCredentials,
  resolveAppBaseUrl,
  resolveGoogleRedirectUri,
  createGoogleOAuthTransit,
  parseAndVerifyGoogleOAuthTransit,
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthCode,
  fetchGoogleUserInfo,
  resolveOrLinkGoogleUser,
  hashEmailForLog,
  type GoogleOAuthCredentials,
  type GoogleUserInfo,
  type GoogleOAuthTransitPayload,
  type ResolveGoogleUserResult,
} from "./google-oauth";

export {
  DNX_APPLICATIONS,
  normalizeIdentityEmail,
  requireNormalizedIdentityEmail,
  findUserByIdentity,
  resolveOrCreateUser,
  verifyUserPassword,
  linkExternalIdentity,
  createIdentitySession,
  resolveSession,
  resolveSessionIdentity,
  destroySession,
  revokeUserSessions,
  getUserApplicationAccess,
  detectPasswordHashFormat,
  isCanonicalPasswordHash,
  isLegacyPasswordHash,
  type DnxApplicationId,
  type IdentityLookup,
  type DnxIdentityUser,
  type ResolveOrCreateUserInput,
  type ResolveOrCreateUserResult,
  type VerifyUserPasswordInput,
  type VerifyUserPasswordResult,
  type ExternalIdentityProvider,
  type LinkExternalIdentityInput,
  type ApplicationAccess,
  type PasswordHashFormat,
} from "./identity";

export {
  DNX_PASSWORD_MIN_LENGTH,
  DNX_PASSWORD_MAX_LENGTH,
  validatePasswordPolicy,
  requirePasswordPolicy,
  type PasswordPolicyResult,
} from "./password-policy";

export {
  sanitizeReturnTo,
  isSafeReturnTo,
  type SanitizeReturnToOptions,
} from "./return-to";

export { DNX_AUTH_MESSAGES, type DnxAuthMessageKey } from "./messages";

export {
  registerDnxAccount,
  type RegisterDnxAccountInput,
  type RegisterDnxAccountResult,
} from "./register";

export {
  DNX_EMAIL_VERIFY_TTL_MS,
  requestEmailVerification,
  verifyEmailWithToken,
} from "./email-verification";

export { passwordResetNeutralMessage } from "./password-reset";

export { changeUserPassword } from "./change-password";

export {
  passwordChangedEmailContent,
} from "./email";
