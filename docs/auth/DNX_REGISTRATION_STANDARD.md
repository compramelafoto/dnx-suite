# Estándar — Registro Cuenta DNX

## API

```ts
registerDnxAccount({
  email, password, passwordConfirm?,
  firstName?, lastName?, name?,
  sourceApplication, appBaseUrl, appLabel?,
  verifyPath?, createRole?: "CUSTOMER",
  acceptedTerms, acceptedPrivacy,
})
```

## Reglas

- No es inscripción a maratón/concurso.
- No otorga organizador/jurado/admin.
- Email normalizado; anti-duplicado.
- Password: política central (`validatePasswordPolicy`).
- Hash scrypt canónico.
- Enviar verificación de email.
- Si existe: mensaje seguro + ofrecer login/recuperación.
- Auditar `sourceApplication`.

## Separación

```text
Crear cuenta DNX  ≠  Inscribirse / Unirse a workspace / Ser jurado
```
