# ComprameLaFoto — Plan Deployment Protection (preview)

**Fecha:** 2026-07-09  
**Proyecto Vercel:** `compramelafoto-dnxsuite` (`prj_onlsJ1X9XOYyBFK0Qn5ojth4D1He`)  
**Team:** `team_fygF3LmWq2H8oEGuDtoCMgxb`  
**Estado:** solo auditoría + plan — **sin cambios aplicados**, sin deploy, sin DNS, sin tocar producción

**Preview de referencia:** `https://compramelafoto-dnxsuite-5p6i55xkl-compramelafotos-projects.vercel.app`  
**Deployment:** `dpl_CGQfoZaiW7PU2Cu9ukpLh2wVqKEz` (READY, `target: null` = preview)

---

## Resumen

Las APIs del preview `*.vercel.app` están bloqueadas por **Vercel Authentication (SSO)**.  
Estar logueado en el dashboard de Vercel **no** autentica automáticamente `fetch`/`curl` contra ese host.  
La opción más segura para QA manual + smoke tests es **Protection Bypass for Automation** (`VERCEL_AUTOMATION_BYPASS_SECRET`), sin desactivar la protección ni tocar dominios productivos.

> **Alerta:** `compramelafoto.staging.dnxsuite.com` hoy apunta al **mismo deployment de production** que `compramelafoto.dnxsuite.com`. No usarlo para “probar preview”.

---

## 1. Qué está pasando

### Síntoma

Login CLF en preview falla con:

```text
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

### Causa (capa Vercel)

El cliente hace `res.json()` sobre una respuesta que **no es la API de la app**, sino el gate de Deployment Protection (HTML de login Vercel o redirect SSO).

Probes anónimos al preview (2026-07-09):

| Request                         | Resultado                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /api/auth/me` (sin follow) | **302** → `https://vercel.com/sso-api?url=…`                                                                        |
| `GET /api/auth/me` (follow)     | **200** `text/html` (página login Vercel / HTML)                                                                    |
| `POST /api/auth/login`          | **401** JSON `{ "error": { "message": "Protected deployment" }, "protection": { "vercel_auth_enabled": true, … } }` |

El request **no llega** al handler Next.js de CLF. Por eso no hay logs de login en runtime.

### Configuración auditada (API Vercel, solo lectura)

```json
"ssoProtection": { "deploymentType": "all_except_custom_domains" }
```

| Setting                                | Valor actual                             |
| -------------------------------------- | ---------------------------------------- |
| Vercel Authentication (SSO)            | **Activo** — `all_except_custom_domains` |
| Password Protection                    | `null` (off)                             |
| Trusted IPs                            | `null` (off)                             |
| `protectionBypass` / Automation Bypass | **No configurado**                       |
| Env `VERCEL_AUTOMATION_BYPASS_SECRET`  | **Ausente** (preview y production)       |
| `optionsAllowlist`                     | `null`                                   |

**Significado de `all_except_custom_domains`:**

- URLs generadas `*.vercel.app` (previews y URL de deployment) → **protegidas con SSO**
- Custom domains del proyecto → **sin** ese SSO gate

### Dominios del proyecto (estado real)

| Dominio                                               | Verificado | Alias actual                                                  | ¿Es preview?             |
| ----------------------------------------------------- | ---------- | ------------------------------------------------------------- | ------------------------ |
| `compramelafoto.dnxsuite.com`                         | sí         | `dpl_GnsG3Frihrq44dDaGTMmFtyvJZFi` (**production**)           | No                       |
| `compramelafoto.staging.dnxsuite.com`                 | sí         | **mismo** `dpl_GnsG3Frihrq44dDaGTMmFtyvJZFi` (**production**) | **No** — nombre engañoso |
| `compramelafoto-dnxsuite.vercel.app`                  | sí         | production                                                    | No                       |
| `compramelafoto-dnxsuite-5p6i55xkl-….vercel.app`      | —          | preview `dpl_CGQfoZai…`                                       | Sí — **protegido**       |
| `compramelafoto-dnxsuite-git-mig-1e5204-….vercel.app` | —          | mismo preview                                                 | Sí — **protegido**       |

