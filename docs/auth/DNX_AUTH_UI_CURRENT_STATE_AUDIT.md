# Auditoría — estado actual UX/UI de autenticación DNX

**Fecha:** 2026-07-29  
**Etapa:** 10B.7 — Fase 1  
**Cutover identidad:** `CLICKATON DATA MIGRATION BLOCKED` (ver `docs/clickaton/STAGING_SHARED_IDENTITY_CUTOVER_REPORT.md`)

Orden canónico de referencia (login):

```text
1 identidad → 2 título → 3 descripción → 4 email → 5 password+ojito
→ 6 fila auxiliar (forgot) → 7 CTA principal → 8 error → 9 separador
→ 10 Google → 11 crear cuenta → 12 ayuda → 13 términos
```

---

## 1. Matriz por aplicación

| App | Pantalla | Ruta | Orden actual | Google | Ojito | Forgot | Registro | Errores | Mobile |
| --- | -------- | ---- | ------------ | ------ | ----- | ------ | -------- | ------- | ------ |
| CLF | Login unificado | `/login` | título → error → **Google** → email → pass+ojito → CTA → forgot → registro | Arriba | Sí | Tras CTA | Sí `/registro` | Arriba | Card light |
| CLF | Login cliente | `/cliente/login` | email → pass+ojito → CTA → forgot → Google → registro | Abajo | Sí | Tras CTA | Sí | Arriba | Igual |
| CLF | Login fotógrafo | `/fotografo/login` | igual cliente | Abajo | Sí | Tras CTA | Sí | Arriba | Igual |
| CLF | Cuánto Cobro | `/cuantocobro/login` | Google → email → pass+toggle texto → CTA | Arriba | Texto | Tras CTA | Fotógrafo | Arriba | Tokens `--cc-*` |
| CLF | Registro | `/registro` | campos → CTA → Google | Abajo | Sí | N/A | — | Arriba | Largo + roles |
| CLF | Forgot | `/forgot-password` | email → CTA | No | N/A | — | — | Arriba | OK |
| CLF | Reset | `/reset-password?token=` | pass → confirm (sin ojito) | No | No | — | — | Sí | Query token |
| CLF | Verify | `/verify-email` | estados client | No | N/A | — | — | Sí | — |
| CLF | Cambio pass | `/cuenta/cambiar-contrasena` | actual/nueva/confirm | No | No | — | — | Sí | Autenticado |
| Clickatón | Login | `/login` | eyebrow → Google → email → pass → forgot → error → CTA → crear | Arriba | **No** | Antes CTA | `/crear-cuenta` | Antes CTA | `max-w-md` |
| Clickatón | Crear cuenta | `/crear-cuenta` | Google → nombre/apellido → email → pass → CTA | Arriba | **No** | N/A | — | Antes CTA | Grid sm+ |
| Clickatón | Forgot/Reset/Verify | `/recuperar`, `/recuperar/[token]`, `/verificar-email` | OK parcial | No | No en reset | — | — | Inline | Path token |
| FotoRank | Login | `/login` | logo → email → pass → forgot → error → CTA → crear → **Google** | Abajo (tras crear) | **No** | Antes CTA | `/crear-cuenta` | Antes CTA | `FotorankDialogShell` |
| FotoRank | Jurado login | `/jurado/login` | email → pass → CTA | No | No | **No** | No | Antes CTA | Identidad paralela |
| FotoRank | Crear cuenta | `/crear-cuenta` | nombre → email → pass → CTA (sin Google) | Ausente | No | N/A | — | Antes CTA | — |
| FotoRank | Forgot/Reset/Verify | `/recuperar`, `[token]`, `/verificar-email` | OK parcial | No | No | — | — | Sí | Shell marca |
| InfoSpot | Login | `/ingresar` | Google → email → pass → remember → CTA → forgot | Arriba | **No** | Tras CTA | **No** | Arriba | Light editorial |
| InfoSpot | Forgot/Reset | `/recuperar`, `[token]` | OK parcial | No | No | — | — | Sí | Invite-only |
| FotoOffice | Login | `/login` | logo → **Google primary** → email → pass → forgot → CTA | Arriba (primary) | **No** | Antes CTA | **No** | Query+form | Google-first |
| FotoOffice | Forgot/Reset | `/recuperar`, `[token]` | OK parcial | No | No | — | — | Sí | Sin logo en forgot |

---

## 2. Componentes y rutas clave

| App | Archivos principales |
| --- | -------------------- |
| CLF | `app/login/LoginClient.tsx`, `cliente|fotografo/login/LoginClient.tsx`, `forgot-password`, `reset-password/ResetPasswordClient.tsx`, `components/cuenta/CambiarContrasenaClient.tsx` |
| Clickatón | `components/auth/LoginForm.tsx`, `GoogleLoginButton.tsx`, `crear-cuenta/RegisterForm.tsx`, `recuperar/*` |
| FotoRank | `app/login/LoginForm.tsx`, `crear-cuenta/RegisterForm.tsx`, `recuperar/*`, `FotorankDialogShell.tsx`, `jurado/login/JudgeLoginForm.tsx` |
| InfoSpot | `app/ingresar/login-form.tsx`, `recuperar/*` |
| FotoOffice | `app/login/login-view.tsx`, `login-form.tsx`, `recuperar/*` |

---

## 3. Inconsistencias críticas

1. **Google** no está en posición canónica en ninguna app (arriba o después de “crear cuenta”).
2. **Ojito** solo en CLF; resto sin control de visibilidad.
3. **Error** casi siempre antes del CTA (canónico: después).
4. **CTA copy** varía: “Ingresar”, “Entrar”, “Iniciar sesión”.
5. **Identidad visual** inconsistente (CLF sin logo en `/login`; Clickatón eyebrow sin isologo).
6. **FotoRank crear-cuenta** sin Google; login sí.
7. **CLF** tiene 3 órdenes distintos entre `/login`, rol y Cuánto Cobro.

---

## 4. Flows faltantes

| App | Falta |
| --- | ----- |
| Clickatón | Cambio de contraseña en sesión; ojito |
| FotoRank | Cambio de contraseña UI; ojito; Google en registro; jurado forgot |
| InfoSpot | Registro público (invite-only OK); verify UI; cambio pass; ojito |
| FotoOffice | Registro (Google-first OK); verify UI; cambio pass; ojito |
| CLF | Reset sin ojito; unificar orden de variantes |

---

## 5. Tokens / shells

| App | Shell | Tokens |
| --- | ----- | ------ |
| CLF | Card light / `container-custom` | `#c27b3d`, grises |
| Clickatón | Card `max-w-md` | `--ck-*`, amarillo |
| FotoRank | `FotorankDialogShell` | `fr-*`, gold |
| InfoSpot | `PageShell` editorial | `--is-*` |
| FotoOffice | `fo-card` full viewport | `--fo-*` |

---

## 6. Conclusión de auditoría

Ninguna plataforma cumple el orden canónico de punta a punta.  
Fase 1 de 10B.7 crea `@repo/auth-ui` y estándares; el rollout a apps queda **después** del cutover de identidad Staging.
