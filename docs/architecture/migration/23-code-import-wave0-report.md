# 23 — Reporte Oleada 0: esqueleto ComprameLaFoto en monorepo

**Fecha:** 2026-07-05  
**Oleada:** 0 — Esqueleto monorepo (sin `app/` ni `components/` masivos)  
**Fuente legacy:** `/Users/danielcuart/Desktop/compramelafoto`  
**Destino:** `apps/compramelafoto`  
**Plan:** [`22-code-import-execution-plan.md`](./22-code-import-execution-plan.md)

---

## Resumen ejecutivo

Oleada 0 **completada**. `apps/compramelafoto` es una app Next.js funcional mínima con bridges a `@repo/db`, `@repo/auth`, `@repo/auth-guards` y `@repo/design-system`. No se copió `app/` completo, `components/` masivo, `prisma/`, `public/uploads` ni secretos.

| Validación | Resultado |
|------------|-----------|
| `pnpm install` | ✅ OK (workspace actualizado) |
| `pnpm --filter compramelafoto lint` | ✅ OK (tras limpiar `._*` de macOS) |
| `pnpm --filter compramelafoto typecheck` | ✅ OK |
| `pnpm --filter compramelafoto build` | ✅ OK — ruta `/` estática + middleware |

**Listo para commit:** sí (Oleada 0 aislada; incluye cambio menor en `@repo/db` para reexport `Role`).

---

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `package.json` | App monorepo, puerto 3002, scripts `dev`/`build`/`lint`/`typecheck` |
| `tsconfig.json` | Extiende `@repo/typescript-config/nextjs.json`, path `@/*` |
| `next.config.ts` | CSP/headers/redirects legacy + `transpilePackages` monorepo |
| `middleware.ts` | Cookies referidos + visitor blog (copiado legacy) |
| `vercel.json` | Crons legacy + `installCommand`/`buildCommand` monorepo (sin migrate) |
| `.env.example` | Copiado legacy + cabecera monorepo, puerto 3002, sin IDs reales |
| `.gitignore` | `.next`, `.env*.local`, `**/._*` |
| `eslint.config.mjs` | Copiado legacy + ignore `**/._*` |
| `postcss.config.mjs` | Tailwind v4 PostCSS |
| `next-env.d.ts` | Generado por Next |
| `lib/prisma.ts` | Bridge → `@repo/db` + reexport `Role` |
| `lib/auth.ts` | Bridge sesión `dnx_session` + helpers legacy |
| `lib/auth-guards.ts` | Reexport `@repo/auth-guards` |
| `lib/blog/blog-visitor.ts` | Dependencia mínima de `middleware.ts` |
| `app/layout.tsx` | Layout raíz + `ComprameLaFotoDesignProvider` |
| `app/page.tsx` | Página scaffold Oleada 0 |
| `app/globals.css` | Tokens CLF mínimos + Tailwind |
| `components/providers/ComprameLaFotoDesignProvider.tsx` | Provider DS (1 archivo, no masivo) |
| `README.md` | Documentación app monorepo |

---

## Archivos copiados (desde legacy Desktop)

| Origen | Destino | Notas |
|--------|---------|-------|
| `middleware.ts` | `middleware.ts` | Copia directa |
| `lib/blog/blog-visitor.ts` | `lib/blog/blog-visitor.ts` | Copia + fix TS `match[1]` |
| `eslint.config.mjs` | `eslint.config.mjs` | Copia + ignore `._*` |
| `postcss.config.mjs` | `postcss.config.mjs` | Copia directa |
| `.env.example` | `.env.example` | Copia + sanitización (sin `WHATSAPP_PHONE_NUMBER_ID` real) |

---

## Archivos adaptados (fusión / monorepo)