Probe en custom domain (sin SSO):

- `POST https://compramelafoto.staging.dnxsuite.com/api/auth/login` → JSON de la **app** (`Email o contraseña incorrectos`)
- Eso confirma que el custom domain **no** está bajo SSO, pero también que hoy sirve **production**, no el preview monorepo.

---

## 2. Por qué estar logueado en Vercel no alcanza para fetch/API

1. **Sesión del dashboard ≠ cookie del deployment**  
   Login en `vercel.com` no implica cookie válida en `*.vercel.app` del preview.

2. **La cookie SSO es por host/URL**  
   Vercel documenta que el token de autenticación queda en cookie **restringida a una URL** y no se reutiliza entre URLs distintas (aunque apunten al mismo deployment). Cada preview host nuevo puede exigir un challenge SSO propio.

3. **Navegación HTML vs `fetch` de API**
   - Abrir `/login` en el browser puede completar SSO (redirect + cookie) y luego mostrar la UI.
   - `fetch("/api/auth/login")` same-origin **sí** enviaría esa cookie **si** ya existe para ese host.
   - Si la cookie no está (otro preview URL, ventana privada, cookie borrada, SSO incompleto), el gate responde HTML/401 protection → `res.json()` explota con DOCTYPE.

4. **Herramientas fuera del browser** (`curl`, scripts, CI, MCP probes)  
   No tienen cookie SSO interactiva → siempre ven protection, aunque Daniel esté logueado en el dashboard.

5. **Conclusión operativa**  
   “Estoy logueado en Vercel” solo ayuda si, **en el mismo browser y en ese host exacto de preview**, se completó el challenge SSO. No sirve para smoke tests automatizados ni para APIs llamadas sin esa cookie.

---

## 3. Opciones disponibles

| #   | Opción                                                                                   | Qué hace                                                 | ¿Toca prod?                               | Seguridad                       | Apta para                                                            |
| --- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| A   | **Protection Bypass for Automation** (`VERCEL_AUTOMATION_BYPASS_SECRET` + header/cookie) | Bypass por secreto en requests                           | No (settings proyecto; no cambia aliases) | Alta si el secreto no se filtra | Smoke tests, curl, CI, QA API                                        |
| B   | Completar SSO en el **host exacto** del preview (browser)                                | Cookie SSO por URL                                       | No                                        | Alta (solo miembros del team)   | QA manual UI puntual                                                 |
| C   | Shareable Link                                                                           | Query param de acceso a un branch/deployment             | No                                        | Media (link compartible)        | Stakeholders externos                                                |
| D   | Relajar SSO a solo production URLs / desactivar en preview                               | Previews públicos                                        | No directo, pero **expone** previews      | Baja                            | Evitar salvo necesidad fuerte                                        |
| E   | Desactivar Vercel Authentication por completo                                            | Todo público (incl. URLs sensibles)                      | Riesgo alto                               | Muy baja                        | **No recomendado**                                                   |
| F   | Deployment Protection Exceptions (dominio preview público)                               | Un host preview sin auth                                 | No                                        | Media-baja (host público)       | Integraciones que no pueden mandar header (plan Enterprise / add-on) |
| G   | Usar / reasignar dominio staging custom                                                  | Con `all_except_custom_domains`, custom domain evita SSO | **Hoy staging = production**              | Peligroso hasta reasignar       | Solo **después** de apuntar staging a un preview (y sin tocar prod)  |

### Detalle de A — Bypass for Automation (recomendado)

Docs: [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)

- Header (preferido): `x-vercel-protection-bypass: <secret>`
- Query (webhooks): `?x-vercel-protection-bypass=<secret>`
- Para browser / follow-up requests: además `x-vercel-set-bypass-cookie: true` (setea cookie de bypass)
- Vercel puede exponer el secreto como system env `VERCEL_AUTOMATION_BYPASS_SECRET` en deployments
- **No requiere redeploy** para que el gate acepte el header en deployments ya existentes; sí hace falta redeploy si la **app** necesita leer el env en runtime (no es el caso para atravesar el gate)

### Detalle de G — staging custom (no usar ahora)

