# Variables de entorno

*Estado del proyecto `subilafoto-dnxsuite` en Vercel, producción. Al 2026-09-15.*

## Cargadas

| Variable | Valor | Nota |
|---|---|---|
| `DATABASE_URL`, `DIRECT_URL` | | Rama `production` de Neon |
| `AUTH_SECRET`, `AUTH_URL` | | |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | | |
| `R2_*` (5) | | Bucket `subilafoto-media` |
| `AWS_*` (3) | | Rekognition |
| `CRON_SECRET` | | Rotada el 15/9 |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | `https://subilafoto.com` | |
| `SUBILAFOTO_MP_REDIRECT_URI` | `https://subilafoto.com/api/pagos/conectar/retorno` | |
| `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` | 32 bytes generados | |
| `SUBILAFOTO_EMAIL_FROM` | `avisos@subilafoto.com` | |
| `SUBILAFOTO_CORREOS_EN_VIVO` | `false` | El interruptor, apagado |

### Sobre la clave maestra

Se generó nueva porque **las cuatro tablas financieras compartidas estaban vacías**:
`DnxFinancialIdentity`, `DnxPaymentAccount`, `DnxMercadoPagoOAuthState` y las credenciales.
No había nada cifrado que perder.

Si alguna vez hay credenciales guardadas, **cambiar esta clave las vuelve ilegibles** y
todos los vendedores tienen que volver a conectar Mercado Pago. Son 32 bytes en base64;
otro largo hace fallar el arranque con `INVALID_MASTER_KEY`.

### Las cuatro credenciales, cargadas el 2026-09-16

| Variable | Verificada |
|---|---|
| `SUBILAFOTO_MP_CLIENT_ID` | Sí |
| `SUBILAFOTO_MP_CLIENT_SECRET` | Sí |
| `SUBILAFOTO_MP_ACCESS_TOKEN` | **Sí, contra la API de Mercado Pago** |
| `RESEND_API_KEY` | **Sí, contra la API de Resend** |

`/api/salud` responde `configuracion.completa: true`.

**El token apunta a la cuenta real**, no a un usuario de prueba:

```
cuentaId: 97484805 · nickname: DNXESTUDIO · esDePrueba: false
```

Esa comprobación no es opcional. Un token de prueba **también empieza con `APP_USR-`**, así
que mirar el prefijo no alcanza: hay que preguntarle a la API de quién es. Con credenciales
de prueba el checkout abre, el pago se aprueba y el dinero no existe.

**La clave de Resend es válida y de sólo envío**, que es como conviene que esté: no puede
listar dominios ni tocar nada más. El costo es que el estado del dominio hay que mirarlo en
el panel.

## Lo que todavía no se puede dar por hecho

| Qué | Cómo se comprueba |
|---|---|
| `subilafoto.com` verificado en Resend | En el panel de Resend. Sin eso, todo envío da 403 |
| La URL de retorno bien escrita en Mercado Pago | Sólo haciendo el OAuth completo. Una barra de más falla con un error opaco |

Y dos que no son variables:

| Acción | Dónde | Sin ella |
|---|---|---|
| Declarar la URL de retorno, **exactamente** `https://subilafoto.com/api/pagos/conectar/retorno` | App "DNX Suite" de Mercado Pago | El OAuth falla con un error opaco |
| Verificar el dominio `subilafoto.com` | Resend | Todo envío devuelve 403 |

> **No crear una aplicación nueva en Mercado Pago.** Es una sola para toda la suite; otra
> necesitaría su propia homologación, que es el bloqueo que ya frenó a FOTOFFICE.

La URL de retorno se guarda como variable y no se arma concatenando el dominio a propósito:
tiene que coincidir **byte a byte** con la del panel de Mercado Pago, y una barra final de
más hace fallar el intercambio del código con un error que no dice nada.

## Cuando estén las cuatro

1. Cargarlas en Vercel, producción.
2. **Volver a desplegar.** Una variable sin despliegue no hace nada, y eso confunde más de
   lo que parece.
3. Verificar:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/diagnostico
curl -s -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/salud
```

4. Recién ahí, y cuando se quiera empezar a escribirle a gente de verdad, poner
   `SUBILAFOTO_CORREOS_EN_VIVO` en `true`. **Es una decisión aparte**: la clave de Resend
   sola no enciende nada.

## Lo que NO va en Vercel

`vercel env pull` devuelve vacío para las variables marcadas como `Secret`, así que un
valor cargado no se puede volver a leer. La forma confiable de verificar una variable es
**el comportamiento en producción**: 503 cuando falta, 401 cuando está y la llave no
coincide.
