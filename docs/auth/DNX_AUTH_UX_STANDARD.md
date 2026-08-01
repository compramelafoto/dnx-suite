# Estándar UX — Auth DNX

**Obligatorio para todas las apps actuales y futuras.**  
Paquete UI: `@repo/auth-ui`. Identidad: `@repo/auth`.

## Ley de experiencia

Misma UX, mismo orden, mismos comportamientos; branding propio vía `DnxAuthBrandConfig`.

## Patrón de paneles

| Panel | Componente |
| ----- | ---------- |
| Login | `DnxLoginPanel` |
| Registro | `DnxRegisterPanel` |
| Olvidé | `DnxForgotPanel` |
| Restablecer | `DnxResetPanel` |
| Verificar | `DnxVerificationState` |
| Sesión vencida | `DnxSessionExpiredNotice` |
| Perfiles | `DnxProfileSwitcher` |

Ver orden detallado en `DNX_AUTH_INFORMATION_ARCHITECTURE.md`.

## Mensajes

Usar `DNX_AUTH_MESSAGES` (`@repo/auth`):

- Login: “Email o contraseña incorrectos.”  
- Reset: “Si existe una cuenta asociada, vas a recibir un correo.”  
- Registro existente: ofrecer login/recuperación sin filtrar datos.  

## CTAs canónicos

- “Iniciar sesión”  
- “Crear cuenta”  
- “Continuar con Google”  
- “Mi cuenta” / “Cerrar sesión”  

## No mostrar

Stacks, hashes, tokens, provider subjects, IDs internos, enumeración de cuentas en forgot.

## Documentos relacionados

- `DNX_AUTH_UI_SYSTEM.md`  
- `DNX_AUTH_COMPONENT_CONTRACT.md`  
- `DNX_AUTH_PLATFORM_VARIANTS.md`  
- `DNX_AUTH_ACCESSIBILITY_STANDARD.md`  
- `DNX_AUTH_UI_CURRENT_STATE_AUDIT.md`  
- ADR-DNX-001  

## CI

`pnpm auth:ui:selfcheck` · `pnpm auth:ui:architecture:check`