`compramelafoto.staging.dnxsuite.com` → **production** (`dpl_GnsG3Frihrq44dDaGTMmFtyvJZFi`).  
Probar login ahí **no valida el preview** y puede confundir QA con datos/env de producción.  
Reasignar ese alias a un preview es un cambio de dominio/alias: **fuera de alcance de este plan** (y requiere cuidado explícito para no tocar `compramelafoto.dnxsuite.com`).

---

## 4. Opción recomendada

### Recomendación principal

**A — Protection Bypass for Automation**, manteniendo SSO en previews.

| Uso                             | Cómo                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Smoke tests / curl / scripts    | Header `x-vercel-protection-bypass`                                                                     |
| QA manual en browser (opcional) | Una vez: request con bypass + `x-vercel-set-bypass-cookie=true`, o completar SSO (opción B) en ese host |
| CI futuro                       | Secret en el runner, nunca en git                                                                       |

### Complemento para QA UI

**B — SSO en el host exacto del preview** cuando se pruebe solo con browser y cuenta del team (sin automatización).

### Explicitamente no recomendado ahora

- Desactivar protección en preview o global (D/E)
- Usar `compramelafoto.staging.dnxsuite.com` como “preview” (G — hoy es prod)
- Cambiar DNS o dominios productivos
- Deploy / promote

---

## 5. Pasos manuales exactos en Vercel (aplicar a mano — este doc no los ejecuta)

### 5.1 Crear Protection Bypass for Automation

