# Lo que falta cargar

*Paso a paso para el titular. Escrito el 2026-09-15. Son unos 20 minutos.*

Cuatro credenciales y dos acciones en consolas externas. Con esto, SubiLaFoto pasa de
"todo el código está" a "se puede vender".

---

## Por qué no las cargué yo

Lo intenté. Tres caminos, los tres cerrados:

1. **Leerlas de Vercel.** Las variables marcadas como `Secret` vuelven enmascaradas en
   `vercel env pull`. Verificado: bajé el archivo y el valor no coincide con el real.
2. **Copiarlas de CompraMeLaFoto.** El `.env.local` de CLF tiene `MP_ACCESS_TOKEN`, y por
   poco lo copio. **Son credenciales de un usuario de prueba de Mercado Pago.** Se lo
   pregunté a la API:

   ```
   id: 3141372692
   nick: TESTUSER313600323196489184
   mail: test_user_313600323196489184@testuser.com
   ```

   La cuenta real es `dnxfotografia@gmail.com`, `providerUserId 97484805`. Copiarlas habría
   dejado a SubiLaFoto cobrando en un sandbox: las compras "funcionarían" y el dinero no
   existiría. **Es el tipo de error que se descubre el día del evento.**
3. **La clave de Resend de CLF.** Es de envío solamente: no deja ni listar los dominios,
   así que tampoco pude verificar si `subilafoto.com` está habilitado.

---

## 1. Mercado Pago (10 minutos)

Panel: <https://www.mercadopago.com.ar/developers/panel>, con `dnxfotografia@gmail.com`.

### 1.a Entrar a la aplicación correcta

Es la de **CompraMeLaFoto** (`6578882958889626`), la única habilitada, que según la
decisión del 3 de septiembre hay que **renombrar a "DNX Suite"** —al 15 de septiembre
todavía se llama como antes—.

> **No crear una aplicación nueva.** Otra necesitaría su propia homologación, que es el
> paso que ya dejó trabado a FOTOFFICE. Y no tocar la de FotoOffice (`5350262556971123`).

### 1.b Declarar la URL de retorno

En *Checkout Pro → Configuración → URLs de redirección* (o *OAuth*), agregar
**exactamente**:

```
https://subilafoto.com/api/pagos/conectar/retorno
```

Sin barra al final. Tiene que coincidir **byte a byte** con la variable que ya está
cargada: una barra de más hace fallar el intercambio del código con un error que no dice
qué pasó.

### 1.c Copiar las credenciales **de producción**

De *Credenciales de producción* —no las de prueba—:

| Del panel | A Vercel como |
|---|---|
| Client ID | `SUBILAFOTO_MP_CLIENT_ID` |
| Client Secret | `SUBILAFOTO_MP_CLIENT_SECRET` |
| Access Token | `SUBILAFOTO_MP_ACCESS_TOKEN` |

El access token de producción empieza con `APP_USR-`. Si empieza con `TEST-`, son las de
prueba y estás en la pestaña equivocada.

---

## 2. Resend (5 minutos)

Panel: <https://resend.com>.

### 2.a Verificar el dominio

*Domains → Add domain →* `subilafoto.com`. Resend da tres o cuatro registros DNS
(SPF, DKIM, y a veces DMARC) que hay que cargar en Cloudflare. Tarda unos minutos en
verificar.

**Sin esto, todo envío devuelve 403**, con las claves bien cargadas.

### 2.b Crear una clave nueva

*API Keys → Create → permiso "Sending access"*, restringida al dominio `subilafoto.com`.

Una propia y no la de CompraMeLaFoto: si alguna vez hay que revocarla, se revoca una sola
plataforma.

| A Vercel como |
|---|
| `RESEND_API_KEY` |

---

## 3. Cargarlas en Vercel

Proyecto `subilafoto-dnxsuite`, entorno **Production**:
<https://vercel.com/compramelafotos-projects/subilafoto-dnxsuite/settings/environment-variables>

O por terminal, una por una:

```bash
cd apps/subilafoto && npx vercel env add SUBILAFOTO_MP_CLIENT_ID production
```

**Después hace falta un despliegue.** Una variable cargada sin desplegar no hace nada, y
eso confunde más de lo que parece. Cualquier push a `main` alcanza.

---

## 4. Verificar

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://subilafoto.com/api/salud
```

El panel **lista por nombre lo que falta** y qué deja de funcionar sin cada una. Cuando
`configuracion.completa` sea `true`, están las doce.

También se ve en `/panel/salud` si tenés rol de administrador.

---

## 5. Encender los correos: aparte, y cuando quieras

Cargar `RESEND_API_KEY` **no enciende nada**. Hace falta además:

```
SUBILAFOTO_CORREOS_EN_VIVO = true
```

Exactamente `true`. Son dos llaves a propósito: la clave sola podría llegar copiada de otro
proyecto, y lo que se manda son correos a los clientes de un fotógrafo. Mientras esté
apagado, los avisos quedan anotados como `DRY_RUN` y se puede revisar qué se habría
mandado.

---

## Lo que queda afuera de esta lista

El **botón de arrepentimiento** y el **Libro de Quejas Online** (Resolución 424/2020). No
es configuración: es texto legal y una pantalla. Una tienda argentina sin eso está
incumpliendo, y no se arregla después del lanzamiento.
