# 55 — Fix Google login en Production (Etapa 22O)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Alias Production:** `https://infospot-dnxsuite.vercel.app`  
**Clasificación del fallo:** `HANDLER_NOT_BOUND`

No incluye secretos, Client ID, Client Secret ni emails.

---

## Síntoma

En `/ingresar`, el CTA «Continuar con Google» parecía no hacer nada: sin cambio de URL, sin popup de Google, sin callback, Neon Production seguía en **0 users**.

La ruta directa `GET /api/auth/google` **sí** respondía **307** hacia Google (cookie `dnx_google_oauth` presente). El problema no era Google Cloud ni credenciales ausentes.

---

## Causa

El CTA era un `<button type="button">` **sin `href`**, con navegación solo vía:

`onClick` → `window.location.assign(googleHref)`

Sin hidratación JS (o con fallo de binding del handler), el clic no inicia el flujo OAuth. Auditoría SSR: `BTN_HAS_HREF = false`.

Production servía aún `fa55a2d` al momento del diagnóstico; el fix se despliega en un commit posterior.

---

## Fix

- CTA convertido a **`<a href={buildGoogleOAuthStartHref(...)}>`** (navegación nativa: click, Enter, Space, touch).
- Loading «Redirigiendo a Google…» + anti doble-clic (`aria-disabled`).
- Mensajes de error sanitizados (`friendlyGoogleLoginError`) + enlace **Reintentar**.
- Helpers puros en `lib/google-oauth-start.ts`; tests en `lib/google-oauth-start.test.ts`.

### Rutas

| Paso | Ruta |
|------|------|
| Start | `GET /api/auth/google` |
| Callback | `GET /api/auth/google/callback` |
| Post-login sin rol | `/ingresar/acceso-pendiente` |
| Post-login con rol | `/redaccion` |

---

## Pruebas

- Unit: `pnpm --filter infospot test:google-oauth-start`
- Directo: `GET /api/auth/google` → 307 + Location Google + cookie OAuth
- Manual Preview/Production: clic en CTA → Google → callback → User creado

---

## User creado

Pendiente de QA post-deploy: Neon Production debe pasar de **0 → 1** User tras un login Google completo. **No** asignar Director en esta etapa hasta confirmar User.

---

## Riesgos

- Si el usuario cancela en Google, vuelve a `/ingresar` con mensaje genérico.
- Grant Director sigue bloqueado hasta `INFOSPOT_DIRECTOR_EMAIL` + User existente.

---

## Siguiente paso (Director)

1. Completar login Google en alias Production.  
2. Confirmar 1 User en Neon.  
3. `INFOSPOT_DIRECTOR_EMAIL=… pnpm --filter @repo/db db:grant-infospot-director`  
4. Validar `/redaccion` (ver [53](./53-director-and-day1-content.md), [54](./54-first-director-production-validation.md)).
