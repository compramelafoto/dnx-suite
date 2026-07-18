# Roles conversacionales (Etapa 21)

OWNER y CLIENT son personalidades conversacionales. No cambian la autenticación de Telegram ni el perfil económico de Cuánto Cobro.

## Roles

| Rol | Uso |
|-----|-----|
| `OWNER` | Socio del estudio: puede ver mínimos, explicaciones, checklist, aprobar |
| `CLIENT` | Simulación de venta: habla como vendedor, sin información interna |

Futuros (no implementados): `PHOTOGRAPHER`, `ORGANIZER`, `STUDENT`, `EDITOR`.

## Persistencia

En `StoredConversation.roleState`:

- `role`
- `enteredAt`
- `enteredBy`
- `previousRole`

Si la conversación se cancela o se inicia `/nueva`, vuelve a OWNER.

## Activación (lenguaje natural)

Sin comandos `/modo_*`. Frases como «Simulemos un cliente» o «Entrá en modo cliente» → CLIENT.

«Terminemos la simulación» / «Volvé al modo normal» → OWNER.

## Prompts

Separados en `src/conversation/role/role-prompts.ts` (`OWNER_SYSTEM_PROMPT`, `CLIENT_SYSTEM_PROMPT`).

## Telegram

En CLIENT, `/presupuesto`, `/explicacion`, `/supuestos` y callbacks de budget se bloquean con un aviso de simulación. El draft del trabajo se conserva.
