# Contrato de componentes — `@repo/auth-ui`

## Principios

- Sin Prisma / DB / secrets en el paquete UI.  
- Props: brand, actions, estados, hrefs.  
- Slots medibles: `data-dnx-auth-slot`.  
- Mensajes seguros: preferir `DNX_AUTH_MESSAGES` de `@repo/auth`.

## `DnxPasswordField`

- Ojito a la derecha del input.  
- `aria-label`: “Mostrar contraseña” / “Ocultar contraseña”.  
- Área táctil ≥ 44×44 px.  
- No muta el valor al togglear; conserva foco.  
- Una instancia por campo.  
- `autocomplete` correcto (`current-password` | `new-password`).

## `DnxGoogleButton`

- Siempre después de CTA email + divider (en paneles compuestos).  
- Jerarquía `secondary` por defecto; `emphasized` solo FotoOffice (mismo orden).  
- Ícono oficial multicolor; sin estilos engañosos de “primary falso” en apps no Google-first.

## `DnxLoginPanel` / hermanos

Implementan el orden canónico.  
Apps pueden componer primitives si documentan excepción, pero CI exige orden vía slots cuando usan auth-ui.

## Brand config

Ver `DnxAuthBrandConfig`. Flags: `allowEmailLogin`, `allowEmailRegistration`, `allowGoogle`, `allowPasswordReset`, `invitationOnly`, `googleVisualEmphasis`.

## Loading

Estados: `idle` | `submitting` | `redirecting-google` | `sending-email` | `verifying` | `resetting`.  
Deshabilitar doble envío; no cambiar ancho del botón; texto claro.
