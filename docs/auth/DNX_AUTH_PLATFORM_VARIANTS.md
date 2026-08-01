# Variantes controladas por plataforma

Las variantes modifican **copy, tokens y avisos**, no el orden principal ni la lógica `@repo/auth`.

| App | Variante | Efectos permitidos |
| --- | -------- | ------------------ |
| Clickatón | Registration context | Aviso de maratón/sede; amarillo/negro; no confundir con inscripción |
| FotoRank | Contest context | Separar crear cuenta vs inscripción vs jurado; sin prometer roles |
| ComprameLaFoto | Purchase context | Contexto álbum/compra; rol después de identificar |
| InfoSpot | Invitation-only | Ocultar crear cuenta; hint de invitación; forgot/Google OK |
| FotoOffice | Google-first visual | `googleVisualEmphasis: emphasized`; email/password sigue canónico |

## Excepciones de orden

Ninguna excepción de orden está aprobada en 10B.7.  
Cualquier excepción futura requiere ADR + entrada en este documento + owner + fecha límite.

## Jurados FotoRank

`/jurado/login` sigue siendo identidad paralela (`FotorankJudgeAccount`) — deuda de identidad, no variante UX canónica. Migración futura a memberships sobre User DNX.