1. Abrir [Vercel Dashboard](https://vercel.com) → team del proyecto → proyecto **`compramelafoto-dnxsuite`**.
2. Ir a **Settings** → **Deployment Protection** (o sidebar **Deployment Protection**).
3. Sección **Protection Bypass for Automation** / **Automated & Agent Access**.
4. **Create** / generar secret (nota sugerida: `clf-preview-qa-smoke`).
5. Copiar el secret a un gestor de secretos local (1Password / env local). **No** commitear a git.
6. Confirmar que Vercel asocie el system env `VERCEL_AUTOMATION_BYPASS_SECRET` si se desea usarlo desde CI (opcional).
7. **No** desactivar Vercel Authentication.
8. **No** cambiar `deploymentType` en este paso.
9. **No** tocar dominios `compramelafoto.dnxsuite.com` ni aliases de production.

### 5.2 (Opcional) Solo QA browser sin secret

1. Abrir exactamente la URL del preview a probar (copiar desde Deployments → Preview).
2. Completar **Login – Vercel** con cuenta del team que tenga acceso al proyecto.
3. Verificar en DevTools → Application → Cookies del host preview que exista cookie de auth Vercel del deployment.
4. Recién ahí probar `/login` de CLF.

Si se cambia a **otro** `*.vercel.app` (otro deployment), repetir SSO en ese host.

### 5.3 Lo que no hacer

- No poner `ssoProtection: null`
- No usar Shareable Links como único control para APIs automatizadas (mejor header)
- No apuntar probes a `compramelafoto.staging.dnxsuite.com` creyendo que es preview
- No rotar/regenerar el bypass secret sin actualizar runners (invalidaría el valor anterior; redeploy solo si la app depende del env)

---

## 6. Cómo probar después

Sustituir `PREVIEW_URL` y `BYPASS_SECRET` (nunca pegar el secret en tickets públicos).

### 6.1 Smoke: atraviesa protection → llega a la app

```bash
PREVIEW_URL="https://compramelafoto-dnxsuite-5p6i55xkl-compramelafotos-projects.vercel.app"
BYPASS_SECRET="…"  # local only

# GET /api/auth/me — esperado: JSON de CLF, p.ej. {"user":null} — NO HTML Vercel
curl -sS -D - -o /tmp/clf-me.json \
  -H "x-vercel-protection-bypass: ${BYPASS_SECRET}" \
  "${PREVIEW_URL}/api/auth/me"
head -c 200 /tmp/clf-me.json; echo
# content-type debe ser application/json
```

### 6.2 Smoke: login API (credenciales staging de QA)

```bash
curl -sS -D - -o /tmp/clf-login.json \
  -X POST "${PREVIEW_URL}/api/auth/login" \
  -H "content-type: application/json" \
  -H "x-vercel-protection-bypass: ${BYPASS_SECRET}" \
  -d '{"email":"fotografo.staging@clf.dnx.test","password":"<staging-password>"}'
head -c 400 /tmp/clf-login.json; echo
```

Interpretación:

| Respuesta                                   | Significado                                            |
| ------------------------------------------- | ------------------------------------------------------ |
| HTML / `Login – Vercel` / 302 SSO           | Bypass no aplicado o secret incorrecto                 |
| 401 JSON `Protected deployment`             | Idem — sigue el gate                                   |
| 401/400 JSON de CLF (`Email o contraseña…`) | **Gate OK** — ya es la app                             |
| 500 JSON Prisma / columna faltante          | Gate OK — bloqueador de schema (ver diagnóstico login) |
| 200 JSON + `Set-Cookie`                     | Login OK en preview                                    |

### 6.3 Browser con cookie de bypass

```bash
# Setea cookie de bypass vía redirect (útil para QA manual)
open "${PREVIEW_URL}/?x-vercel-protection-bypass=${BYPASS_SECRET}&x-vercel-set-bypass-cookie=true"
```

Luego navegar a `/login` y probar el formulario. En Network, `POST /api/auth/login` debe ser `application/json` de CLF.

### 6.4 Control negativo (sin bypass)

```bash
curl -sS -o /tmp/clf-me-no-bypass.html -w "%{http_code} %{content_type}\n" -L \
  "${PREVIEW_URL}/api/auth/me"
# Esperado: HTML (protection), no JSON de app
```

### 6.5 Checklist QA

- [ ] Con bypass: `GET /api/auth/me` → JSON
- [ ] Con bypass: `POST /api/auth/login` → JSON de app (no protection)
- [ ] Sin bypass: preview sigue protegido
- [ ] Production `compramelafoto.dnxsuite.com` no modificado
- [ ] No se usó `compramelafoto.staging.dnxsuite.com` como proxy de preview

---

## 7. Riesgos

| Riesgo                                           | Impacto                                                                               | Mitigación                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Filtrar `BYPASS_SECRET` (chat, repo, screenshot) | Cualquiera con el secret bypasea protection en **todos** los deployments del proyecto | Secret manager; rotar si se filtra; no commitear                                                 |
| Creer que staging custom = preview               | Probar / mutar **production** sin querer                                              | Verificar alias (`dpl_…`); usar solo URL preview `*.vercel.app`                                  |
| Desactivar SSO en preview                        | Previews indexables / públicos                                                        | Preferir bypass                                                                                  |
| Cookie SSO en un host, probar otro preview URL   | Falso “sigue fallando HTML”                                                           | SSO o bypass **por host**                                                                        |
| Bypass no arregla schema/DB staging              | Tras gate, login puede 500 (gap Prisma)                                               | Ver [`compramelafoto-preview-login-diagnostic.md`](./compramelafoto-preview-login-diagnostic.md) |
| Regenerar secret sin actualizar CI               | Smokes rotos                                                                          | Rotación coordinada                                                                              |
| Shareable Link compartido en público             | Acceso externo al preview                                                             | Revocar link; preferir bypass + team                                                             |

---

## 8. Alcance de esta tarea

| Acción                                      | ¿Hecho?            |
| ------------------------------------------- | ------------------ |
| Auditar `ssoProtection` / bypass / dominios | Sí (API read-only) |
| Confirmar probes HTML/SSO en preview        | Sí                 |
| Documentar opciones y recomendación         | Sí                 |
| Crear bypass / cambiar settings Vercel      | **No**             |
| Deploy / DNS / dominios productivos         | **No**             |

---

## Relacionado

- [`compramelafoto-preview-login-diagnostic.md`](./compramelafoto-preview-login-diagnostic.md) — síntoma JSON/HTML y capa schema post-bypass
- [`compramelafoto-preview-runtime-diagnostic.md`](./compramelafoto-preview-runtime-diagnostic.md) — probes bloqueados por protection
- Docs Vercel: [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication) · [Bypass methods](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection) · [Automation bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