| Archivo | Cambios principales |
|---------|---------------------|
| `package.json` | Sin `postinstall` prisma, sin `@prisma/client` en app; deps workspace + Next 16.2.1 |
| `next.config.ts` | `transpilePackages` monorepo; quitado `prisma`/`@prisma/client` de `serverExternalPackages` |
| `vercel.json` | `cd ../.. && pnpm install/build`; crons conservados (rutas aún no importadas) |
| `lib/prisma.ts` | Reexport `@repo/db` (patrón archive stale) |
| `lib/auth.ts` | Basado en archive stale; `Role` desde `./prisma` |
| `README.md` | De placeholder a guía dev monorepo |
| `.env.example` | Cabecera monorepo, `localhost:3002`, secretos vacíos |
| `packages/db/src/client.ts` | **Fuera del app:** reexport enum `Role` para evitar `@prisma/client` directo en apps |

---

## Archivos NO copiados (según plan)

- `app/` completo (solo 3 archivos mínimos)
- `components/` completo (solo 1 provider)
- `prisma/`, `public/uploads`, `.env*`, `node_modules`, `.next`
- Scripts, workers, e2e, assets masivos

---

## Dependencias agregadas (`apps/compramelafoto/package.json`)

### `dependencies`

| Paquete | Versión |
|---------|---------|
| `@repo/auth` | `workspace:*` |
| `@repo/auth-guards` | `workspace:*` |
| `@repo/db` | `workspace:*` |
| `@repo/design-system` | `workspace:*` |
| `next` | `16.2.1` |
| `react` / `react-dom` | `19.2.4` |

### `devDependencies`

`@repo/typescript-config`, `@tailwindcss/postcss`, `tailwindcss`, `eslint`, `eslint-config-next`, `typescript`, tipos Node/React.

**Pendiente Oleada 1+:** deps legacy (`sharp`, `@aws-sdk/*`, `resend`, etc.) se agregarán al importar dominios que las usen.

---

## Validaciones ejecutadas

```bash
pnpm install                                    # OK
pnpm --filter compramelafoto lint               # OK
pnpm --filter compramelafoto typecheck          # OK
pnpm --filter compramelafoto build              # OK
```

### Build output

```
Route (app)
┌ ○ /
└ ○ /_not-found

ƒ Proxy (Middleware)
```

### Advertencias (no bloqueantes)

- Next.js 16: convención `middleware` deprecada a favor de `proxy` — revisar en oleada posterior.
- Archivos `._*` (AppleDouble en volumen externo) rompieron lint inicial; eliminados + ignorados en eslint/gitignore.

### No ejecutado (por restricción explícita)

- `prisma migrate` / `db push` / `db pull` / `db:generate` en CI de esta oleada
- Deploy Vercel

---

## Errores encontrados y resolución

| Error | Resolución |
|-------|------------|
| ESLint parse error en `._*` | `find … -name '._*' -delete` + `globalIgnores **/._*` |
| `Cannot find module '@prisma/client'` en `lib/prisma.ts` | Reexport `Role` desde `@repo/db/src/client.ts` |
| `match[1]` possibly undefined en `blog-visitor.ts` | Guard `if (!match?.[1])` |

---

## Próximos pasos (Oleada 1 — Infra transversal P0)

1. Importar `app/login/`, `app/registro/`, `app/api/auth/`
2. Completar `lib/auth*.ts`, `lib/session*.ts`, `lib/password*.ts` desde legacy
3. `components/auth/`, `components/login/`
4. `app/not-found.tsx`, `app/layout.tsx` completo (con `MainLayout` cuando exista)
5. `public/` estático (sin `uploads/`)
6. Ampliar `lib/auth.ts` con fallback cookie legacy `auth-token` (plan §5.3)
7. Agregar deps legacy según imports de Oleada 1
8. **No activar deploy** hasta crons + rutas API existan

---

## Checklist commit sugerido

```
feat(clf): wave 0 monorepo scaffold for compramelafoto

- apps/compramelafoto: package, config, bridges, minimal app shell
- packages/db: export Role enum for app consumers
- docs: 23-code-import-wave0-report.md
```

**Archivos a incluir:** `apps/compramelafoto/**` (sin `.next`, `node_modules`, `tsconfig.tsbuildinfo`), `packages/db/src/client.ts`, `pnpm-lock.yaml`, `docs/architecture/migration/23-code-import-wave0-report.md`.
