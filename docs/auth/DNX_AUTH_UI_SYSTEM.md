# Sistema UX/UI unificado de autenticación DNX

## Ley

Todas las plataformas DNX conservan su identidad visual, pero usan la misma arquitectura de UX, el mismo orden de elementos y los mismos comportamientos de autenticación.

```text
MISMA UX + MISMO ORDEN + MISMOS COMPORTAMIENTOS
+ BRANDING PROPIO
+ PARTICULARIDADES CONTROLADAS POR CONFIGURACIÓN
```

## Paquete

`@repo/auth-ui` — componentes y brand configs.  
Lógica de identidad: `@repo/auth` (sin acoplar UI a Prisma).

## Tokens semánticos

Definidos en `packages/auth-ui/src/tokens.css`:

`--auth-background`, `--auth-surface`, `--auth-text-primary`, `--auth-text-secondary`, `--auth-border`, `--auth-focus`, `--auth-primary`, `--auth-primary-text`, `--auth-error`, `--auth-success`, `--auth-radius`, `--auth-control-height`, `--auth-content-width`.

Cada app mapea vía `data-brand` (`clickaton`, `fotorank`, `compramelafoto`, `infospot`, `fotoffice`).

## Componentes canónicos

| Componente | Rol |
| ---------- | --- |
| `DnxAuthShell` | Contenedor + tokens |
| `DnxAuthHeader` | Logo + título + descripción + contexto |
| `DnxEmailField` | Email |
| `DnxPasswordField` | Password + ojito |
| `DnxPrimaryAuthButton` | CTA principal |
| `DnxGoogleButton` | Google (secundario / emphasized) |
| `DnxAuthDivider` | Separador “o” |
| `DnxAuthError` / `DnxAuthNotice` | Estados |
| `DnxAuthLinks` | Forgot / crear cuenta / legal / ayuda |
| `DnxPasswordRequirements` | Requisitos |
| `DnxLoginPanel` / `DnxRegisterPanel` / `DnxForgotPanel` / `DnxResetPanel` | Composiciones |
| `DnxProfileSwitcher` | Post-login (no identidad) |
| `DnxSessionExpiredNotice` / `DnxVerificationState` | Estados especiales |

## Configuración

`DnxAuthBrandConfig` en `packages/auth-ui/src/types.ts`.  
No permite alterar el orden canónico.

## CI

- `pnpm auth:ui:selfcheck`
- `pnpm auth:ui:architecture:check`

## Rollout

1. Fase 1 (ahora): paquete + docs + checks — **sin** migrar todas las apps.  
2. Fase 2: tras `DNX UNIVERSAL ACCOUNT READY IN STAGING` → CLF, Clickatón, FotoRank.  
3. Fase 3: InfoSpot, FotoOffice.  
4. Fase 4: visual/a11y cross-app + limpieza legacy.
