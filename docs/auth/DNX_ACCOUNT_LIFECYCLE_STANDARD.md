# Estándar — Ciclo de vida Cuenta DNX Universal

Toda app pública con login debe ofrecer (salvo excepción documentada en ADR):

1. Login email/password (`verifyUserPassword`)
2. Continuar con Google (`resolveOrLinkGoogleUser`)
3. Crear cuenta email (`registerDnxAccount`)
4. Verificar email (`requestEmailVerification` / `verifyEmailWithToken`)
5. Olvidé mi contraseña (`requestPasswordReset`)
6. Restablecer (`resetPasswordWithToken`)
7. Cambiar contraseña (`changeUserPassword`)
8. Cerrar sesión (`destroySession`)
9. Revocar otras sesiones cuando corresponda (`revokeUserSessions`)
10. Vincular Google a cuenta existente
11. Evitar duplicados (email normalizado único)
12. Mismo `User.id` DNX

Excepciones válidas:

- InfoSpot roles editoriales: invite-only (identidad sigue siendo DNX).
- FotoOffice: puede priorizar Google; forgot password obligatorio si hay login email.
- Jurados FotoRank: modelo paralelo documentado (deuda).
