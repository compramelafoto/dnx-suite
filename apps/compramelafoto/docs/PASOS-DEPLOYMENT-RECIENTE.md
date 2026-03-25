# Pasos para poner en marcha los cambios recientes

## 1. Variables de entorno

En tu `.env` o en el panel de Vercel/hosting, asegurate de tener:

```env
# Ya existentes (verificá que estén)
MP_ACCESS_TOKEN=APP-xxxx...
APP_URL=https://tu-dominio.com

# Opcional: descriptor en el resumen de tarjeta (máx 13 caracteres)
# Si no lo ponés, se usa "COMPRAMEFOTO"
MP_STATEMENT_DESCRIPTOR=COMPRAMEFOTO
```

---

## 2. Base de datos (migración)

La migración `20260311120000_add_failed_to_order_status` ya se aplicó si corriste `prisma migrate deploy`.

**Si deployás en Vercel:** el script `vercel-build` ejecuta `prisma migrate deploy` antes del build, así que la migración se aplica sola.

**Si deployás manualmente:** ejecutá antes del deploy:

```bash
npx prisma migrate deploy
```

---

## 3. Deploy

### Opción A: Vercel (recomendado)

```bash
git add .
git commit -m "fix: mejoras MP, pedidos, timezone"
git push origin main
```

Vercel detecta el push y hace el deploy automático.

### Opción B: Deploy manual

```bash
npm run build
# Luego subí la carpeta .next y ejecutá el servidor con:
npm run start
```

---

## 4. Verificación después del deploy

### 4.1 Pedidos del fotógrafo

1. Iniciá sesión como fotógrafo o laboratorio en `/fotografo/login` o `/lab/login`.
2. Entrá a **Mis Pedidos** (`/fotografo/pedidos`).
3. Deberías ver los pedidos (impresión y digitales).
4. Si no ves nada, abrí en la misma pestaña: `/api/fotografo/pedidos/debug` para ver el diagnóstico.

### 4.2 Dashboard admin

1. Iniciá sesión como admin en `/admin`.
2. Revisá **Ventas Hoy** y **Pedidos Hoy**.
3. Deberían coincidir con la hora de Argentina (no UTC).

### 4.3 Mercado Pago

1. Hacé un pedido de prueba (impresión o álbum).
2. Llegá hasta el checkout de Mercado Pago.
3. Completá el pago (o cancelá si es prueba).
4. En el panel de MP Developers, las recomendaciones de aprobación deberían ir desapareciendo:
   - `items.id`
   - `items.description`
   - `items.category_id`
   - `statement_descriptor`

---

## 5. Si algo falla

| Problema | Qué revisar |
|---------|-------------|
| Pedidos vacíos | Sesión activa, rol LAB/PHOTOGRAPHER, `/api/fotografo/pedidos/debug` |
| Ventas Hoy = 0 | Timezone del servidor; el código usa `America/Argentina/Buenos_Aires` |
| Error "FAILED" en Order | Migración aplicada: `npx prisma migrate deploy` |
| MP rechaza pagos | `MP_ACCESS_TOKEN` correcto, `APP_URL` con HTTPS en producción |

---

## 6. Resumen de archivos modificados

- `app/api/admin/dashboard/route.ts` – timezone Argentina
- `app/api/dashboard/photographer/route.ts` – Role.LAB
- `app/api/fotografo/pedidos/route.ts` – auth, labId, debug
- `app/api/fotografo/pedidos/debug/route.ts` – endpoint diagnóstico
- `app/fotografo/pedidos/page.tsx` – manejo 401, campos antifraude
- `lib/mercadopago.ts` – items (id, description, category_id), statement_descriptor
- `prisma/migrations/20260311120000_add_failed_to_order_status/` – enum OrderStatus
