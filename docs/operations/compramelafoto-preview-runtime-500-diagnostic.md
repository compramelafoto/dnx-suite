# ComprameLaFoto — Diagnóstico runtime 500 (preview ESM)

**Fecha:** 2026-07-09  
**App:** `apps/compramelafoto`  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Sin producción · sin DNS · sin cambios de Vercel env · sin deploy manual**

---

## Síntoma

Preview Vercel responde **500** en rutas API / server handlers.

Runtime logs:

```text
ERR_REQUIRE_ESM
___next_launcher.cjs require de route.js ESM
```

El launcher CommonJS de Next (`___next_launcher.cjs`) intenta `require()` de un `route.js` emitido como ESM.

---

## Causa raíz

En `apps/compramelafoto/package.json` estaba:

```json
"type": "module"
```

Eso marca **todo** `.js` del paquete (incluido el output de servidor en `.next`) como ESM. En runtime de Vercel, el entry CJS del launcher choca con esos módulos → `ERR_REQUIRE_ESM`.

Next App Router **no necesita** `"type": "module"` en `package.json` de la app:

- Código de app: TypeScript / `import`/`export` vía bundler.
- Configs Node ESM explícitos ya usan extensión `.mjs` (`eslint.config.mjs`, `postcss.config.mjs`).
- Scripts utilitarios en `scripts/*.js` usan `require()` (CJS) y se benefician de **no** forzar ESM a nivel de paquete.

---

## Fix aplicado

| Cambio | Detalle |
|--------|---------|
| `apps/compramelafoto/package.json` | **Eliminado** `"type": "module"` |
| Commit | `fix(clf): resolve preview api esm runtime error` |

No se tocó producción, DNS, variables Vercel ni deploy manual. El preview nuevo debe salir del push a la rama de migración.

---

## Verificación local

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter compramelafoto typecheck` | OK |
| `pnpm --filter compramelafoto build` | OK (tras quitar el flag) |
| `pnpm --filter compramelafoto lint` | OK |

---

## Criterio de éxito en preview

1. Vercel inicia deployment preview del commit del fix (sin intervención manual).
2. Runtime logs **sin** `ERR_REQUIRE_ESM` / `___next_launcher.cjs` fallando al cargar `route.js`.
3. Smoke HTTP de API crítica (p. ej. login o health) deja de devolver 500 por ESM.

**Nota:** otros fallos de preview (Deployment Protection, gaps de DB staging) están documentados aparte (`compramelafoto-preview-login-fix-plan.md`) y son independientes de este bug ESM.

---

## Relacionado (no cambiar aquí)

| App / paquete | `"type": "module"` | Notas |
|---------------|--------------------|--------|
| `apps/fotorank` | Sí | Fuera de alcance de este fix |
| `apps/fotoffice`, `apps/infospot` | Sí | Fuera de alcance |
| Packages (`@repo/auth`, `@repo/db`, etc.) | Sí | Paquetes de librería; no usan `___next_launcher` |
| Workers CLF | Sí | No son Next App Router |

Solo se corrigió **ComprameLaFoto** porque es la app con el 500 en preview reportado.
