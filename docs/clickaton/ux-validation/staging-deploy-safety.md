# Seguridad de despliegue — Imp. 05

## Comandos canónicos usados

* `pnpm --filter clickaton deploy:staging:guard` → PASS  
* `pnpm --filter clickaton deploy:staging:safe -- --confirm-staging-deploy` → deploy a `clickaton-staging`

## Target

| Campo | Valor |
|-------|-------|
| Proyecto | `clickaton-staging` |
| Project ID | `prj_MM6Bkdi8***` |
| Deployment | `dpl_B5EDq4UE5FJ5R2yKS7NSj45zNLKr` |
| Alias | `https://clickaton-staging.vercel.app` |

## Prohibiciones respetadas

* No `vercel deploy` desde raíz sin guard  
* No `vercel --prod` hacia `clickaton-dnxsuite`  
* No promoción de `maratonfotografica.com`  
* No commit / no push  
* Guard no desactivado  

## Nota operativa

`deploy-staging-safe.ts` despliega desde la **raíz del monorepo** con `VERCEL_PROJECT_ID` staging (Root Directory Vercel = `apps/clickaton`), evitando el link de raíz hacia producción.
