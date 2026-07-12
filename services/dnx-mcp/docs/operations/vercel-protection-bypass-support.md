# Vercel Protection Bypass — soporte en DNX-MCP

**Fecha:** 2026-07-09  
**Alcance:** probes HTTP / smoke / health / `vercel_validate_staging` / `release_validate`  
**Restricciones respetadas:** sin desactivar Deployment Protection · sin DNS · sin producción · sin deploy

---

## Qué hace

Si `VERCEL_AUTOMATION_BYPASS_SECRET` está definido en el entorno del proceso MCP, todos los probes HTTP contra URLs de **deployment preview** envían automáticamente:

```http
x-vercel-protection-bypass: <secret>
```

(mecanismo oficial [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)).

Si la variable **no** existe (o está vacía), el comportamiento previo se mantiene: probes sin header.

El valor del secret **nunca** se imprime en logs ni en reportes JSON (solo `protectionBypass.enabled` + nombre del header).

---

## Por qué

Los previews con Vercel Authentication (`ssoProtection`) responden HTML/SSO o `401 Protected deployment` a `curl`/`fetch` sin cookie SSO.  
Eso rompe smoke tests y hace que `release_validate` no pueda validar runtime HTTP real.

El bypass permite QA/automatización **sin** desactivar la protección ni tocar custom domains productivos.

---

## Configuración

En `.env.local` (o env del proceso que lanza el MCP):

```bash
VERCEL_AUTOMATION_BYPASS_SECRET=…   # generado en Vercel → Project → Deployment Protection
```

1. Crear el secret en el proyecto Vercel (Settings → Deployment Protection → Protection Bypass for Automation).
2. Copiarlo a `.env.local` de DNX-MCP.
3. Reiniciar el servidor MCP para recargar env.
4. **No** commitear el valor real.

También tipado en `src/config/schema.ts` y documentado en `.env.example`.

---

## Dónde se aplica

| Capa             | Archivo                                            | Comportamiento                                   |
| ---------------- | -------------------------------------------------- | ------------------------------------------------ |
| Headers          | `src/providers/vercel/client/protection-bypass.ts` | Resuelve secret + construye headers              |
| Probe HTTP       | `src/providers/vercel/client/deployment-probe.ts`  | `probeDeploymentUrl` / `runDeploymentHttpProbes` |
| Validate staging | `src/tools/vercel/vercel-validate-staging.ts`      | Ejecuta HTTP probes al `deployment.url`          |
| Release validate | vía `vercel_validate_staging`                      | Hereda probes + bypass                           |

### Detalles de probes en `vercel_validate_staging`

- Base URL = `deployment.url` del preview (no custom domains de producción).
- Smoke tests del catálogo de plataforma: se **reescribe el host** al del deployment (evita pegarle a `preview.dominio.com` / prod por error).
- Health endpoints del catálogo: solo se ejecutan si el **host coincide** con el del deployment (omite `compramelafoto.com`, etc.).
- Si no hay smokes aplicables → probe `GET /` del deployment.
- Reporta `protectionBypass: { enabled, header }` y `httpProbes[]` (sin secret).

---

## Uso programático

```ts
import {
  probeDeploymentUrl,
  runDeploymentHttpProbes,
  buildProtectionBypassHeaders,
  protectionBypassStatus,
} from "./providers/vercel/index.js";

// Status seguro para logs
protectionBypassStatus(); // { enabled: true, header: "x-vercel-protection-bypass" }

// Probe puntual
await probeDeploymentUrl({
  url: "https://my-app-xxx.vercel.app/api/health",
  expectedStatus: 200,
});

// Suite smoke/health
await runDeploymentHttpProbes({
  baseUrl: "https://my-app-xxx.vercel.app",
  smokeTests: [{ id: "home", name: "Home", target: "/", type: "http" }],
});
```

Opcional (browser / cookie):

```ts
buildProtectionBypassHeaders({ setBypassCookie: true });
// → también envía x-vercel-set-bypass-cookie: true
```

---

## Cómo verificar

```bash
# Con secret en .env.local y MCP reiniciado:
# vercel_validate_staging / release_validate (dryRun: false) sobre un preview protegido

# Esperado en el reporte:
# protectionBypass.enabled === true
# httpProbes[].bypassApplied === true
# httpProbes[].protectionBlocked === false (si el secret es válido)
# JSON del reporte NO contiene el valor del secret
```

Control negativo: quitar la variable → `enabled: false`, probes sin header (pueden ver SSO/HTML).

---

## Seguridad / riesgos

| Riesgo                      | Mitigación                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------- |
| Filtrar el secret           | No loguear; no incluir en reportes; rotar en Vercel si se filtra                    |
| Probar producción por error | Health absolutos a otro host se omiten; smokes se reescriben al host del deployment |
| Desactivar SSO              | **No** — este feature no cambia settings de Vercel                                  |
| Secret inválido             | Probes fallan con `protectionBlocked: true` → issues en validate                    |

---

## Tests

- `src/providers/vercel/client/protection-bypass.test.ts`
- `src/providers/vercel/client/deployment-probe.test.ts`
- `src/tools/vercel/vercel-tools.test.ts` (validate staging + bypass)

---

## Relacionado

- [`compramelafoto-vercel-preview-protection-plan.md`](./compramelafoto-vercel-preview-protection-plan.md)
- [`compramelafoto-preview-login-diagnostic.md`](./compramelafoto-preview-login-diagnostic.md)
